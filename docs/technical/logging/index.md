# WolfUI Logging System

## Overview

The WolfUI logging system provides comprehensive logging capabilities for both server and client components, with features for:

- Structured logging
- Multiple output formats
- Environment-specific configuration
- Security-aware logging practices

## Quick Links

- [Setup Guide](./setup.md) - Logger setup and configuration
- [Standards](./standards.md) - Logging standards and best practices
- [API Reference](./api.md) - Logger API documentation

## Key Features

### 1. Environment-Aware Configuration

```typescript
const logger = Logger.getInstance(getLoggerConfig());
```

- Development: Debug-level console and file logging
- Production: Info-level structured logging
- Container: Container-optimized logging

### 2. Multiple Transports

- Console Transport: Development and debugging
- File Transport: Persistent logging with rotation
- Container Transport: Docker-compatible logging

### 3. Client-Side Logging

```typescript
import { clientLogger } from "@/lib/logger";

clientLogger.info(LogComponent.WOLF_UI, "User action", {
  action: "button_click",
  component: "SettingsPanel",
});
```

### 4. Security Features

- Automatic sensitive data masking
- Configurable log levels
- Secure transport options

## Components

1. **Logger Core**

   - Singleton logger instance
   - Transport management
   - Log level filtering

2. **Transports**

   - Console output
   - File system
   - Container logging

3. **Client Logger**

   - Browser-compatible logging
   - API endpoint integration
   - Queue management

4. **Configuration**
   - Environment detection
   - Transport configuration
   - Security settings

## Getting Started

1. **Basic Usage**

   ```typescript
   import { logger, LogComponent } from "@/lib/logger";

   await logger.info(LogComponent.WOLF_UI, "Operation completed", {
     operationId: "123",
     status: "success",
   });
   ```

2. **Client-Side Usage**

   ```typescript
   import { clientLogger, LogComponent } from "@/lib/logger";

   clientLogger.info(LogComponent.WOLF_UI, "User interaction", {
     action: "save_preferences",
   });
   ```

3. **Error Logging**
   ```typescript
   try {
     // operation
   } catch (error) {
     await logger.error(LogComponent.WOLF_UI, "Operation failed", error, {
       context: "save_operation",
     });
   }
   ```

## Further Reading

- [Setup Guide](./setup.md) - Detailed setup instructions
- [Standards](./standards.md) - Logging standards and best practices
- [API Reference](./api.md) - Complete API documentation
