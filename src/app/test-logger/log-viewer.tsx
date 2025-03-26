"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getLogs } from "@/lib/actions/logging";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent, LogEntry } from "@/lib/logger/types";
import { useEffect, useState } from "react";

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const result = await getLogs();
        if (result.success) {
          setLogs(result.entries || []);
          setError(null);
        } else {
          setError(result.error || "Failed to fetch logs");
          clientLogger.error(
            LogComponent.SYSTEM,
            "Failed to fetch logs",
            new Error(result.error || "Unknown error")
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        clientLogger.error(
          LogComponent.SYSTEM,
          "Error in log viewer",
          err instanceof Error ? err : new Error(errorMessage)
        );
      }
    };

    fetchLogs();
    // Refresh logs every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>System Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive">{error}</div>
        ) : (
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded ${
                  log.level === "error"
                    ? "bg-destructive/10"
                    : log.level === "warn"
                    ? "bg-warning/10"
                    : "bg-muted/10"
                }`}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span
                    className={`px-2 rounded ${
                      log.level === "error"
                        ? "bg-destructive text-destructive-foreground"
                        : log.level === "warn"
                        ? "bg-warning text-warning-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 font-mono text-sm">{log.message}</div>
                {log.metadata && (
                  <pre className="mt-1 text-xs text-muted-foreground">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
