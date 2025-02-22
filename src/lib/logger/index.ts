import { clientLogger } from "./client";
import { getLoggerConfig } from "./config";
import { Logger } from "./logger";

// Initialize the logger with configuration
const logger = Logger.getInstance(getLoggerConfig());

// Export both server and client loggers
export { clientLogger, logger };

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
