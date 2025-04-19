# WolfUI Data Flow Diagrams

This document provides detailed data flow diagrams for key processes in the WolfUI system.

## Authentication and Authorization

### Login Flow

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant NextAuth
    participant AuthLib
    participant ConfigService
    participant TOMLFile

    User->>LoginForm: Enter credentials
    LoginForm->>NextAuth: POST /api/auth/[...nextauth]
    NextAuth->>AuthLib: Call authorize callback
    AuthLib->>ConfigService: validateUser(username, password)
    ConfigService->>TOMLFile: loadConfig(decrypt=false)
    TOMLFile-->>ConfigService: Return config data
    ConfigService->>ConfigService: Compare password hash

    alt Valid Credentials
        ConfigService-->>AuthLib: Return user object
        AuthLib-->>NextAuth: Return user object
        NextAuth->>NextAuth: Create session & JWT
        NextAuth-->>LoginForm: Set cookies & redirect
        LoginForm-->>User: Redirect to dashboard
    else Invalid Credentials
        ConfigService-->>AuthLib: Return null
        AuthLib-->>NextAuth: Return null
        NextAuth-->>LoginForm: Return error
        LoginForm-->>User: Display error message
    end
```

### Session Validation Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant NextAuth
    participant AuthLib

    Client->>Middleware: Request protected route
    Middleware->>NextAuth: Validate session
    NextAuth->>AuthLib: Call jwt callback

    alt Valid Session
        AuthLib-->>NextAuth: Return valid JWT
        NextAuth-->>Middleware: Return session

        alt Admin-only Route
            Middleware->>Middleware: Check user.role === "admin"

            alt Is Admin
                Middleware-->>Client: Allow request
            else Not Admin
                Middleware-->>Client: Redirect to /error/forbidden
            end
        else Regular Protected Route
            Middleware-->>Client: Allow request
        end
    else Invalid/Expired Session
        AuthLib-->>NextAuth: Return JWT with error
        NextAuth-->>Middleware: Return error
        Middleware-->>Client: Redirect to /error/unauthorized or /error/expired
    end
```

## Device Pairing

### Pending Pair Requests Flow

```mermaid
sequenceDiagram
    participant PairPage
    participant PendingRequests
    participant WolfPairApi
    participant ApiRoute
    participant WolfSocket
    participant WolfBackend

    PairPage->>PendingRequests: Render component
    PendingRequests->>WolfPairApi: getPendingRequests()
    WolfPairApi->>ApiRoute: GET /api/wolf/pair/requests
    ApiRoute->>WolfSocket: callWolfApi("/pair/requests")
    WolfSocket->>WolfBackend: Unix socket request
    WolfBackend-->>WolfSocket: Return pending requests
    WolfSocket-->>ApiRoute: Return response
    ApiRoute-->>WolfPairApi: Return formatted requests
    WolfPairApi-->>PendingRequests: Return pending requests
    PendingRequests-->>PairPage: Display pending requests
```

### Pairing Process Flow

```mermaid
sequenceDiagram
    participant User
    participant PairDialog
    participant ServerAction
    participant ConfigService
    participant WolfSocket
    participant WolfBackend
    participant TOMLFile

    User->>PairDialog: Select request & enter PIN
    PairDialog->>ServerAction: pairAndAddClientAction(pin, friendlyName, pair_secret)
    ServerAction->>ConfigService: loadConfig(decrypt=true)
    ConfigService->>TOMLFile: Read config
    TOMLFile-->>ConfigService: Return config
    ConfigService-->>ServerAction: Return config

    ServerAction->>WolfSocket: callWolfApi("/pair/client", { pin, pair_secret })
    WolfSocket->>WolfBackend: Unix socket request
    WolfBackend-->>WolfSocket: Return pairing result
    WolfSocket-->>ServerAction: Return response

    alt Pairing Successful
        ServerAction->>WolfSocket: callWolfApi("/clients")
        WolfSocket->>WolfBackend: Unix socket request
        WolfBackend-->>WolfSocket: Return client list
        WolfSocket-->>ServerAction: Return client list
        ServerAction->>ServerAction: Find new device ID

        ServerAction->>ConfigService: loadConfig(decrypt=true)
        ConfigService->>TOMLFile: Read config
        TOMLFile-->>ConfigService: Return config
        ConfigService-->>ServerAction: Return config

        ServerAction->>ServerAction: Add client to config
        ServerAction->>ConfigService: saveConfig(updatedConfig)
        ConfigService->>TOMLFile: Write updated config
        TOMLFile-->>ConfigService: Confirm write
        ConfigService-->>ServerAction: Confirm save

        ServerAction-->>PairDialog: Return success + client data
        PairDialog-->>User: Show success message & update UI
    else Pairing Failed
        ServerAction-->>PairDialog: Return error
        PairDialog-->>User: Show error message
    end
```

