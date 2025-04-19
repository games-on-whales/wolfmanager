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
    participant web as Web Browser
    participant next as Next.js Server
    participant lib as Lib Functions
    participant config as Config Service
    participant toml as TOML Files
    participant wolf as Wolf Backend
    participant api as External APIs
    participant task as Task Scheduler

    web->>next: HTTP Request (Page Load/API Call/Action)
    alt Page Load / Server Component Render
        next->>lib: Call utility/service functions
        lib->>config: Read config data
        config->>toml: Read file
        toml-->>config: Return TOML content
        config-->>lib: Return parsed config
        lib-->>next: Return data
        next-->>web: Send HTML/Data
    else API Route / Server Action
        next->>lib: Call action/service logic
        alt Read Operation
            lib->>config: Read config data
            config->>toml: Read file
            toml-->>config: Return TOML content
            config-->>lib: Return parsed config
        else Write Operation
            lib->>config: Update config data
            config->>toml: Write file (with encryption)
            toml-->>config: Confirm write
            config-->>lib: Confirm update
        else Wolf Backend Interaction
            lib->>wolf: Send request via socket
            wolf-->>lib: Return response
        else External API Interaction
             lib->>api: HTTP Request
             api-->>lib: Return response
        end
        lib-->>next: Return result/status
        next-->>web: Send JSON Response/Action Result
    end

    %% Background Tasks
    task->>lib: Execute Task (e.g., syncSteamLibrary)
    lib->>config: Read/Write Config
    lib->>api: Fetch Data
    lib->>task: Update Task Status
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
flowchart TD
    A[User Enters Credentials] --> B[Client Component]
    B --> C{Server Action: validateLogin}
    C --> D[lib/auth: authorize]
    D --> E[lib/config: validateUser]
    E --> F[lib/config: loadConfig]
    F --> G[config/default.toml]
    G --> F
    F --> E_Decision{Compare Hash}
    E_Decision -- "Valid" --> D_Valid{Return User Object}
    D_Valid --> C_Valid{Return User Object}
    C_Valid --> H[NextAuth.js: Create Session]
    H --> I[Set Session Cookie]
    I --> B_Redirect{Redirect to Dashboard}
    B_Redirect --> B
    E_Decision -- "Invalid" --> D_Invalid{Return null}
    D_Invalid --> C_Invalid{Throw AuthError}
    C_Invalid --> B_Error{Display Error}
    B_Error --> B
```

### Device Pairing

```mermaid
flowchart TD
    subgraph ClientSide
        A[User selects Request/Enters PIN] --> B[PairDialog Component]
        B --> C{Server Action: pairAndAddClient}
    end

    subgraph ServerSide
        C --> D_Load1[loadConfig decrypt=true]
        D_Load1 --> E[config/default.toml]
        E --> D_Load1
        C --> F_Call[callWolfApi /pair/client]
        F_Call --> G[Wolf Backend Socket]
        G --> F_Result{Pairing Result}

        F_Result -- "Success" --> C_PairSuccess{Return Success}
        C_PairSuccess --> H_Retry[Retry Loop: callWolfApi]
        H_Retry --> G
        G --> H_Result{Updated Client List}
        H_Result --> C_FindID{Find New Device ID}
        C_FindID --> I_Load2[loadConfig decrypt=true]
        I_Load2 --> E
        E --> I_Load2
        C_FindID --> J_Save[saveConfig Add Client]
        J_Save --> E
        E --> J_Save
        J_Save --> K[Return Success + Client Data]

        F_Result -- "Failed" --> C_PairFail{Return Error}
        C_PairFail --> L[Return Error Response]
    end

    K -- "Success" --> B_Success{Show Success Toast}
    L -- "Failed" --> B_Error{Show Error Toast}
    B_Success --> B
    B_Error --> B
```

### Configuration Update (e.g., SteamGridDB Settings)

```mermaid
flowchart TD
    subgraph ClientSide
        A[Admin changes SteamGridDb settings] --> B[Form Submission]
        B --> C{Server Action: updateSettings}
    end

    subgraph ServerSide
        C --> D_Auth{Auth Check: Admin Role}
        D_Auth -- "Not Admin" --> C_AuthErr{Return Auth Error}
        D_Auth -- "Is Admin" --> E_Valid{Zod Validation}

        E_Valid -- "Invalid" --> C_ValidErr{Return Validation Error}
        E_Valid -- "Valid" --> F_Load[loadConfig decrypt=true]
        F_Load --> G[config/default.toml]
        G --> F_Load
        F_Load --> C_UpdateMem{Update Config In Memory}
        C_UpdateMem --> H_Save[saveConfig Encrypts API Key]
        H_Save --> G
        G --> H_Save
        H_Save --> C_Success{Return Success}
    end

    C_Success -- "Success" --> A_Success{Update UI, Show Toast}
    C_AuthErr -- "Failed" --> A_Error{Show Error Toast}
    C_ValidErr -- "Failed" --> A_Error
    A_Success --> A
    A_Error --> A
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
