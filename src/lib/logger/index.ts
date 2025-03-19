/**
 * Logger exports
 * This file re-exports the full-featured logger implementation
 */

// Export types and enums
export { LogComponent } from "./types";
export type { LogEntry, LogLevel, LoggerConfig } from "./types";
export { logger };

// Create and export singleton instances
import { Logger } from "./logger";
const logger = Logger.getInstance();

// Create and export client singleton instance
import { ClientLogger } from "./client";
const clientLogger = ClientLogger.getInstance();
export { clientLogger };

// Re-export types and components
export * from "./plugins/wolf-server";
export * from "./types";

// Example usage:
/*
// Server Components:
import { logger, LogComponent } from "@/lib/logger";

await logger.info(LogComponent.WOLF_UI, "Server-side log");

// Client Components:
"use client";
import { clientLogger, LogComponent } from "@/lib/logger";

clientLogger.info(LogComponent.WOLF_UI, "Client-side log");
*/
