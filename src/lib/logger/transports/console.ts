import chalk from "chalk";
import { LogEntry, LogLevel, LogTransport } from "../types";

export class ConsoleTransport implements LogTransport {
  private colorize(level: LogLevel, text: string): string {
    switch (level) {
      case "debug":
        return chalk.gray(text);
      case "info":
        return chalk.blue(text);
      case "warn":
        return chalk.yellow(text);
      case "error":
        return chalk.red(text);
      default:
        return text;
    }
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = `[${entry.component}]`.padEnd(12);

    let message = `${timestamp} ${level} ${component} ${entry.message}`;

    if (entry.raw) {
      message += "\n" + JSON.stringify(entry.raw, null, 2);
    }

    if (entry.metadata) {
      message += "\n" + JSON.stringify(entry.metadata, null, 2);
    }

    return message;
  }

  async log(entry: LogEntry): Promise<void> {
    const formattedEntry = this.formatEntry(entry);
    const colorizedEntry = this.colorize(entry.level, formattedEntry);

    switch (entry.level) {
      case "debug":
        console.debug(colorizedEntry);
        break;
      case "info":
        console.info(colorizedEntry);
        break;
      case "warn":
        console.warn(colorizedEntry);
        break;
      case "error":
        console.error(colorizedEntry);
        break;
    }
  }
}
