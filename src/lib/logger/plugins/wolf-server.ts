import { LogComponent, LogEntry, LoggerPlugin } from "../types";

interface WolfServerLogMessage {
  level: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class WolfServerPlugin implements LoggerPlugin {
  name = "wolf-server";
  private wsEndpoint: string;

  constructor(wsEndpoint: string) {
    this.wsEndpoint = wsEndpoint;
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    if (typeof window === "undefined") {
      return; // Don't initialize WebSocket on server-side
    }

    const ws = new WebSocket(this.wsEndpoint);

    ws.onmessage = (event) => {
      try {
        const data: WolfServerLogMessage = JSON.parse(event.data);

        // Map WolfServer log level to our log level
        const level = this.mapLogLevel(data.level);

        // Create a log entry
        const entry: LogEntry = {
          timestamp: new Date(data.timestamp),
          level,
          component: LogComponent.WOLF_SERVER,
          message: data.message,
          metadata: data.metadata,
        };

        // Forward to logger
        this.onLog(entry);
      } catch (error) {
        console.error("Failed to process WolfServer log:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WolfServer WebSocket error:", error);
    };

    ws.onclose = () => {
      console.warn("WolfServer WebSocket closed, attempting to reconnect...");
      setTimeout(() => this.initializeWebSocket(), 5000);
    };
  }

  private mapLogLevel(serverLevel: string): LogEntry["level"] {
    switch (serverLevel.toLowerCase()) {
      case "debug":
        return "debug";
      case "info":
        return "info";
      case "warning":
      case "warn":
        return "warn";
      case "error":
      case "critical":
        return "error";
      default:
        return "info";
    }
  }

  async onLog(entry: LogEntry): Promise<void> {
    // This method is called by the logger when logs are written
    // We don't need to do anything here as we're only forwarding logs from WolfServer
    return Promise.resolve();
  }
}
