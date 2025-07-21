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
  WOLF_UI: "wolfmanager-ui",
  WOLF_SERVER: "wolf-server",
  CONTAINER: "container",
  PAIRING: "pairing",
  CLIENT: "client",
  AUTH: "auth",
  SYSTEM: "system",
  STEAM: "steam",
  API: "api",
  WOLF_EVENTS: "wolf-events",
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

// Container-specific configuration
export const containerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  serviceName: z.string().default("wolfmanager"),
  includeMetadata: z.boolean().default(true),
  useJson: z.boolean().default(true),
});

// File output configuration
export const fileConfigSchema = z.object({
  enabled: z.boolean().default(true),
  path: z.string().optional(),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB default
  maxFiles: z.number().default(5),
  format: z.enum(["json", "text"]).default("json"),
});

// Console output configuration
export const consoleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  colorize: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});

// Configuration schema for the logger
export const loggerConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  container: containerConfigSchema.default({}),
  file: fileConfigSchema.default({}),
  console: consoleConfigSchema.default({}),
});

export type ContainerConfig = z.infer<typeof containerConfigSchema>;
export type FileConfig = z.infer<typeof fileConfigSchema>;
export type ConsoleConfig = z.infer<typeof consoleConfigSchema>;
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

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  message: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}
