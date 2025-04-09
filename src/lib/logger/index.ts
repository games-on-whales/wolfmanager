/**
 * Logger exports
 * This file re-exports the full-featured logger implementation
 */

// Export types and enums
export { LogComponent } from "./types";
export type { LogEntry, LoggerConfig, LogLevel } from "./types";
export { logger };

// Create and export server singleton instance
import { getLoggerConfig } from "./config"; // Import config loader
import { Logger } from "./logger";

const config = getLoggerConfig(); // Load the configuration
const logger = Logger.getInstance(config); // Pass config to getInstance

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
import { clientLogger, LogComponent } from "@/lib/logger/client";

await clientLogger.info(LogComponent.WOLF_UI, "Client-side log");
*/
