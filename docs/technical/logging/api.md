# Logger API Reference

## Core Types

### LogLevel

```typescript
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
```

### LogComponent

```typescript
export const LogComponent = {
  WOLF_UI: "wolf-ui",
  WOLF_SERVER: "wolf-server",
  CONTAINER: "container",
  PAIRING: "pairing",
  AUTH: "auth",
  SYSTEM: "system",
} as const;

export type LogComponent = (typeof LogComponent)[keyof typeof LogComponent];
```

### LogEntry

```typescript
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: LogComponent;
  message: string;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}
```

## Server Logger API

### Logger Class

```typescript
class Logger {
  static getInstance(config?: Partial<LoggerConfig>): Logger;

  async debug(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  async info(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  async warn(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  async error(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  async flush(): Promise<void>;
}
```

### Configuration

```typescript
interface LoggerConfig {
  level: LogLevel;
  container: ContainerConfig;
  file: FileConfig;
  console: ConsoleConfig;
}

interface ContainerConfig {
  enabled: boolean;
  serviceName: string;
  includeMetadata: boolean;
  useJson: boolean;
}

interface FileConfig {
  enabled: boolean;
  path?: string;
  maxSize: number;
  maxFiles: number;
  format: "json" | "text";
}

interface ConsoleConfig {
  enabled: boolean;
  colorize: boolean;
  includeMetadata: boolean;
}
```

## Client Logger API

### ClientLogger Class

```typescript
class ClientLogger {
  debug(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  info(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  warn(
    component: LogComponent,
    message: string,
    metadata?: Record<string, unknown>
  ): void;

  error(
    component: LogComponent,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): void;
}
```

## Transport API

### LogTransport Interface

```typescript
interface LogTransport {
  log: (entry: LogEntry) => Promise<void>;
  flush?: () => Promise<void>;
}
```

### Built-in Transports

1. **ConsoleTransport**

   ```typescript
   class ConsoleTransport implements LogTransport {
     constructor();
     async log(entry: LogEntry): Promise<void>;
   }
   ```

2. **FileTransport**

   ```typescript
   class FileTransport implements LogTransport {
     constructor(
       filePath: string,
       maxSize?: number,
       maxFiles?: number,
       format?: "json" | "text"
     );
     async log(entry: LogEntry): Promise<void>;
     async flush(): Promise<void>;
   }
   ```

3. **ContainerTransport**
   ```typescript
   class ContainerTransport implements LogTransport {
     constructor(serviceName?: string);
     async log(entry: LogEntry): Promise<void>;
   }
   ```

## Plugin System

### LoggerPlugin Interface

```typescript
interface LoggerPlugin {
  name: string;
  onLog: (entry: LogEntry) => Promise<void>;
}
```

### Plugin Management

```typescript
class Logger {
  addPlugin(plugin: LoggerPlugin): void;
  removePlugin(pluginName: string): void;
}
```

## Usage Examples

### Basic Logging

```typescript
import { logger, LogComponent } from "@/lib/logger";

// Info level
await logger.info(LogComponent.WOLF_UI, "Operation successful", {
  operationId: "123",
});

// Error with stack trace
try {
  throw new Error("Failed");
} catch (error) {
  await logger.error(LogComponent.WOLF_UI, "Operation failed", error, {
    operationId: "123",
  });
}
```

### Client-Side Logging

```typescript
import { clientLogger, LogComponent } from "@/lib/logger";

// User interaction
clientLogger.info(LogComponent.WOLF_UI, "Button clicked", {
  buttonId: "save",
  context: "settings",
});

// Error handling
try {
  await saveData();
} catch (error) {
  clientLogger.error(LogComponent.WOLF_UI, "Save failed", error, {
    dataId: "123",
  });
}
```

### Custom Plugin

```typescript
import { LoggerPlugin, LogEntry } from "@/lib/logger";

class MetricsPlugin implements LoggerPlugin {
  name = "metrics";

  async onLog(entry: LogEntry): Promise<void> {
    if (entry.level === "error") {
      await this.incrementErrorCounter();
    }
  }

  private async incrementErrorCounter(): Promise<void> {
    // Implementation
  }
}

// Register plugin
const logger = Logger.getInstance();
logger.addPlugin(new MetricsPlugin());
```
