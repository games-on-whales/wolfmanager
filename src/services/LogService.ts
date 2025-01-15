import { ConfigService } from './ConfigService';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  data?: any;
}

type LogSubscriber = (logs: LogEntry[]) => void;

class Logger {
  private static LOG_LEVEL = (typeof window !== 'undefined' && window.localStorage.getItem('LOG_LEVEL')) || 'info';
  private static LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  private static logs: LogEntry[] = [];
  private static subscribers: LogSubscriber[] = [];
  private static MAX_LOGS = 1000;

  private static shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.LOG_LEVEL as LogLevel];
  }

  private static formatLogEntry(level: LogLevel, message: string, component?: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      data: data ? this.sanitizeData(data) : undefined
    };
  }

  private static sanitizeData(data: any): any {
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      // Redact sensitive information
      ['steamApiKey', 'steamGridDbApiKey', 'password', 'token'].forEach(key => {
        if (key in sanitized) {
          sanitized[key] = '[REDACTED]';
        }
      });
      return sanitized;
    }
    return data;
  }

  private static async writeLog(entry: LogEntry) {
    // Add to in-memory logs
    this.logs.push(entry);
    // Keep only the last MAX_LOGS entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
    
    // Notify subscribers
    this.subscribers.forEach(callback => callback([...this.logs]));
    
    // Send to server
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.error('Failed to send log to server:', error);
    }

    // Browser environment
    if (typeof window !== 'undefined') {
      const consoleMethod = console[entry.level] || console.log;
      consoleMethod(JSON.stringify(entry));
      
      // Emit custom event for potential log collectors
      const logEvent = new CustomEvent('wolf-manager-log', { 
        detail: entry 
      });
      window.dispatchEvent(logEvent);
    }
  }

  static subscribe(callback: LogSubscriber) {
    this.subscribers.push(callback);
    callback([...this.logs]);

    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
      }
    };
  }

  static debug(message: string, component?: string, data?: unknown): void {
    // Only log debug messages if debug mode is enabled
    if (!ConfigService.isInitialized || !ConfigService.getConfig().debugEnabled) {
      return;
    }
    this.writeLog(this.formatLogEntry('debug', message, component, data));
  }

  static info(message: string, component?: string, data?: any) {
    if (this.shouldLog('info')) {
      this.writeLog(this.formatLogEntry('info', message, component, data));
    }
  }

  static warn(message: string, component?: string, data?: any) {
    if (this.shouldLog('warn')) {
      this.writeLog(this.formatLogEntry('warn', message, component, data));
    }
  }

  static error(message: string, error?: any, component?: string) {
    if (this.shouldLog('error')) {
      let errorData = error;
      if (error instanceof Error) {
        errorData = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
      this.writeLog(this.formatLogEntry('error', message, component, errorData));
    }
  }

  // Allow changing log level at runtime
  static setLogLevel(level: LogLevel) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('LOG_LEVEL', level);
      this.LOG_LEVEL = level;
    }
  }

  // Get all logs
  static getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  static clearLogs() {
    this.logs = [];
    this.subscribers.forEach(callback => callback([]));
  }
}

export default Logger; 