import { ConsoleTransport } from "./transports/console";
import { ContainerTransport } from "./transports/container";
import { FileTransport } from "./transports/file";
import {
  LogComponent,
  LogEntry,
  LogLevel,
  LogTransport,
  LoggerConfig,
  LoggerPlugin,
  loggerConfigSchema,
} from "./types";

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private transports: LogTransport[] = [];
  private plugins: LoggerPlugin[] = [];

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = loggerConfigSchema.parse(config);
    this.initializeTransports();
  }

  private initializeTransports() {
    // Add container transport if enabled
    if (this.config.container.enabled) {
      this.transports.push(
        new ContainerTransport(this.config.container.serviceName)
      );
    }

    // Add console transport if enabled
    if (this.config.console.enabled) {
      this.transports.push(new ConsoleTransport());
    }

    // Add file transport if enabled and path is specified
    if (this.config.file.enabled && this.config.file.path) {
      this.transports.push(
        new FileTransport(
          this.config.file.path,
          this.config.file.maxSize,
          this.config.file.maxFiles
        )
      );
    }
  }

  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  public addPlugin(plugin: LoggerPlugin) {
    this.plugins.push(plugin);
  }

  public removePlugin(pluginName: string) {
    this.plugins = this.plugins.filter((p) => p.name !== pluginName);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const configLevel = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }

  private async writeLog(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const promises: Promise<void>[] = [];

    // Log to all transports
    for (const transport of this.transports) {
      promises.push(transport.log(entry));
    }

    // Send to all plugins
    for (const plugin of this.plugins) {
      promises.push(plugin.onLog(entry));
    }

    await Promise.all(promises);
  }

  public async debug(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ) {
    await this.writeLog({
      timestamp: new Date(),
      level: "debug",
      component,
      message,
      raw,
      metadata,
    });
  }

  public async info(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ) {
    await this.writeLog({
      timestamp: new Date(),
      level: "info",
      component,
      message,
      raw,
      metadata,
    });
  }

  public async warn(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ) {
    await this.writeLog({
      timestamp: new Date(),
      level: "warn",
      component,
      message,
      raw,
      metadata,
    });
  }

  public async error(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ) {
    await this.writeLog({
      timestamp: new Date(),
      level: "error",
      component,
      message,
      raw,
      metadata,
    });
  }

  public async flush() {
    const promises = this.transports
      .filter(
        (t): t is LogTransport & { flush: () => Promise<void> } => !!t.flush
      )
      .map((t) => t.flush());
    await Promise.all(promises);
  }
}
