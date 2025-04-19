# WolfUI Component Interactions

This document provides a detailed breakdown of the major components in the WolfUI system and how they interact with each other.

## Core Components

### 1. Next.js App Router Structure

The application follows the Next.js App Router structure, which organizes code by routes and features:

```
src/
  app/                  # App Router root
    api/                # API Routes
      auth/             # Authentication endpoints
      libraries/        # Library management (Steam, etc.)
      metadata/         # Metadata providers (SteamGridDB)
      system/           # System operations
      tasks/            # Task management
      user/             # User profile operations
      users/            # User management (admin)
      wolf/             # Wolf backend proxy
    auth/               # Auth pages and actions
    dashboard/          # Dashboard pages
    first-time-setup/   # Setup wizard
    login/              # Login page
    pair/               # Device pairing
    settings/           # Settings pages
      account/          # Account settings
      api-test/         # API testing console
      metadata-providers/ # Metadata provider settings
      tasks/            # Task management
      wolf-logs/        # Wolf logs viewer
    users/              # User management
  components/           # Shared components
    auth/               # Auth-related components
    errors/             # Error handling components
    layout/             # Layout components
    providers/          # Context providers
    ui/                 # UI components
    wolf-logs/          # Log viewer components
  lib/                  # Core libraries
    actions/            # Shared server actions
    api/                # API client libraries
    hooks/              # React hooks
    logger/             # Logging system
    services/           # Service implementations
    steam/              # Steam API integration
    steamgriddb/        # SteamGridDB integration
    tasks/              # Background tasks
    validation/         # Validation schemas
```

### 2. Server Components vs. Client Components

The application uses a mix of Server and Client Components:

- **Server Components (`page.tsx`, etc.):**

  - Render on the server
  - Can directly access server resources (filesystem, config, etc.)
  - Cannot use React hooks or browser APIs
  - Reduce client-side JavaScript
  - Handle data fetching and initial rendering

- **Client Components (marked with `"use client"`):**
  - Render on the client
  - Can use React hooks, event handlers, and browser APIs
  - Handle interactivity and state management
  - Make requests to Server Actions or API Routes

### 3. Server Actions

Server Actions (typically in `actions.ts` files) are server-side functions that can be called directly from Client Components. They handle data mutations and business logic:

```typescript
// Example from src/app/settings/metadata-providers/actions.ts
export async function updateSteamGridDbSettings(
  prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return {
      message: "Unauthorized",
      success: false,
      errors: { _form: ["You must be an admin to update settings"] },
    };
  }

  // Process form data
  const enabled = formData.get("enabled") === "on";
  const apiKey = (formData.get("apiKey") as string) || undefined;

  // Validation
  try {
    // Load config
    const config = loadConfig(true);

    // Update config
    if (!config.metadataProviders) {
      config.metadataProviders = {};
    }
    if (!config.metadataProviders.steamgridDb) {
      config.metadataProviders.steamgridDb = { enabled: false, apiKey: "" };
    }

    config.metadataProviders.steamgridDb.enabled = enabled;
    if (apiKey) {
      config.metadataProviders.steamgridDb.apiKey = apiKey;
    }

    // Save config
    saveConfig(config);

    // Return success
    return {
      message: "Settings updated successfully",
      success: true,
      updatedStatus: {
        enabled,
        isApiKeySet: Boolean(
          apiKey || config.metadataProviders.steamgridDb.apiKey
        ),
      },
    };
  } catch (error) {
    // Handle errors
    return {
      message: "Failed to update settings",
      success: false,
      errors: { _form: [(error as Error).message] },
    };
  }
}
```

### 4. API Routes

API Routes (in `src/app/api/`) handle traditional HTTP requests and often serve as proxies to external services or the Wolf backend:

```typescript
// Example from src/app/api/metadata/steamgriddb/[type]/[appId]/route.ts
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Load config to get API key
  const config = loadConfig(true);

  // Make request to SteamGridDB
  try {
    const response = await fetch(`https://www.steamgriddb.com/api/v2/...`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch artwork" },
      { status: 500 }
    );
  }
}
```

### 5. Configuration Service (`src/lib/config.ts`)

The configuration service is a central module that handles reading, writing, and managing TOML configuration files:

```typescript
// Example functions from src/lib/config.ts
export function loadConfig(decryptSensitiveData: boolean = false): Config {
  try {
    const configPath = path.resolve(process.cwd(), "config/default.toml");
    const configContent = fs.readFileSync(configPath, "utf8");
    const parsedConfig = TOML.parse(configContent) as Config;

    // Decrypt sensitive data if requested
    if (decryptSensitiveData) {
      // Decrypt user data
      for (const username in parsedConfig.users) {
        const user = parsedConfig.users[username];
        if (user.steam_api_key && isEncryptedString(user.steam_api_key)) {
          user.steam_api_key = decrypt(user.steam_api_key);
        }
      }

      // Decrypt SteamGridDB API key
      if (
        parsedConfig.metadataProviders?.steamgridDb?.apiKey &&
        isEncryptedString(parsedConfig.metadataProviders.steamgridDb.apiKey)
      ) {
        parsedConfig.metadataProviders.steamgridDb.apiKey = decrypt(
          parsedConfig.metadataProviders.steamgridDb.apiKey
        );
      }
    }

    return parsedConfig;
  } catch (error) {
    // Handle errors
    logger.error(LogComponent.SYSTEM, "Failed to load config", error);
    throw error;
  }
}

