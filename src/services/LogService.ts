type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private static LOG_LEVEL = (typeof window !== 'undefined' && window.localStorage.getItem('LOG_LEVEL')) || 'info';
  private static LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private static shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.LOG_LEVEL as LogLevel];
  }

  private static formatLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
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

  private static writeLog(entry: LogEntry) {
    const logString = JSON.stringify(entry);
    
    // Browser environment
    if (typeof window !== 'undefined') {
      const consoleMethod = console[entry.level] || console.log;
      if (entry.data) {
        consoleMethod(entry.message, entry.data);
      } else {
        consoleMethod(entry.message);
      }
      
      // Emit custom event for potential log collectors
      const logEvent = new CustomEvent('wolf-manager-log', { 
        detail: entry 
      });
      window.dispatchEvent(logEvent);
    }
  }

  static debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      this.writeLog(this.formatLogEntry('debug', message, data));
    }
  }

  static info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      this.writeLog(this.formatLogEntry('info', message, data));
    }
  }

  static warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      this.writeLog(this.formatLogEntry('warn', message, data));
    }
  }

  static error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      let errorData = error;
      if (error instanceof Error) {
        errorData = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
      this.writeLog(this.formatLogEntry('error', message, errorData));
    }
  }

  // Allow changing log level at runtime
  static setLogLevel(level: LogLevel) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('LOG_LEVEL', level);
      this.LOG_LEVEL = level;
    }
  }
}

export default Logger; 