import { getLoggerConfig } from "./config";
import { ConsoleTransport } from "./transports/console";
import { LogComponent, LogEntry, LogLevel, LogTransport } from "./types";

class ClientLogger {
  private transports: LogTransport[] = [];
  private config = getLoggerConfig();

  constructor() {
    this.initializeTransports();
  }

  private initializeTransports() {
    // Only use console transport in client
    if (this.config.console.enabled) {
      this.transports.push(new ConsoleTransport());
    }
  }

  private async logToTransports(entry: LogEntry) {
    await Promise.all(
      this.transports.map((transport) =>
        transport.log(entry).catch((error) => {
          console.error("Transport error:", error);
        })
      )
    );
  }

  private createLogEntry(
    level: LogLevel,
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      component,
      message,
      metadata: metadata || {},
    };
  }

  async debug(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const entry = this.createLogEntry("debug", component, message, metadata);
    await this.logToTransports(entry);
  }

  async info(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const entry = this.createLogEntry("info", component, message, metadata);
    await this.logToTransports(entry);
  }

  async warn(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const entry = this.createLogEntry("warn", component, message, metadata);
    await this.logToTransports(entry);
  }

  async error(
    component: LogComponent,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ) {
    const errorMetadata = {
      ...metadata,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    const entry = this.createLogEntry(
      "error",
      component,
      message,
      errorMetadata
    );
    await this.logToTransports(entry);
  }
}

export const clientLogger = new ClientLogger();