export function saveConfig(config: Config): void {
  try {
    const configPath = path.resolve(process.cwd(), "config/default.toml");

    // Create a deep copy and encrypt sensitive data
    const configToSave = JSON.parse(JSON.stringify(config));

    // Encrypt user data
    for (const username in configToSave.users) {
      const user = configToSave.users[username];
      if (user.steam_api_key && !isEncryptedString(user.steam_api_key)) {
        user.steam_api_key = encrypt(user.steam_api_key);
      }
    }

    // Encrypt SteamGridDB API key
    if (
      configToSave.metadataProviders?.steamgridDb?.apiKey &&
      !isEncryptedString(configToSave.metadataProviders.steamgridDb.apiKey)
    ) {
      configToSave.metadataProviders.steamgridDb.apiKey = encrypt(
        configToSave.metadataProviders.steamgridDb.apiKey
      );
    }

    // Convert to TOML and save
    const tomlContent = iarnaTOML.stringify(configToSave);
    fs.writeFileSync(configPath, tomlContent, "utf8");
  } catch (error) {
    // Handle errors
    logger.error(LogComponent.SYSTEM, "Failed to save config", error);
    throw error;
  }
}
```

### 6. Wolf Socket Communication (`src/lib/wolf-socket.ts` and `src/app/api/wolf/lib/wolf-socket.server.ts`)

The application communicates with the Wolf backend via a Unix Domain Socket:

```typescript
// Example from src/app/api/wolf/lib/wolf-socket.server.ts
export async function callWolfApi(
  endpoint: string,
  options: WolfApiOptions = {}
): Promise<unknown> {
  try {
    // Check if we're in a dev container
    await checkDevContainer();

    // Check socket permissions
    await checkSocketPermissions();

    // Create socket path
    const socketPath = "/var/run/wolf/wolf.sock";

    // Create request options
    const requestOptions = {
      method: options.method || "GET",
      socketPath,
      path: endpoint,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Make request
    return new Promise((resolve, reject) => {
      const req = http.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            // Parse response
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            // Handle parsing error
            resolve(data);
          }
        });
      });

      req.on("error", (error: SystemError) => {
        // Handle connection error
        reject(error);
      });

      // Write request body if present
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  } catch (error) {
    // Handle errors
    logger.error(LogComponent.WOLF_UI, "Failed to call Wolf API", error);
    throw error;
  }
}
```

### 7. Task Scheduler (`src/lib/scheduler.ts`)

The task scheduler manages background tasks using `node-cron`:

```typescript
// Example from src/lib/scheduler.ts
export async function startScheduler(): Promise<void> {
  try {
    // Discover and initialize tasks
    await discoverAndInitializeTasks();

    logger.info(LogComponent.SYSTEM, "Task scheduler started");
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to start scheduler", error);
    throw error;
  }
}

function scheduleTask(taskState: TaskState, definition: TaskDefinition): void {
  // Stop existing job if it exists
  stopScheduledTask(taskState.id);

  // Create new cron job
  const job = cron.schedule(taskState.schedule, async () => {
    try {
      // Calculate next run time
      let nextRunTime: string | null;
      try {
        const interval = CronExpressionParser.parseExpression(
          taskState.schedule
        );
        nextRunTime = interval.next().toISOString();
      } catch (error) {
        nextRunTime = null;
      }

      // Update status to RUNNING
      await updateTaskState(taskState.id, {
        status: "RUNNING",
        next_run_at: nextRunTime,
      });

      // Get latest task state
      const config = await loadTasksConfig();
      const currentState = config.tasks.find((t) => t.id === taskState.id);

      if (!currentState) {
        throw new Error(`Task ${taskState.id} not found`);
      }

      // Execute task
      await definition.execute(logger, currentState);

      // Update status on success
      await updateTaskState(taskState.id, {
        status: "IDLE",
        last_run_at: new Date().toISOString(),
      });
    } catch (error) {
      // Update status on error
      await updateTaskState(taskState.id, {
        status: "ERROR",
        last_run_at: new Date().toISOString(),
      });

      logger.error(
        LogComponent.SYSTEM,
        `Task ${taskState.name} (${taskState.id}) failed`,
        error
      );
    }
  });

  // Store job in memory
  scheduledJobs.set(taskState.id, {
    job,
    taskState,
  });

  // Start job if enabled
  if (taskState.is_enabled) {
    job.start();
  }
}
```

### 8. Logging System (`src/lib/logger/`)

The logging system provides structured logging with different transports:

```typescript
// Example from src/lib/logger/logger.ts
export class Logger {
  private static instance: Logger;
  private transports: LogTransport[] = [];
  private plugins: Map<string, LoggerPlugin> = new Map();
  private config: LoggerConfig;

