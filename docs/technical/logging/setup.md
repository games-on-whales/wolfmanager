# WolfUI Logger Documentation

The WolfUI Logger is a flexible, container-ready logging system designed for Next.js applications. It supports multiple output formats, container environments, and plugin integration.

## Quick Start

```typescript
import { logger, LogComponent } from "@/lib/logger";

// Basic logging
await logger.info(LogComponent.WOLF_UI, "Application started");

// Logging with additional data
await logger.debug(LogComponent.WOLF_UI, "Processing request", {
  method: "GET",
  path: "/api/status",
});

// Error logging with metadata
try {
  throw new Error("Failed to connect");
} catch (error) {
  await logger.error(LogComponent.WOLF_UI, "Connection error", error, {
    attemptCount: 3,
  });
}
```

## Log Levels

The logger supports four log levels:

- `debug`: Detailed information for debugging
- `info`: General information about system operation
- `warn`: Warning messages for potentially harmful situations
- `error`: Error messages for serious problems

## Components

Logs are categorized by component to help with filtering and organization:

- `WOLF_UI`: Frontend application logs
- `WOLF_SERVER`: Backend server logs
- `CONTAINER`: Container-related logs
- `PAIRING`: Device pairing logs
- `AUTH`: Authentication-related logs
- `SYSTEM`: System-level logs

## Usage in Next.js Components

### Server Components

```typescript
// app/page.tsx
import { logger, LogComponent } from "@/lib/logger";

export default async function Page() {
  try {
    await logger.info(LogComponent.WOLF_UI, "Page loaded");
    const data = await fetchData();
    return <PageContent data={data} />;
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Failed to load page", error);
    throw error;
  }
}
```

### Client Components

```typescript
// components/form.tsx
"use client";

import { logger, LogComponent } from "@/lib/logger";

export function Form() {
  const handleSubmit = async (data: FormData) => {
    try {
      await logger.info(LogComponent.WOLF_UI, "Form submission started", {
        formData: data,
      });

      // Process form...
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Form submission failed",
        error,
        { formData: data }
      );
    }
  };
}
```

## Configuration

The logger can be configured through environment variables or the configuration file:

### Environment Variables

```env
# Log Level
LOG_LEVEL=info                 # debug, info, warn, error

# Container Settings
CONTAINER=true                 # Enable container mode
LOG_CONTAINER_ENABLED=true     # Enable container transport
LOG_SERVICE_NAME=wolf-ui       # Service name in logs

# File Output
LOG_FILE_ENABLED=true         # Enable file logging
LOG_FILE_PATH=/logs/app.log   # Log file path
LOG_MAX_FILE_SIZE=5242880     # Max file size in bytes (5MB)
LOG_MAX_FILES=5               # Number of rotated files to keep

# Console Output
LOG_CONSOLE_ENABLED=true      # Enable console logging
LOG_CONSOLE_COLOR=true        # Enable colored output
```

### Configuration Profiles

The logger includes three pre-configured profiles:

1. **Development** (`devConfig`):

   ```typescript
   {
     level: "debug",
     container: { enabled: false },
     file: { enabled: true, path: "./logs/wolf-ui.log" },
     console: { enabled: true, colorize: true }
   }
   ```

2. **Production Container** (`containerConfig`):

   ```typescript
   {
     level: "info",
     container: { enabled: true },
     file: { enabled: false },
     console: { enabled: false }
   }
   ```

3. **Production Non-Container** (`prodConfig`):
   ```typescript
   {
     level: "info",
     container: { enabled: false },
     file: { enabled: true, path: "/var/log/wolf-ui/wolf-ui.log" },
     console: { enabled: true, colorize: false }
   }
   ```

## Docker Integration

### Dockerfile Configuration

```dockerfile
ENV CONTAINER=true
ENV LOG_LEVEL=info
ENV LOG_SERVICE_NAME=wolf-ui
```

### Docker Compose Configuration

```yaml
services:
  wolf-ui:
    environment:
      - CONTAINER=true
      - LOG_LEVEL=info
      - LOG_SERVICE_NAME=wolf-ui
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Viewing Container Logs

```bash
# View all logs
docker logs wolf-ui

# Follow logs
docker logs -f wolf-ui

# Filter by level
docker logs wolf-ui | grep '"level":"error"'

# Filter by component
docker logs wolf-ui | grep '"component":"auth"'
```

## Plugin System

The logger supports plugins for extending functionality. Here's how to create and use a plugin:

```typescript
import { LoggerPlugin, LogEntry } from "@/lib/logger";

class CustomPlugin implements LoggerPlugin {
  name = "custom-plugin";

  async onLog(entry: LogEntry): Promise<void> {
    // Handle log entry
    await sendToExternalService(entry);
  }
}

// Register plugin
const customPlugin = new CustomPlugin();
logger.addPlugin(customPlugin);
```

### Built-in Plugins

#### WolfServer Plugin

Integrates logs from the WolfServer:

```typescript
import { WolfServerPlugin } from "@/lib/logger";

const wolfServerPlugin = new WolfServerPlugin("ws://localhost:8080/logs");
logger.addPlugin(wolfServerPlugin);
```

## Best Practices

1. **Component Selection**:

   - Use the most specific component for your logs
   - Create new components if needed (update `LogComponent` type)

2. **Log Levels**:

   - Use `debug` for detailed troubleshooting
   - Use `info` for general operational events
   - Use `warn` for unusual but recoverable situations
   - Use `error` for serious issues requiring attention

3. **Metadata**:

   - Include relevant context in metadata
   - Don't include sensitive information
   - Structure metadata consistently

4. **Error Handling**:

   - Always log errors with stack traces
   - Include relevant context in metadata
   - Use try/catch blocks appropriately

5. **Performance**:
   - Log asynchronously (all methods return Promises)
   - Use appropriate log levels to control output
   - Consider log rotation settings in production

## Security Considerations

1. **Sensitive Data**:

   - Never log passwords or secrets
   - Mask sensitive data in metadata
   - Be careful with user information

2. **File Permissions**:

   - Ensure log files have appropriate permissions
   - Rotate logs regularly
   - Monitor disk usage

3. **Container Security**:
   - Use appropriate Docker logging drivers
   - Monitor log volume
   - Consider log aggregation services

## Troubleshooting

Common issues and solutions:

1. **Logs not appearing**:

   - Check LOG_LEVEL setting
   - Verify transport configuration
   - Check file permissions

2. **High disk usage**:

   - Adjust rotation settings
   - Monitor log volume
   - Consider log aggregation

3. **Performance issues**:
   - Reduce debug logging in production
   - Adjust batch size for file transport
   - Monitor logging impact

## Examples

### API Route Logging

```typescript
// app/api/status/route.ts
import { logger, LogComponent } from "@/lib/logger";

export async function GET() {
  await logger.info(LogComponent.WOLF_UI, "API status check", {
    endpoint: "/api/status",
  });

  return Response.json({ status: "ok" });
}
```

### Error Boundary Logging

```typescript
"use client";

import { logger, LogComponent } from "@/lib/logger";

export class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      LogComponent.WOLF_UI,
      "React error boundary caught error",
      error,
      { errorInfo }
    );
  }
}
```

### Authentication Logging

```typescript
// lib/auth.ts
import { logger, LogComponent } from "@/lib/logger";

async function handleLogin(credentials: Credentials) {
  try {
    await logger.info(LogComponent.AUTH, "Login attempt", {
      username: credentials.username,
    });

    // Login logic...
  } catch (error) {
    await logger.error(LogComponent.AUTH, "Login failed", error, {
      username: credentials.username,
    });
    throw error;
  }
}
```
