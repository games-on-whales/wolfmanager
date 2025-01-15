export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  data?: any;
  error?: Error;
}

export type LogSubscriber = (entry: LogEntry) => void; 