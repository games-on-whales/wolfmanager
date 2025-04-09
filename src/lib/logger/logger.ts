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
          // Assuming format defaults to 'json' in FileTransport constructor
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

    // Map transports to their promises for identification later
    const transportPromises = this.transports.map((transport) => ({
      transport,
      promise: transport.log(entry).catch((error) => error), // Catch errors here to allow allSettled to work
    }));

    // Include plugin promises as well, assuming they return Promise<void>
    const pluginPromises = this.plugins.map((plugin) => ({
      plugin,
      promise: plugin.onLog(entry).catch((error) => error),
    }));

    // Combine promises, we will handle results separately later
    const allPromises = [
      ...transportPromises.map((tp) => tp.promise),
      ...pluginPromises.map((pp) => pp.promise),
    ];

    // Use Promise.allSettled to wait for all promises regardless of success/failure
    const results = await Promise.allSettled(allPromises);

    // Process results to find failed transports
    const failedTransports: { transport: LogTransport; reason: any }[] = [];
    results.slice(0, this.transports.length).forEach((result, index) => {
      if (result.status === "rejected") {
        failedTransports.push({
          transport: this.transports[index],
          reason: result.reason,
        });
      }
    });

    // Process results for failed plugins (optional logging)
    results.slice(this.transports.length).forEach((result, index) => {
      if (result.status === "rejected") {
        // Handle plugin failures - perhaps log using console.error as fallback?
        // Avoid sending plugin failures back through the main logger to prevent loops
        console.error(
          `Logger plugin '${this.plugins[index].name}' failed:`,
          result.reason
        );
      }
    });

    // If any transports failed, log this failure using the transports that *succeeded*
    if (failedTransports.length > 0) {
      const successfulTransports = this.transports.filter(
        (t, index) => results[index].status === "fulfilled"
      );

      // Avoid infinite loops: If all transports failed, log to console as a last resort
      if (successfulTransports.length === 0 && this.transports.length > 0) {
        failedTransports.forEach(({ transport, reason }) => {
          console.error(
            `Log transport '${transport.constructor.name}' failed and no other transports succeeded. Reason:`,
            reason
          );
        });
        return; // Stop here if no transports can report the failure
      }

      // Log each transport failure through the successful transports
      for (const { transport, reason } of failedTransports) {
        const failureEntry: LogEntry = {
          timestamp: new Date(),
          level: "error", // Reporting transport failure as error
          component: LogComponent.SYSTEM, // Log component for logger system issues
          message: `Log transport '${transport.constructor.name}' failed`,
          raw: reason instanceof Error ? reason : new Error(String(reason)), // Ensure 'raw' is an Error
          metadata: {
            // Optionally add details from the original entry if needed
            // originalLevel: entry.level,
            // originalComponent: entry.component,
            // originalMessage: entry.message.substring(0, 100) // Example: truncate original message
          },
        };

        // Send the failure notice *only* to transports that didn't fail
        const failurePromises = successfulTransports.map((t) =>
          t.log(failureEntry).catch((err) => {
            // Fallback for nested failure: If logging the failure itself fails, log to console
            console.error(
              `Failed to log transport failure via ${t.constructor.name}:`,
              err
            );
          })
        );
        await Promise.allSettled(failurePromises); // Wait for failure logs to be attempted
      }
    }
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
