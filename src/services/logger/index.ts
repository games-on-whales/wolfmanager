interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  data?: unknown;
}

class LoggerService {
  private async sendLog(level: string, message: string, component?: string, data?: unknown) {
    try {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        component,
        data
      };

      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      console.error('Failed to send log:', error);
    }
  }

  debug(message: string, component?: string, data?: unknown) {
    console.debug(`[${component || 'App'}] ${message}`, data);
    this.sendLog('debug', message, component, data);
  }

  info(message: string, component?: string, data?: unknown) {
    console.info(`[${component || 'App'}] ${message}`, data);
    this.sendLog('info', message, component, data);
  }

  warn(message: string, component?: string, data?: unknown) {
    console.warn(`[${component || 'App'}] ${message}`, data);
    this.sendLog('warn', message, component, data);
  }

  error(message: string, component?: string, data?: unknown) {
    console.error(`[${component || 'App'}] ${message}`, data);
    this.sendLog('error', message, component, data);
  }
}

export default new LoggerService(); 