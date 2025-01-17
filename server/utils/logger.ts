interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component: string;
  data?: unknown;
}

export function serverLog(level: string, message: string, component = 'Server', data?: unknown): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    data
  };

  // Log to console
  console.log(`[${logEntry.timestamp}] ${level.toUpperCase()} [${component}]: ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
} 