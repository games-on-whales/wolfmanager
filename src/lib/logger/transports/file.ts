// Only import fs in server context
let fs: typeof import("fs").promises | null = null;
if (typeof window === "undefined") {
  // Server-side only
  fs = require("fs").promises;
}

import path from "path";
import { LogEntry, LogTransport } from "../types";

export class FileTransport implements LogTransport {
  private readonly filePath: string;
  private readonly maxSize: number;
  private readonly maxFiles: number;
  private readonly format: "json" | "text";

  constructor(
    filePath: string,
    maxSize: number = 5 * 1024 * 1024,
    maxFiles: number = 5,
    format: "json" | "text" = "json"
  ) {
    this.filePath = filePath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.format = format;
  }

  async log(entry: LogEntry): Promise<void> {
    // Skip if running in client or fs is not available
    if (!fs) {
      return;
    }

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.filePath);
      await fs.mkdir(logDir, { recursive: true });

      // Format log entry
      const logLine =
        this.format === "json"
          ? JSON.stringify(entry) + "\n"
          : `${entry.timestamp} [${entry.level}] ${entry.component}: ${
              entry.message
            } ${JSON.stringify(entry.metadata)}\n`;

      // Append to log file
      await fs.appendFile(this.filePath, logLine, "utf8");

      // Check file size and rotate if needed
      await this.rotateLogsIfNeeded();
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    if (!fs) return;

    try {
      const stats = await fs.stat(this.filePath);
      if (stats.size >= this.maxSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      console.error("Failed to check log file size:", error);
    }
  }

  private async rotateLogs(): Promise<void> {
    if (!fs) return;

    try {
      // Rotate existing log files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldPath = `${this.filePath}.${i}`;
        const newPath = `${this.filePath}.${i + 1}`;
        try {
          await fs.access(oldPath);
          await fs.rename(oldPath, newPath);
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Rename current log file
      await fs.rename(this.filePath, `${this.filePath}.1`);

      // Create new empty log file
      await fs.writeFile(this.filePath, "", "utf8");
    } catch (error) {
      console.error("Failed to rotate log files:", error);
    }
  }
}
