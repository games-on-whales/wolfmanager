import path from "path";
import { LoggerConfig } from "./types";

const isClient = typeof window !== "undefined";

// Default configuration for development
const devConfig: LoggerConfig = {
  level: "debug",
  container: {
    enabled: false,
    serviceName: "wolf-ui-dev",
    includeMetadata: true,
    useJson: true,
  },
  file: {
    enabled: !isClient, // Disable file transport in client
    path: path.join(process.cwd(), "config", "logs", "wolf-ui.log"),
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
    path: "/config/logs/wolf-ui.log",
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
    path: "/config/logs/wolf-ui.log",
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

  // Select base configuration
  const baseConfig = isDevelopment
    ? devConfig
    : isContainer
    ? containerConfig
    : prodConfig;

  return {
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
      enabled:
        !isClient &&
        (process.env.LOG_FILE_ENABLED === "true" || baseConfig.file.enabled),
      path: process.env.LOG_FILE_PATH || baseConfig.file.path,
      maxSize:
        parseInt(process.env.LOG_MAX_FILE_SIZE || "") ||
        baseConfig.file.maxSize,
      maxFiles:
        parseInt(process.env.LOG_MAX_FILES || "") || baseConfig.file.maxFiles,
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
}
