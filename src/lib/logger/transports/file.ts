import { promises as fs } from "fs";
import path from "path";
import { LogEntry, LogTransport } from "../types";

export class FileTransport implements LogTransport {
  private filePath: string;
  private maxFileSize: number;
  private maxFiles: number;
  private writeQueue: Promise<void> = Promise.resolve();
  private currentFileSize = 0;

  constructor(
    filePath: string,
    maxFileSize: number = 5 * 1024 * 1024, // 5MB
    maxFiles: number = 5
  ) {
    this.filePath = filePath;
    this.maxFileSize = maxFileSize;
    this.maxFiles = maxFiles;
    this.initializeTransport();
  }

  private async initializeTransport() {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });

      // Get current file size if exists
      try {
        const stats = await fs.stat(this.filePath);
        this.currentFileSize = stats.size;
      } catch {
        // File doesn't exist yet, size is 0
        this.currentFileSize = 0;
      }
    } catch (error) {
      console.error("Failed to initialize file transport:", error);
      throw error;
    }
  }

  private async rotateLog() {
    try {
      // Check if we need to rotate
      if (this.currentFileSize < this.maxFileSize) {
        return;
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i >= 0; i--) {
        const source = i === 0 ? this.filePath : `${this.filePath}.${i}`;
        const target = `${this.filePath}.${i + 1}`;

        try {
          await fs.access(source);
          if (i === this.maxFiles - 1) {
            await fs.unlink(source);
          } else {
            await fs.rename(source, target);
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Reset current file size
      this.currentFileSize = 0;
    } catch (error) {
      console.error("Failed to rotate log files:", error);
      throw error;
    }
  }

  private formatEntry(entry: LogEntry): string {
    return (
      JSON.stringify({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      }) + "\n"
    );
  }

  async log(entry: LogEntry): Promise<void> {
    const formattedEntry = this.formatEntry(entry);

    // Queue the write operation
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.rotateLog();
        await fs.appendFile(this.filePath, formattedEntry, "utf8");
        this.currentFileSize += Buffer.byteLength(formattedEntry);
      } catch (error) {
        console.error("Failed to write to log file:", error);
        throw error;
      }
    });

    return this.writeQueue;
  }

  async flush(): Promise<void> {
    return this.writeQueue;
  }
}