## Configuration Management

### SteamGridDB Settings Update Flow

```mermaid
sequenceDiagram
    participant User
    participant SettingsComponent
    participant ServerAction
    participant ConfigService
    participant TOMLFile

    User->>SettingsComponent: Update settings & submit form
    SettingsComponent->>ServerAction: updateSteamGridDbSettings(formData)

    ServerAction->>ServerAction: Check admin role

    alt Not Admin
        ServerAction-->>SettingsComponent: Return auth error
        SettingsComponent-->>User: Show error toast
    else Is Admin
        ServerAction->>ServerAction: Validate form data

        alt Invalid Data
            ServerAction-->>SettingsComponent: Return validation errors
            SettingsComponent-->>User: Show validation errors
        else Valid Data
            ServerAction->>ConfigService: loadConfig(decrypt=true)
            ConfigService->>TOMLFile: Read config
            TOMLFile-->>ConfigService: Return config
            ConfigService-->>ServerAction: Return config

            ServerAction->>ServerAction: Update config object
            ServerAction->>ConfigService: saveConfig(updatedConfig)
            ConfigService->>ConfigService: Encrypt sensitive data
            ConfigService->>TOMLFile: Write updated config
            TOMLFile-->>ConfigService: Confirm write
            ConfigService-->>ServerAction: Confirm save

            ServerAction-->>SettingsComponent: Return success + updated status
            SettingsComponent-->>User: Show success toast & update UI
        end
    end
```

## Task Scheduling and Execution

### Task Scheduler Initialization Flow

```mermaid
sequenceDiagram
    participant AppLayout
    participant Scheduler
    participant TaskMap
    participant ConfigService
    participant TOMLFile

    AppLayout->>Scheduler: startScheduler()
    Scheduler->>Scheduler: discoverAndInitializeTasks()
    Scheduler->>TaskMap: Get available task definitions
    TaskMap-->>Scheduler: Return task definitions

    Scheduler->>ConfigService: loadTasksConfig()
    ConfigService->>TOMLFile: Read tasks.toml
    TOMLFile-->>ConfigService: Return tasks config
    ConfigService-->>Scheduler: Return tasks config

    loop For each task definition
        Scheduler->>Scheduler: Check if task exists in config

        alt Task not in config
            Scheduler->>ConfigService: addOrUpdateTaskDefinition(taskInfo)
            ConfigService->>TOMLFile: Update tasks.toml
            TOMLFile-->>ConfigService: Confirm update
            ConfigService-->>Scheduler: Return updated task
        end

        alt Task is enabled
            Scheduler->>Scheduler: scheduleTask(taskState, definition)
            Scheduler->>Scheduler: Create cron job
            Scheduler->>Scheduler: Store in scheduledJobs map
        end
    end

    Scheduler-->>AppLayout: Scheduler initialized
```

### Task Execution Flow

