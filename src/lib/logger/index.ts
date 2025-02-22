import { getLoggerConfig } from "./config";
import { Logger } from "./logger";

// Initialize the logger with configuration
const logger = Logger.getInstance(getLoggerConfig());

// Export the logger instance
export { logger };

// Re-export types and components
export * from "./plugins/wolf-server";
export * from "./types";

// Example usage:
/*
import { logger, LogComponent } from "@/lib/logger";

// Basic logging
await logger.info(LogComponent.WOLF_UI, "Application started");

// Logging with raw data
await logger.debug(
  LogComponent.WOLF_UI,
  "Processing request",
  { method: "GET", path: "/api/status" }
);

// Error logging with metadata
try {
  throw new Error("Failed to connect");
} catch (error) {
  await logger.error(
    LogComponent.WOLF_UI,
    "Connection error",
    error,
    { attemptCount: 3 }
  );
}

// Using with WolfServer plugin
import { WolfServerPlugin } from "@/lib/logger";

const wolfServerPlugin = new WolfServerPlugin("ws://localhost:8080/logs");
logger.addPlugin(wolfServerPlugin);
*/
