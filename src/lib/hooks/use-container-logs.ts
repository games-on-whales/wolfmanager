import { ContainerInfo, LogEntry } from "@/lib/services/docker-log-service";
import { useCallback, useEffect, useRef, useState } from "react";
// Removed socket.io-client import

interface UseContainerLogsOptions {
  containerId?: string; // Optional container ID - if not provided, will auto-detect Wolf container
  pollingInterval?: number; // Milliseconds
  maxLogs?: number;
  timestamps?: boolean;
}

interface UseContainerLogsResult {
  logs: LogEntry[];
  container: ContainerInfo | null;
  isPolling: boolean; // Renamed from isConnected
  isLoading: boolean; // For initial load or manual refresh
  error: string | null;
  startPolling: () => void; // Renamed from startStreaming
  stopPolling: () => void; // Renamed from stopStreaming
  clearLogs: () => void;
}

const DEFAULT_POLLING_INTERVAL = 3000; // Default to 3 seconds

/**
 * Hook for polling Wolf container logs via the system API endpoint
 */
export function useContainerLogs({
  containerId,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  maxLogs = 1000,
  timestamps = true,
}: UseContainerLogsOptions): UseContainerLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Used for initial load/manual trigger
  const [error, setError] = useState<string | null>(null);

  // Ref to store the interval ID
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store the timestamp of the last received log
  const lastLogTimestampRef = useRef<number | undefined>(undefined);

  // Function to fetch logs
  const fetchLogs = useCallback(async () => {
    // Don't fetch if already loading (prevents overlapping requests)
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("timestamps", String(timestamps));

      // Use 'since' if we have a timestamp from the last log (+1 second to avoid duplicates)
      if (lastLogTimestampRef.current) {
        queryParams.set("since", String(lastLogTimestampRef.current + 1));
      } else {
        // Otherwise, fetch the initial tail
        queryParams.set("tail", String(maxLogs)); // Fetch up to maxLogs initially
      }

      // Choose API endpoint based on whether containerId is provided
      let apiEndpoint: string;
      if (containerId) {
        queryParams.set("containerId", containerId);
        apiEndpoint = `/api/system/container-logs?${queryParams.toString()}`;
      } else {
        // Use Wolf-specific endpoint that auto-detects the container
        apiEndpoint = `/api/system/wolf-container-logs?${queryParams.toString()}`;
      }

      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error?.message || errData.error || errorMsg;
        } catch (e) {
          /* Ignore JSON parsing error */
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch logs");
      }

      const { container: fetchedContainer, logs: newLogs } = result.data;

      setContainer(fetchedContainer); // Update container info

      if (newLogs && newLogs.length > 0) {
        setLogs((prevLogs) => {
          // Combine, sort by timestamp (if available), and limit
          const combined = [...prevLogs, ...newLogs];
          // Basic deduplication based on timestamp + message (can be improved if needed)
          const uniqueLogs = Array.from(
            new Map(
              combined.map((log) => [
                `${log.timestamp || ""}-${log.message}`,
                log,
              ])
            ).values()
          );
          // Sort primarily by timestamp (newest last), then by original index if no timestamp
          uniqueLogs.sort((a, b) => {
            const tsA = a.timestamp
              ? new Date(a.timestamp).getTime()
              : -Infinity;
            const tsB = b.timestamp
              ? new Date(b.timestamp).getTime()
              : -Infinity;
            if (tsA !== tsB) return tsA - tsB;
            // If timestamps are the same or missing, maintain relative order (less critical now)
            return combined.indexOf(a) - combined.indexOf(b);
          });

          // Update the timestamp of the last received log
          const lastLog = uniqueLogs[uniqueLogs.length - 1];
          if (lastLog?.timestamp) {
            // Convert ISO string to Unix timestamp (seconds)
            lastLogTimestampRef.current = Math.floor(
              new Date(lastLog.timestamp).getTime() / 1000
            );
          }

          return uniqueLogs.slice(-maxLogs); // Keep only the most recent maxLogs
        });
      }
    } catch (err) {
      console.error("[useContainerLogs] Error fetching logs:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      // Optionally stop polling on error, or let it retry
      // stopPolling(); // Uncomment to stop polling on fetch error
    } finally {
      setIsLoading(false);
    }
  }, [containerId, timestamps, maxLogs, isLoading]); // Include containerId and isLoading dependencies

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    lastLogTimestampRef.current = undefined; // Reset last timestamp
  }, []);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    setIsPolling(true);
    setError(null);
    lastLogTimestampRef.current = undefined; // Reset timestamp for fresh start

    // Fetch immediately first time
    fetchLogs();

    // Then set interval
    intervalRef.current = setInterval(fetchLogs, pollingInterval);
  }, [fetchLogs, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    // Keep isLoading false when manually stopping
    setIsLoading(false);
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    logs,
    container,
    isPolling,
    isLoading,
    error,
    startPolling,
    stopPolling,
    clearLogs,
  };
}
