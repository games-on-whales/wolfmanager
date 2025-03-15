"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogComponent } from "@/lib/logger/types";
import { useEffect, useState } from "react";

interface LogEntry {
  timestamp: string;
  level: string;
  component: LogComponent;
  message: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/logs");
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Set up polling every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "debug":
        return "text-gray-500";
      case "info":
        return "text-blue-500";
      case "warn":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-700";
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Recent Logs</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-red-500 mb-4 p-2 bg-red-50 rounded">{error}</div>
      )}

      <ScrollArea className="h-[400px] w-full rounded-md border p-4">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500">No logs available</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className="text-sm border-b border-gray-100 last:border-0 pb-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className={`font-medium ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-gray-600">[{log.component}]</span>
                </div>
                <div className="mt-1">{log.message}</div>
                {(log.metadata || log.raw) && (
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        ...(log.metadata ? { metadata: log.metadata } : {}),
                        ...(log.raw ? { raw: log.raw } : {}),
                      },
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
