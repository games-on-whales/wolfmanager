"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
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
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
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

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface LogViewerProps {
  initialEntries: LogEntry[];
}

export function LogViewer({ initialEntries }: LogViewerProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(
    new Set()
  );
  const [copiedEntryIndex, setCopiedEntryIndex] = useState<number | null>(null);
  const [date, setDate] = useState<DateRange | undefined>();

  const uniqueComponents = Array.from(
    new Set(entries.map((entry) => entry.component))
  ).sort();

  const filteredEntries = entries.filter((entry) => {
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

      const response = await fetch("/api/logs");
      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Unauthorized: You need admin access to view logs");
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch logs");
      }

      setEntries(data.entries || []);

      clientLogger.info(LogComponent.WOLF_UI, "Log entries refreshed", {
        entryCount: data.entries?.length || 0,
      });
      showToast.success("Logs Refreshed", {
        description: "Log entries have been updated",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to refresh logs";
      clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to refresh logs",
        error as Error,
        { errorMessage }
      );
      showToast.error("Refresh Failed", errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshLogs, 30000);
    return () => clearInterval(interval);
  }, [refreshLogs]);

  const downloadLogs = useCallback(async () => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Downloading log entries");

      const blob = new Blob([JSON.stringify(entries, null, 2)], {
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
  }, [entries]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-4 flex-1">
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

          <Select value={componentFilter} onValueChange={setComponentFilter}>
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

      <Card className="bg-zinc-950 border-zinc-800 p-4">
        <div className="font-mono text-sm space-y-1 max-h-[600px] overflow-y-auto">
          {filteredEntries.map((entry, index) => (
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
                  <Badge className={getLevelColor(entry.level)}>
                    {entry.level.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="bg-transparent">
                    {entry.component}
                  </Badge>
                  <span className="text-zinc-500 text-xs">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                {expandedEntries.has(index) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                    onClick={(e) => copyToClipboard(JSON.stringify(entry))}
                  >
                    {copiedEntryIndex === index ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-zinc-300">{entry.message}</p>
              {expandedEntries.has(index) && entry.metadata && (
                <pre className="mt-2 p-2 rounded bg-zinc-900 text-zinc-300 overflow-x-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