```mermaid
sequenceDiagram
    participant Scheduler
    participant TaskDefinition
    participant ConfigService
    participant ExternalAPI
    participant TOMLFile

    Scheduler->>Scheduler: Cron trigger for task

    Scheduler->>ConfigService: updateTaskState(id, { status: "RUNNING" })
    ConfigService->>TOMLFile: Update tasks.toml
    TOMLFile-->>ConfigService: Confirm update
    ConfigService-->>Scheduler: Confirm update

    Scheduler->>ConfigService: loadTasksConfig()
    ConfigService->>TOMLFile: Read tasks.toml
    TOMLFile-->>ConfigService: Return tasks config
    ConfigService-->>Scheduler: Return current task state

    Scheduler->>TaskDefinition: execute(logger, taskState)

    alt Task: syncSteamLibrary
        TaskDefinition->>ConfigService: loadConfig(decrypt=true)
        ConfigService->>TOMLFile: Read config
        TOMLFile-->>ConfigService: Return config
        ConfigService-->>TaskDefinition: Return config with Steam credentials

        TaskDefinition->>ExternalAPI: Steam API request
        ExternalAPI-->>TaskDefinition: Return game library data

        TaskDefinition->>ConfigService: Write Steam library to TOML
        ConfigService->>TOMLFile: Write library data
        TOMLFile-->>ConfigService: Confirm write
        ConfigService-->>TaskDefinition: Confirm save
    else Task: fetchSteamGridDbArtwork
        TaskDefinition->>ConfigService: loadConfig(decrypt=true)
        ConfigService->>TOMLFile: Read config
        TOMLFile-->>ConfigService: Return config
        ConfigService-->>TaskDefinition: Return config with API key

        TaskDefinition->>ExternalAPI: SteamGridDB API request
        ExternalAPI-->>TaskDefinition: Return artwork data

        TaskDefinition->>TaskDefinition: Download and store artwork
        TaskDefinition->>ConfigService: Update artwork paths in TOML
        ConfigService->>TOMLFile: Write updated paths
        TOMLFile-->>ConfigService: Confirm write
        ConfigService-->>TaskDefinition: Confirm save
    end

    TaskDefinition-->>Scheduler: Task completed

    alt Task Succeeded
        Scheduler->>ConfigService: updateTaskState(id, { status: "IDLE", last_run_at: now })
        ConfigService->>TOMLFile: Update tasks.toml
        TOMLFile-->>ConfigService: Confirm update
        ConfigService-->>Scheduler: Confirm update
    else Task Failed
        Scheduler->>ConfigService: updateTaskState(id, { status: "ERROR", last_run_at: now })
        ConfigService->>TOMLFile: Update tasks.toml
        TOMLFile-->>ConfigService: Confirm update
        ConfigService-->>Scheduler: Confirm update
    end
```

## Logging System

### Server-Side Logging Flow

```mermaid
sequenceDiagram
    participant Component
    participant Logger
    participant ConsoleTransport
    participant FileTransport
    participant ContainerTransport
    participant LogFile

    Component->>Logger: logger.info(component, message, metadata)
    Logger->>Logger: Create log entry
    Logger->>Logger: Check log level

    par Console Transport
        Logger->>ConsoleTransport: log(entry)
        ConsoleTransport->>ConsoleTransport: Format entry
        ConsoleTransport->>ConsoleTransport: Write to console
    and File Transport
        Logger->>FileTransport: log(entry)
        FileTransport->>FileTransport: Format entry
        FileTransport->>LogFile: Write to file
        LogFile-->>FileTransport: Confirm write
        FileTransport->>FileTransport: Check file size

        alt File size exceeds limit
            FileTransport->>FileTransport: Rotate logs
        end
    and Container Transport
        Logger->>ContainerTransport: log(entry)
        ContainerTransport->>ContainerTransport: Format entry
        ContainerTransport->>ContainerTransport: Write to stdout/stderr
    end

    Logger-->>Component: Logging complete
```

### Client-Side Logging Flow

```mermaid
sequenceDiagram
    participant ClientComponent
    participant ClientLogger
    participant LogQueue
    participant ServerAction
    participant Logger

    ClientComponent->>ClientLogger: clientLogger.info(component, message, metadata)
    ClientLogger->>ClientLogger: Create log entry
    ClientLogger->>LogQueue: Add entry to queue

    alt Queue Processing Interval
        LogQueue->>ServerAction: createLogEntry(entry)
        ServerAction->>ServerAction: Validate entry
        ServerAction->>Logger: Forward to server logger
        Logger->>Logger: Process log (as in server flow)
        Logger-->>ServerAction: Logging complete
        ServerAction-->>LogQueue: Confirm log processed
    end

    ClientLogger-->>ClientComponent: Logging initiated
```

## Wolf Backend Communication

### Wolf API Request Flow

