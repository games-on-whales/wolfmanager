import { LogLevel, LogEntry, LogSubscriber } from './types';
import { Config } from '../config/types';
import { handleApiResponse, handleApiError } from '../base';

class LogService {
  private subscribers: LogSubscriber[] = [];
  private logEntries: LogEntry[] = [];
  private config: Config | null = null;

  subscribe(subscriber: LogSubscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // Only write debug logs if debug mode is enabled
    if (entry.level === LogLevel.DEBUG && !this.config?.debugEnabled) {
      return;
    }

    // Add to in-memory logs
    this.logEntries.push(entry);
    if (this.logEntries.length > 1000) {
      this.logEntries.shift();
    }

    // Notify subscribers
    this.subscribers.forEach(subscriber => subscriber(entry));

    // Write to server
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });
      await handleApiResponse<void>(response, 'LogService');
    } catch (error) {
      console.error('Failed to write log to server:', error);
    }
  }

  private formatError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  debug(message: string, component?: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      component,
      data
    });
  }

  info(message: string, component?: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      component,
      data
    });
  }

  warn(message: string, component?: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      component,
      data
    });
  }

  error(message: string, error?: unknown, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      component,
      error: this.formatError(error)
    });
  }

  async getLogs(): Promise<LogEntry[]> {
    try {
      const response = await fetch('/api/logs');
      const logs = await handleApiResponse<LogEntry[]>(response, 'LogService');
      this.logEntries = logs;
      return logs;
    } catch (error) {
      await handleApiError(error, 'LogService');
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      await handleApiResponse<void>(response, 'LogService');
      this.logEntries = [];
      this.subscribers.forEach(subscriber => {
        subscriber({
          timestamp: new Date().toISOString(),
          level: LogLevel.INFO,
          message: 'Logs cleared',
          component: 'LogService'
        });
      });
    } catch (error) {
      await handleApiError(error, 'LogService');
    }
  }

  setConfig(config: Config): void {
    this.config = config;
  }
}

export default new LogService(); 