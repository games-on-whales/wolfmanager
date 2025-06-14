import { LogEntry, LogTransport } from "../types";

/**
 * ContainerTransport implements Docker logging best practices:
 * 1. Writes to stdout/stderr
 * 2. Uses single-line JSON format
 * 3. Includes container-specific metadata
 * 4. Follows the Docker logging driver format
 */
export class ContainerTransport implements LogTransport {
  private containerId: string;
  private serviceName: string;

  constructor(serviceName: string = "wolfmanager") {
    this.serviceName = serviceName;
    // Try to get container ID from cgroup
    this.containerId = this.getContainerId();
  }

  private getContainerId(): string {
    if (typeof process === "undefined") return "unknown";

    try {
      // In a real container, this would read from /proc/self/cgroup
      // For now, we'll use a placeholder or env var
      return process.env.CONTAINER_ID || "unknown";
    } catch {
      return "unknown";
    }
  }

  private formatEntry(entry: LogEntry): string {
    // Format following Docker logging driver format
    const logEntry = {
      // Docker-specific fields
      container_id: this.containerId,
      container_name: this.serviceName,
      source: "stdout", // or stderr for errors

      // Standard fields
      time: entry.timestamp.toISOString(),
      level: entry.level,
      component: entry.component,
      message: entry.message,

      // Additional context
      ...(entry.raw ? { raw: entry.raw } : {}),
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
    };

    return JSON.stringify(logEntry);
  }

  async log(entry: LogEntry): Promise<void> {
    const formattedEntry = this.formatEntry(entry);

    // Use appropriate output stream based on log level
    if (entry.level === "error") {
      // Write errors to stderr
      console.error(formattedEntry);
    } else {
      // Write everything else to stdout
      console.log(formattedEntry);
    }
  }
}
