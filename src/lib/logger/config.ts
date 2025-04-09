import { LoggerConfig } from "./types";

const isClient = typeof window !== "undefined";

// Default configuration for development
const devConfig: LoggerConfig = {
  level: "debug",
  container: {
    enabled: true,
    serviceName: "wolf-ui-dev",
    includeMetadata: true,
    useJson: true,
  },
  file: {
    enabled: !isClient, // Disable file transport in client
    // Path will be calculated conditionally within getLoggerConfig
    path: undefined,
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    format: "json",
  },
  console: {
    enabled: true,
    colorize: true,
    includeMetadata: true,
  },
};

// Configuration for production container environment
const containerConfig: LoggerConfig = {
  level: "info",
  container: {
    enabled: true,
    serviceName: "wolf-ui",
    includeMetadata: true,
    useJson: true,
  },
  file: {
    enabled: !isClient, // Disable file transport in client
    path: "/config/logs/wolf-ui.log", // Absolute path for container
    maxSize: 10 * 1024 * 1024,
    maxFiles: 5,
    format: "json",
  },
  console: {
    enabled: false,
    colorize: false,
    includeMetadata: true,
  },
};

// Configuration for production non-container environment
const prodConfig: LoggerConfig = {
  level: "info",
  container: {
    enabled: false,
    serviceName: "wolf-ui",
    includeMetadata: true,
    useJson: true,
  },
  file: {
    enabled: !isClient, // Disable file transport in client
    path: "/config/logs/wolf-ui.log", // Assume standard path if not container
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    format: "json",
  },
  console: {
    enabled: true,
    colorize: true,
    includeMetadata: true,
  },
};

// Get configuration based on environment
export function getLoggerConfig(): LoggerConfig {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isContainer = process.env.CONTAINER === "true";

  // Select base configuration - use structuredClone for deep copy to avoid mutation issues
  const baseConfig = structuredClone(
    isDevelopment ? devConfig : isContainer ? containerConfig : prodConfig
  );

  // Conditionally calculate and set the development file path only in Node.js
  if (
    isDevelopment &&
    typeof process !== "undefined" &&
    process.versions?.node
  ) {
    try {
      // Dynamically require 'path' only when needed and possible
      const pathModule = require("path");
      baseConfig.file.path = pathModule.join(
        process.cwd(),
        "config",
        "logs",
        "wolf-ui.log"
      );
    } catch (error) {
      console.error("Failed to require 'path' module for dev log path:", error);
      // Keep path undefined if 'path' module fails (e.g., unexpected environment)
      baseConfig.file.path = undefined;
    }
  }

  // Construct the final config object, merging base and environment overrides
  const finalConfig: LoggerConfig = {
    ...baseConfig,
    level: (process.env.LOG_LEVEL as LoggerConfig["level"]) || baseConfig.level,
    container: {
      ...baseConfig.container,
      enabled:
        process.env.LOG_CONTAINER_ENABLED === "true" ||
        baseConfig.container.enabled,
      serviceName:
        process.env.LOG_SERVICE_NAME || baseConfig.container.serviceName,
    },
    file: {
      ...baseConfig.file,
      // Ensure file logging is enabled only on server-side
      // and either explicitly enabled via env var or enabled in base config
      enabled:
        !isClient &&
        (process.env.LOG_FILE_ENABLED === "true" || baseConfig.file.enabled),
      // Use env var path override if provided, otherwise use the (potentially calculated) base path
      path: process.env.LOG_FILE_PATH || baseConfig.file.path,
      maxSize:
        parseInt(process.env.LOG_MAX_FILE_SIZE || "") ||
        baseConfig.file.maxSize,
      maxFiles:
        parseInt(process.env.LOG_MAX_FILES || "") || baseConfig.file.maxFiles,
      // Ensure format is correctly inherited or defaulted
      format: baseConfig.file.format || "json",
    },
    console: {
      ...baseConfig.console,
      enabled:
        process.env.LOG_CONSOLE_ENABLED === "true" ||
        baseConfig.console.enabled,
      colorize:
        process.env.LOG_CONSOLE_COLOR === "true" || baseConfig.console.colorize,
    },
  };

  // Final check: disable file logging if path is still undefined/null after all calculations
  if (!finalConfig.file.path) {
    finalConfig.file.enabled = false;
  }

  return finalConfig;
}
