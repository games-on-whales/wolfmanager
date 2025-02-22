import { z } from "zod";

// Log Levels
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Components that can generate logs
export const LogComponent = {
  WOLF_UI: "wolf-ui",
  WOLF_SERVER: "wolf-server",
  CONTAINER: "container",
  PAIRING: "pairing",
  AUTH: "auth",
  SYSTEM: "system",
} as const;

export type LogComponent = (typeof LogComponent)[keyof typeof LogComponent];

// Base log entry structure
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: LogComponent;
  message: string;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

// Configuration schema for the logger
export const loggerConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  filePath: z.string().optional(),
  consoleOutput: z.boolean().default(true),
  maxFileSize: z.number().default(5 * 1024 * 1024), // 5MB default
  maxFiles: z.number().default(5),
  format: z.enum(["json", "text"]).default("json"),
});

export type LoggerConfig = z.infer<typeof loggerConfigSchema>;

// Plugin interface for external loggers
export interface LoggerPlugin {
  name: string;
  onLog: (entry: LogEntry) => Promise<void>;
}

// Transport interface for different output methods
export interface LogTransport {
  log: (entry: LogEntry) => Promise<void>;
  flush?: () => Promise<void>;
}
