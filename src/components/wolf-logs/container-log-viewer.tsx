"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useContainerLogs } from "@/lib/hooks/use-container-logs";
import { Loader2, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react"; // Ensure React is imported for JSX type

interface ContainerLogViewerProps {
  containerId?: string; // Optional container ID - if not provided, will auto-detect Wolf container
  maxHeight?: string;
  maxLogs?: number;
  pollingInterval?: number; // Use polling interval instead of autoConnect
}

export function ContainerLogViewer({
  containerId,
  maxHeight = "500px",
  maxLogs = 1000,
  pollingInterval, // Get pollingInterval from props
}: ContainerLogViewerProps): JSX.Element {
  // Add explicit return type
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    logs,
    container,
    isPolling, // Renamed from isConnected
    isLoading,
    error,
    startPolling, // Renamed from startStreaming
    stopPolling, // Renamed from stopStreaming
    clearLogs,
  } = useContainerLogs({
    containerId,
    pollingInterval, // Pass pollingInterval
    maxLogs,
    timestamps: showTimestamps,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Toggle auto-scroll
  const handleAutoScrollChange = (checked: boolean) => {
    setAutoScroll(checked);
    if (checked && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  };

  // Toggle timestamps and restart streaming if connected
  const handleTimestampsChange = (checked: boolean) => {
    setShowTimestamps(checked);
    // Timestamps are now passed to fetchLogs directly, no need to restart polling
    // if (isPolling) {
    //   stopPolling();
    //   setTimeout(() => {
    //     startPolling();
    //   }, 100);
    // }
    // } // End of commented-out block
  }; // End of handleTimestampsChange function

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Wolf Container Logs</span>
          {container && (
            <span className="text-sm font-normal text-muted-foreground">
              {container.name} ({container.id.substring(0, 12)})
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {isPolling // Use isPolling
            ? "Polling logs periodically" // Updated text
            : "Start polling to view container logs"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {!isPolling ? ( // Use isPolling
                <Button
                  onClick={startPolling} // Use startPolling
                  disabled={isLoading}
                  size="sm"
                  className="flex items-center"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? "Starting..." : "Start Polling"}{" "}
                  {/* Updated text */}
                </Button>
              ) : (
                <Button
                  onClick={stopPolling} // Use stopPolling
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Polling {/* Updated text */}
                </Button>
              )}

              <Button
                onClick={clearLogs}
                variant="ghost"
                size="sm"
                className="flex items-center"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Logs
              </Button>
            </div>

            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-scroll"
                  checked={autoScroll}
                  onCheckedChange={handleAutoScrollChange}
                />
                <Label htmlFor="auto-scroll">Auto-scroll</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="show-timestamps"
                  checked={showTimestamps}
                  onCheckedChange={handleTimestampsChange}
                />
                <Label htmlFor="show-timestamps">Show Timestamps</Label>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-md">
              Error: {error}
            </div>
          )}

          {/* Log display */}
          <ScrollArea
            ref={scrollAreaRef}
            className="border rounded-md"
            style={{ height: maxHeight }}
          >
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-muted-foreground italic">
                  {isPolling
                    ? "Waiting for logs..."
                    : "Start polling to view logs"}{" "}
                  {/* Updated text */}
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`py-1 ${
                      log.stream === "stderr"
                        ? "text-red-500 dark:text-red-400"
                        : ""
                    }`}
                  >
                    {showTimestamps && log.timestamp && (
                      <span className="text-muted-foreground mr-2">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        {isPolling // Use isPolling
          ? `Polling ${container?.name || "container"} - ${
              logs.length
            } log entries shown` // Updated text
          : "Polling stopped"}
      </CardFooter>
    </Card>
  );
}
