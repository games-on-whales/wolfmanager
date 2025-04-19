# WolfUI System Architecture

## 1. High-Level Overview

WolfUI serves as a web-based administration interface for the Wolf game streaming backend. It allows users (including administrators) to manage settings, users, devices, background tasks, and view logs.

The application is built using modern web technologies, primarily:

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI:** React (Server & Client Components), Shadcn UI, Tailwind CSS
- **Authentication:** NextAuth.js (Credentials Provider)
- **Data Storage:** TOML files (`config/default.toml`, `config/tasks.toml`, etc.) managed via a custom configuration library (`src/lib/config.ts`). Sensitive data within TOML files is encrypted.
- **Backend Communication:** Interacts with the local Wolf backend primarily via a Unix Domain Socket.
- **External Services:** Interfaces with Steam API and SteamGridDB (proxied via internal API) for game library and metadata management.
- **Background Tasks:** A built-in scheduler (`node-cron`) runs tasks like syncing the Steam library and fetching artwork.

## 2. Component Interactions

The system follows the Next.js App Router paradigm, utilizing Server Components, Client Components, API Routes, and Server Actions.

```mermaid
sequenceDiagram
    participant User Browser (Client Components)
    participant Next.js Server (Server Components, API Routes, Server Actions)
    participant Lib Functions (`src/lib/*`)
    participant Config Service (`src/lib/config.ts`)
    participant TOML Files (`config/*.toml`)
    participant Wolf Backend (Unix Socket)
    participant External APIs (Steam, SteamGridDB)
    participant Task Scheduler (`src/lib/scheduler.ts`)

    User Browser (Client Components)->>Next.js Server (Server Components, API Routes, Server Actions): HTTP Request (Page Load / API Call / Action)
    alt Page Load / Server Component Render
        Next.js Server (Server Components, API Routes, Server Actions)->>Lib Functions (`src/lib/*`): Call utility/service functions
        Lib Functions (`src/lib/*`)->>Config Service (`src/lib/config.ts`): Read config data
        Config Service (`src/lib/config.ts`)->>TOML Files (`config/*.toml`): Read file
        TOML Files (`config/*.toml`)-->>Config Service (`src/lib/config.ts`): Return TOML content
        Config Service (`src/lib/config.ts`)-->>Lib Functions (`src/lib/*`): Return parsed config
        Lib Functions (`src/lib/*`)-->>Next.js Server (Server Components, API Routes, Server Actions): Return data
        Next.js Server (Server Components, API Routes, Server Actions)-->>User Browser (Client Components): Send HTML / Data
    else API Route / Server Action
        Next.js Server (Server Components, API Routes, Server Actions)->>Lib Functions (`src/lib/*`): Call action/service logic
        alt Read Operation
            Lib Functions (`src/lib/*`)->>Config Service (`src/lib/config.ts`): Read config data
            Config Service (`src/lib/config.ts`)->>TOML Files (`config/*.toml`): Read file
            TOML Files (`config/*.toml`)-->>Config Service (`src/lib/config.ts`): Return TOML content
            Config Service (`src/lib/config.ts`)-->>Lib Functions (`src/lib/*`): Return parsed config
        else Write Operation
            Lib Functions (`src/lib/*`)->>Config Service (`src/lib/config.ts`): Update config data
            Config Service (`src/lib/config.ts`)->>TOML Files (`config/*.toml`): Write file (with encryption)
            TOML Files (`config/*.toml`)-->>Config Service (`src/lib/config.ts`): Confirm write
            Config Service (`src/lib/config.ts`)-->>Lib Functions (`src/lib/*`): Confirm update
        else Wolf Backend Interaction
            Lib Functions (`src/lib/*`)->>Wolf Backend (Unix Socket): Send request via socket
            Wolf Backend (Unix Socket)-->>Lib Functions (`src/lib/*`): Return response
        else External API Interaction
             Lib Functions (`src/lib/*`)->>External APIs (Steam, SteamGridDB): HTTP Request
             External APIs (Steam, SteamGridDB)-->>Lib Functions (`src/lib/*`): Return response
        end
        Lib Functions (`src/lib/*`)-->>Next.js Server (Server Components, API Routes, Server Actions): Return result/status
        Next.js Server (Server Components, API Routes, Server Actions)-->>User Browser (Client Components): Send JSON Response / Action Result
    end

    %% Background Tasks
    Task Scheduler (`src/lib/scheduler.ts`) ->> Lib Functions (`src/lib/*`): Execute Task (e.g., syncSteamLibrary)
    Lib Functions (`src/lib/*`) ->> Config Service (`src/lib/config.ts`): Read/Write Config
    Lib Functions (`src/lib/*`) ->> External APIs (Steam, SteamGridDB): Fetch Data
    Lib Functions (`src/lib/*`) ->> Task Scheduler (`src/lib/scheduler.ts`): Update Task Status
```

**Key Interactions:**

- **Frontend (Client Components):** Renders UI, handles user input, calls Server Actions or API Routes. Uses `useSession` for auth state.
- **Next.js Server:**
  - **Server Components:** Render on the server, can directly access server-side resources like `lib` functions and `config.ts`.
  - **API Routes (`src/app/api`):** Handle traditional RESTful requests, often used for data fetching or operations proxied to external/backend services. Authenticated via session.
  - **Server Actions (`actions.ts`):** RPC-style functions callable directly from Client or Server Components. Handle mutations and business logic. Authenticated via session and often include role checks.
- **Lib Functions (`src/lib`):** Contain core business logic, service interactions (Steam, SteamGridDB, Wolf Socket), configuration management wrappers, authentication helpers, logging, scheduling, etc.
- **Config Service (`src/lib/config.ts`):** Centralized module for reading, writing, and managing TOML configuration files. Handles parsing, validation, encryption/decryption of sensitive fields.
- **TOML Files:** Act as the primary data store for users, clients, tasks, and settings.
- **Wolf Backend:** Communicated with via a Unix Domain Socket for operations like device pairing, client management, and potentially other backend-specific functions.
- **Task Scheduler:** Runs background jobs defined in `src/lib/tasks` based on cron schedules stored in `config/tasks.toml`.

## 3. Data Flow Diagrams

### User Authentication (Login)

```mermaid
graph TD
    A[User Enters Credentials in Login Form] --> B(Client Component);
    B --> C{Server Action: validateLogin};
    C --> D[lib/auth: authorize];
    D --> E[lib/config: validateUser];
    E --> F[lib/config: loadConfig(decrypt=false)];
    F --> G[config/default.toml];
    G --> F;
    F --> E{Compare Hash};
    alt Credentials Valid
        E --> D{Return User Object};
        D --> C{Return User Object};
        C --> H[NextAuth.js: Create Session/JWT];
        H --> I[Set Session Cookie];
        I --> B{Redirect to Dashboard};
    else Credentials Invalid
        E --> D{Return null};
        D --> C{Throw AuthenticationError};
        C --> B{Display Error Message};
    end
```

### Device Pairing

```mermaid
graph TD
    subgraph Client-Side
        A[User selects Pending Request / Enters PIN] --> B(PairDialog Component);
        B --> C{Server Action: pairAndAddClientAction};
    end
    subgraph Server-Side
        C --> D[lib/config: loadConfig(decrypt=true)];
        D --> E[config/default.toml];
        E --> D;
        C --> F[api/wolf/lib/wolf-socket.server: callWolfApi(/pair/client)];
        F --> G[Wolf Backend Socket];
        G --> F{Pairing Result};
        alt Pairing Successful
            F --> C{Return Success};
            C --> H[Retry Loop: callWolfApi(/clients)];
            H --> G;
            G --> H{Updated Client List};
            H --> C{Find New Device ID};
            C --> I[lib/config: loadConfig(decrypt=true)];
            I --> E; E --> I;
            C --> J[lib/config: saveConfig (Add Client)];
            J --> E; E --> J;
            C --> K[Return Success + Client Data];
        else Pairing Failed
            F --> C{Return Error};
            C --> L[Return Error Response];
        end
    end
    alt Action Success
      K --> B{Show Success Toast, Refresh Lists};
    else Action Failed
      L --> B{Show Error Toast};
    end
```

### Configuration Update (e.g., SteamGridDB Settings)

```mermaid
graph TD
    subgraph Client-Side
        A[Admin changes settings in SteamGridDbSettings Component] --> B(Form Submission);
        B --> C{Server Action: updateSteamGridDbSettings};
    end
    subgraph Server-Side
        C --> D[Auth Check: Verify Admin Role];
        alt Not Admin
            D --> C{Return Auth Error};
        else Is Admin
            D --> E[Zod Validation: Validate FormData];
            alt Invalid Data
                E --> C{Return Validation Error};
            else Valid Data
                E --> F[lib/config: loadConfig(decrypt=true)];
                F --> G[config/default.toml];
                G --> F;
                F --> C{Update Config Object In Memory};
                C --> H[lib/config: saveConfig (Encrypts API Key)];
                H --> G; G --> H;
                H --> C{Return Success + Updated Status};
            end
        end
    end
    alt Action Success
      C --> A{Update UI State, Show Success Toast};
    else Action Failed
      C --> A{Show Error Toast};
    end
```

## 4. Design Decisions and Rationale

- **Next.js App Router:** Chosen to leverage the latest Next.js features, including Server Components for performance, improved data fetching patterns, Server Actions for simplified mutations, and standardized routing/layout conventions.
- **TOML for Configuration/Data:**
  - **Rationale:** Likely chosen for simplicity, human-readability, and ease of setup without requiring a separate database server. Suitable for smaller-scale applications or configurations where complex querying isn't a primary need. The custom `config.ts` module abstracts read/write operations and handles encryption.
  - **Trade-offs:** Lacks transactional integrity, prone to race conditions under concurrent writes, doesn't scale well for large datasets or complex relationships, and makes querying difficult. File locking is not currently implemented, increasing concurrency risks.
- **Server Actions:** Used extensively for form submissions and mutations. This simplifies client-side code by allowing direct function calls to the server, reducing the need for manually creating API endpoints for many operations. Co-locates data mutations with the components that use them.
- **Unix Domain Socket for Wolf Communication:**
  - **Rationale:** Provides efficient and relatively secure Inter-Process Communication (IPC) when WolfUI and the Wolf backend run on the same host. Avoids network overhead.
  - **Trade-offs:** Tightly couples WolfUI to the host running the Wolf backend. Requires careful permission management for the socket file in production. Less flexible than HTTP if components need to be distributed.
- **Custom Logging (`src/lib/logger`):** A dedicated logging system was implemented to provide structured logging (JSON format for containers), different transports (console, file, container stdout), log levels, and component tagging. Client-side logs are batched and sent to a server action. This offers more control than basic `console.log`.
- **Centralized Config Management (`src/lib/config.ts`):** Abstracting TOML file interactions into a single module simplifies access and modification across the application. It centralizes logic for loading, saving, validation, and encryption/decryption. However, as noted in memory, this file might be becoming overly complex.
- **Zod for Validation:** Used for robust schema definition and validation of API/Action inputs and configuration files, improving data integrity and type safety.

## 5. System Constraints and Limitations

- **TOML Data Store:**
  - **Concurrency:** Highly susceptible to race conditions during concurrent write operations (e.g., multiple users updating settings, simultaneous task updates) as file locking is not implemented. This can lead to data corruption or lost updates.
  - **Scalability:** Performance will degrade as configuration files grow. Not suitable for large amounts of data or high-throughput operations.
  - **Querying:** Searching or filtering data within TOML files is inefficient and complex compared to a database.
  - **Data Integrity:** No built-in mechanisms for transactions or enforcing complex relationships between data entities.
- **Dependency on Wolf Backend:** WolfUI relies heavily on the Wolf backend being available and running on the same host for core functionalities like device pairing and potentially other operations via the Unix socket.
- **Security:**
  - Password Hashing: Previous reviews noted potential inconsistencies (ensure `bcryptjs.hashSync` is always used).
  - Secret Management: API keys (Steam, SteamGridDB) and encryption keys need secure handling, especially in production environments. Ensure they are not exposed client-side or in logs.
  - Socket Permissions: The Unix domain socket file requires correct permissions in production to prevent unauthorized access.
- **Error Handling:** While generally good, direct socket communication requires robust error handling for connection issues, timeouts, and unexpected responses from the Wolf backend.
- **Single Point of Failure (config.ts):** The `config.ts` module is critical. Issues within this module could impact large parts of the application. Its complexity also increases the risk of bugs.
