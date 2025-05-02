"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLogs } from "@/lib/actions/logging";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent, LogEntry } from "@/lib/logger/types";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  Copy,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

interface LogViewerProps {
  initialEntries?: LogEntry[];
}

export function LogViewer({ initialEntries = [] }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialEntries);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(
    new Set()
  );
  const [copiedEntryIndex, setCopiedEntryIndex] = useState<number | null>(null);
  const [date, setDate] = useState<DateRange | undefined>();
  const [error, setError] = useState<string | null>(null);

  const uniqueComponents = Array.from(
    new Set(logs.map((entry) => entry.component))
  ).sort();

  const filteredEntries = logs.filter((entry) => {
    const entryDate = new Date(entry.timestamp);
    const matchesLevel = levelFilter === "all" || entry.level === levelFilter;
    const matchesComponent =
      componentFilter === "all" || entry.component === componentFilter;
    const matchesSearch =
      searchQuery === "" ||
      entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.component.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.metadata &&
        JSON.stringify(entry.metadata)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));
    const matchesDateRange =
      !date?.from ||
      !date?.to ||
      (entryDate >= date.from &&
        entryDate <= new Date(date.to.getTime() + 86400000)); // Include the entire day by adding 24 hours

    return (
      matchesLevel && matchesComponent && matchesSearch && matchesDateRange
    );
  });

  const refreshLogs = useCallback(async () => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Refreshing log entries");
      setIsRefreshing(true);

      const result = await getLogs();
      if (result.success) {
        setLogs(result.entries || []);
        setError(null);
        clientLogger.info(LogComponent.WOLF_UI, "Log entries refreshed", {
          entryCount: result.entries?.length || 0,
        });
        showToast.success("Logs Refreshed", {
          description: "Log entries have been updated",
        });
      } else {
        setError(result.error || "Failed to fetch logs");
        clientLogger.error(
          LogComponent.SYSTEM,
          "Failed to fetch logs",
          new Error(result.error || "Unknown error")
        );
        showToast.error("Refresh Failed", result.error || "Unknown error");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      clientLogger.error(
        LogComponent.SYSTEM,
        "Error in log viewer",
        err instanceof Error ? err : new Error(errorMessage)
      );
      showToast.error("Refresh Failed", errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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

    // Only start polling if we're in the client
    if (typeof window !== "undefined") {
      fetchLogs();
      // Refresh logs every 30 seconds
      const interval = setInterval(fetchLogs, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const downloadLogs = useCallback(async () => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Downloading log entries");

      const blob = new Blob([JSON.stringify(logs, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wolf-ui-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      clientLogger.info(LogComponent.WOLF_UI, "Log entries downloaded");
      showToast.success("Download Started", {
        description: "Log file download has started",
      });
    } catch (error) {
      clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to download logs",
        error as Error
      );
      showToast.error("Download Failed", error as Error);
    }
  }, [logs]);

  const toggleExpand = (index: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500 text-white hover:bg-red-600";
      case "warn":
        return "bg-yellow-500 text-black hover:bg-yellow-600";
      case "info":
        return "bg-blue-500 text-white hover:bg-blue-600";
      case "debug":
        return "bg-gray-500 text-white hover:bg-gray-600";
      default:
        return "bg-gray-500 text-white hover:bg-gray-600";
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success("Copied", {
        description: "Log entry copied to clipboard",
      });
    } catch (error) {
      showToast.error("Copy Failed", "Failed to copy log entry to clipboard");
    }
  };

  const clearDateRange = () => {
    setDate(undefined);
  };

  const getLogCounts = (entries: LogEntry[]) => {
    return entries.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  return (
    <div className="p-6">
      <Card className="glass-card border-none w-full h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader className="border-b shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <p className="text-sm">
                  {filteredEntries.length.toLocaleString()}{" "}
                  {filteredEntries.length === 1 ? "entry" : "entries"}
                </p>
                {(levelFilter !== "all" || componentFilter !== "all") && (
                  <>
                    <span className="text-sm">•</span>
                    {levelFilter !== "all" && (
                      <p className="text-sm font-medium">
                        {levelFilter.toUpperCase()}
                      </p>
                    )}
                    {componentFilter !== "all" && (
                      <p className="text-sm font-medium">{componentFilter}</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {Object.entries(getLogCounts(logs)).map(([level, count]) => (
                  <div
                    key={level}
                    className="flex items-center space-x-1.5"
                    role="button"
                    onClick={() =>
                      setLevelFilter(level === levelFilter ? "all" : level)
                    }
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        level === "error" && "bg-red-500",
                        level === "warn" && "bg-yellow-500",
                        level === "info" && "bg-blue-500",
                        level === "debug" && "bg-gray-500"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium cursor-pointer",
                        levelFilter === level
                          ? "text-foreground"
                          : "text-muted-foreground",
                        "hover:text-foreground transition-colors"
                      )}
                    >
                      {count.toLocaleString()} {level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshLogs}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <Button variant="outline" size="icon" onClick={downloadLogs}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          {error ? (
            <div className="p-4 flex items-center justify-center h-full">
              <div className="text-destructive bg-destructive/10 rounded-lg p-4 max-w-md text-center">
                <p className="font-semibold">Error Loading Logs</p>
                <p className="text-sm mt-1">{error}</p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={refreshLogs}
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-card/80 backdrop-blur sticky top-0 z-10 shrink-0 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={componentFilter}
                    onValueChange={setComponentFilter}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select Component" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Components</SelectItem>
                      {uniqueComponents.map((component) => (
                        <SelectItem key={component} value={component}>
                          {component}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal w-[240px]",
                          !date?.from && !date?.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                          date.to ? (
                            <>
                              {format(date.from, "LLL dd, y")} -{" "}
                              {format(date.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(date.from, "LLL dd, y")
                          )
                        ) : (
                          "Pick a date range"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                      />
                      {(date?.from || date?.to) && (
                        <div className="p-3 border-t border-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={clearDateRange}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Clear dates
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                {(searchQuery ||
                  levelFilter !== "all" ||
                  componentFilter !== "all" ||
                  date?.from) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Active filters:</span>
                    {searchQuery && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSearchQuery("")}
                      >
                        Search: {searchQuery}
                        <X className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                    {levelFilter !== "all" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setLevelFilter("all")}
                      >
                        Level: {levelFilter}
                        <X className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                    {componentFilter !== "all" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setComponentFilter("all")}
                      >
                        Component: {componentFilter}
                        <X className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                    {date?.from && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={clearDateRange}
                      >
                        Date Range
                        <X className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto"
                      onClick={() => {
                        setSearchQuery("");
                        setLevelFilter("all");
                        setComponentFilter("all");
                        clearDateRange();
                      }}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-zinc-950 border-zinc-800 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {filteredEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">
                        No matching logs found
                      </p>
                      <p className="text-sm">
                        Try adjusting your filters or search query
                      </p>
                    </div>
                  ) : (
                    filteredEntries.map((entry, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded transition-colors cursor-pointer ${
                          expandedEntries.has(index)
                            ? "bg-zinc-800/50"
                            : "hover:bg-zinc-900"
                        }`}
                        onClick={() => toggleExpand(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 rounded text-xs font-semibold ${getLevelColor(
                                entry.level
                              )}`}
                            >
                              {entry.level.toUpperCase()}
                            </span>
                            <span className="px-2 rounded border border-zinc-700 text-xs">
                              {entry.component}
                            </span>
                            <span className="text-zinc-500 text-xs">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {expandedEntries.has(index) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(
                                    JSON.stringify(entry, null, 2)
                                  );
                                  setCopiedEntryIndex(index);
                                  setTimeout(
                                    () => setCopiedEntryIndex(null),
                                    2000
                                  );
                                }}
                              >
                                {copiedEntryIndex === index ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-zinc-300">{entry.message}</p>
                        {expandedEntries.has(index) && entry.metadata && (
                          <pre className="mt-2 p-2 rounded bg-zinc-900 text-zinc-300 overflow-x-auto">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