  private constructor(config: Partial<LoggerConfig> = {}) {
    // Initialize config
    this.config = {
      level: config.level || LogLevel.INFO,
      console: {
        enabled: config.console?.enabled ?? true,
        level: config.console?.level || LogLevel.INFO,
      },
      file: {
        enabled: config.file?.enabled ?? false,
        path: config.file?.path,
        level: config.file?.level || LogLevel.INFO,
        maxSize: config.file?.maxSize || 5 * 1024 * 1024,
        maxFiles: config.file?.maxFiles || 5,
        format: config.file?.format || "json",
      },
      container: {
        enabled: config.container?.enabled ?? false,
        level: config.container?.level || LogLevel.INFO,
        serviceName: config.container?.serviceName || "wolf-ui",
      },
    };

    // Initialize transports
    this.initializeTransports();
  }

  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // Skip if level is too low
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Map transports to promises
    const transportPromises = this.transports.map((transport) => ({
      transport,
      promise: transport.log(entry).catch((error) => error),
    }));

    // Map plugins to promises
    const pluginPromises = Array.from(this.plugins.values()).map((plugin) => ({
      plugin,
      promise: plugin.onLog(entry).catch((error) => error),
    }));

    // Wait for all promises
    const transportResults = await Promise.allSettled(
      transportPromises.map((t) => t.promise)
    );

    const pluginResults = await Promise.allSettled(
      pluginPromises.map((p) => p.promise)
    );

    // Handle failures
    const failedTransports = transportResults
      .map((result, index) => {
        if (result.status === "rejected") {
          return {
            transport: transportPromises[index].transport,
            reason: result.reason,
          };
        }
        return null;
      })
      .filter(Boolean);

    // If any transports failed, log using successful transports
    if (failedTransports.length > 0) {
      // Get successful transports
      const successfulTransports = transportPromises
        .filter((_, index) => transportResults[index].status === "fulfilled")
        .map((t) => t.transport);

      // If all transports failed, log to console as last resort
      if (successfulTransports.length === 0) {
        console.error("All log transports failed:", failedTransports);
        return;
      }

      // Log each transport failure
      for (const failure of failedTransports) {
        const failureEntry: LogEntry = {
          timestamp: new Date(),
          level: "error",
          component: LogComponent.SYSTEM,
          message: `Log transport failed: ${
            failure.reason?.message || "Unknown error"
          }`,
          raw:
            failure.reason instanceof Error
              ? failure.reason
              : new Error(String(failure.reason)),
          metadata: {
            originalEntry: {
              level: entry.level,
              component: entry.component,
              message: entry.message.substring(0, 100),
            },
          },
        };

        // Send to successful transports
        const failurePromises = successfulTransports.map((transport) =>
          transport.log(failureEntry).catch((error) => {
            // Fallback for nested failure
            console.error("Failed to log transport failure:", error);
          })
        );

        await Promise.allSettled(failurePromises);
      }
    }
  }

  public async debug(
    component: LogComponent,
    message: string,
    raw?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.writeLog({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      component,
      message,
      raw,
      metadata,
    });
  }

  // Other log level methods (info, warn, error) follow the same pattern
}
```

## Component Interaction Examples

### Example 1: User Authentication Flow

1. User enters credentials in the login form (`src/app/login/components/login-client.tsx`)
2. Form submits to NextAuth.js endpoint (`src/app/api/auth/[...nextauth]/route.ts`)
3. NextAuth calls the `authorize` callback in `src/lib/auth.ts`
4. The callback uses `validateUser` from `src/lib/config.ts` to check credentials
5. If valid, NextAuth creates a session and JWT
6. The user is redirected to the dashboard

### Example 2: Device Pairing Flow

1. User navigates to the Pair page (`src/app/pair/page.tsx`)
2. The page loads pending pair requests from Wolf backend via `wolfPairApi.getPendingRequests()`
3. User selects a request and enters a PIN in the `PairDialog` component
4. The component calls the `pairAndAddClientAction` Server Action
5. The action:
   - Validates the PIN
   - Calls the Wolf backend via Unix socket to pair the device
   - Fetches the updated client list to find the new device ID
   - Updates the TOML configuration to store the paired device
   - Returns success/error to the client
6. The UI updates to show the paired device in the list

### Example 3: Background Task Execution

1. The application starts and initializes the scheduler in `src/app/layout.tsx`
2. The scheduler discovers tasks from `src/lib/tasks/` and loads their schedules from `config/tasks.toml`
3. When a task is due to run:
   - The scheduler updates the task state to "RUNNING"
   - It calls the task's `execute` function (e.g., `syncSteamLibrary.execute`)
   - The task performs its work (e.g., fetching Steam library data)
   - The task updates the TOML configuration as needed
   - The scheduler updates the task state to "IDLE" or "ERROR"
4. The task status is visible in the Tasks settings page