```mermaid
sequenceDiagram
    participant Component
    participant ApiRoute
    participant WolfSchema
    participant WolfSocket
    participant UnixSocket
    participant WolfBackend

    Component->>ApiRoute: Request to /api/wolf/[...path]
    ApiRoute->>WolfSchema: isValidWolfEndpoint(endpoint, method)
    WolfSchema-->>ApiRoute: Endpoint validation result

    alt Invalid Endpoint
        ApiRoute-->>Component: Return 404 Not Found
    else Valid Endpoint
        ApiRoute->>WolfSocket: callWolfApi(endpoint, options)
        WolfSocket->>WolfSocket: Check dev container
        WolfSocket->>WolfSocket: Check socket permissions

        WolfSocket->>UnixSocket: Create HTTP request over Unix socket
        UnixSocket->>WolfBackend: Send request
        WolfBackend-->>UnixSocket: Return response
        UnixSocket-->>WolfSocket: Return data

        alt JSON Response
            WolfSocket->>WolfSocket: Parse JSON
            WolfSocket-->>ApiRoute: Return parsed object
        else Text Response
            WolfSocket-->>ApiRoute: Return raw text
        end

        ApiRoute-->>Component: Return response
    end
```

## External API Integration

### Steam Library Sync Flow

```mermaid
sequenceDiagram
    participant Task
    participant SteamService
    participant SteamCache
    participant SteamAPI
    participant ConfigService
    participant TOMLFile

    Task->>ConfigService: loadConfig(decrypt=true)
    ConfigService->>TOMLFile: Read config
    TOMLFile-->>ConfigService: Return config
    ConfigService-->>Task: Return config with credentials

    loop For each user with Steam credentials
        Task->>SteamService: getOwnedGames(credentials)

        SteamService->>SteamCache: getCachedGames(userId)
        SteamCache-->>SteamService: Return cached games or null

        alt Cache Hit
            SteamService-->>Task: Return cached games
        else Cache Miss
            SteamService->>SteamAPI: Request owned games
            SteamAPI-->>SteamService: Return games data

            SteamService->>SteamCache: cacheGames(userId, games)
            SteamService-->>Task: Return games data
        end

        Task->>Task: Process games data
    end

    Task->>ConfigService: Write library data to TOML
    ConfigService->>TOMLFile: Write library data
    TOMLFile-->>ConfigService: Confirm write
    ConfigService-->>Task: Confirm save
```

### SteamGridDB Artwork Fetch Flow

```mermaid
sequenceDiagram
    participant Task
    participant ConfigService
    participant TOMLFile
    participant SteamGridDbClient
    participant ApiRoute
    participant SteamGridDbAPI
    participant Filesystem

    Task->>ConfigService: loadConfig(decrypt=true)
    ConfigService->>TOMLFile: Read config
    TOMLFile-->>ConfigService: Return config with API key
    ConfigService-->>Task: Return config

    alt SteamGridDB Enabled
        Task->>TOMLFile: Read Steam library data
        TOMLFile-->>Task: Return library data

        loop For each game
            Task->>SteamGridDbClient: getAndStoreSteamArtwork(appId)
            SteamGridDbClient->>ApiRoute: GET /api/metadata/steamgriddb/grid/{appId}
            ApiRoute->>SteamGridDbAPI: API request with key
            SteamGridDbAPI-->>ApiRoute: Return artwork metadata
            ApiRoute-->>SteamGridDbClient: Return artwork data

            SteamGridDbClient->>SteamGridDbClient: Select best image
            SteamGridDbClient->>SteamGridDbAPI: Download image
            SteamGridDbAPI-->>SteamGridDbClient: Return image data

            SteamGridDbClient->>Filesystem: Write image to assets directory
            Filesystem-->>SteamGridDbClient: Confirm write

            SteamGridDbClient-->>Task: Return artwork paths
            Task->>Task: Update game data with artwork paths
        end

        Task->>ConfigService: Write updated game data to TOML
        ConfigService->>TOMLFile: Write updated data
        TOMLFile-->>ConfigService: Confirm write
        ConfigService-->>Task: Confirm save
    else SteamGridDB Disabled
        Task->>Task: Log skipped due to disabled integration
    end
```
