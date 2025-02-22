import path from "path";
import { LoggerConfig } from "./types";

// Default configuration for development
const devConfig: LoggerConfig = {
  level: "debug",
  consoleOutput: true,
  filePath: path.join(process.cwd(), "logs", "wolf-ui.log"),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
  format: "json",
};

// Configuration for production
const prodConfig: LoggerConfig = {
  level: "info",
  consoleOutput: true,
  filePath: "/var/log/wolf-ui/wolf-ui.log",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  format: "json",
};

// Get configuration based on environment
export function getLoggerConfig(): LoggerConfig {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const baseConfig = isDevelopment ? devConfig : prodConfig;

  return {
    ...baseConfig,
    // Override with environment variables if provided
    level: (process.env.LOG_LEVEL as LoggerConfig["level"]) || baseConfig.level,
    filePath: process.env.LOG_FILE_PATH || baseConfig.filePath,
    consoleOutput:
      process.env.LOG_CONSOLE_OUTPUT === undefined
        ? baseConfig.consoleOutput
        : process.env.LOG_CONSOLE_OUTPUT === "true",
    maxFileSize:
      parseInt(process.env.LOG_MAX_FILE_SIZE || "") || baseConfig.maxFileSize,
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "") || baseConfig.maxFiles,
    format:
      (process.env.LOG_FORMAT as LoggerConfig["format"]) || baseConfig.format,
  };
}
