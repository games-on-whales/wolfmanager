# WolfManager Codebase Analysis (Based on Repomix Output)

## Project Overview

**Project:** WolfManager
**Purpose:** A Next.js web application designed as an administration interface for managing the "Wolf" game streaming backend (likely [Games on Whales/Wolf](https://github.com/games-on-whales/wolf)). It provides a central dashboard for game library management, Wolf configuration, user/device pairing, and monitoring.

## Key Technologies

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI (built on Radix UI primitives)
- **Authentication:** NextAuth.js (JWT strategy)
- **Validation:** Zod
- **Configuration & Data Storage:** TOML files (managed via `src/lib/config.ts`)
- **Task Scheduling:** `node-cron`
- **Docker Interaction:** `dockerode`
- **API Communication:** `fetch`, Custom Unix Socket Client

## Core Features

- **Authentication & Authorization:**
  - Secure login & session management (8-hour duration).
  - Role-Based Access Control (Admin/User).
  - Protected routes and API endpoints.
  - First-time setup flow for new users.
- **User Management:** Create, update, delete users (data stored in TOML).
- **Device Pairing:**
  - PIN-based pairing workflow for client devices with the Wolf backend.
  - Interaction via Wolf's Unix Socket API.
  - Listing pending requests and paired clients.
- **Settings Management:**
  - Account (Profile, Password Change).
  - Steam Integration (ID, API Key Validation).
  - Metadata Providers (SteamGridDB API Key).
  - Task Scheduling Configuration.
- **Background Task Runner (`src/lib/scheduler.ts`):**
  - Discovers and executes scheduled tasks defined in `src/lib/tasks`.
  - **Current Tasks:**
    - `sync-steam-library`: Fetches owned games from Steam API, saves to `config/steam_library.toml`.
    - `fetch-steamgriddb-artwork`: Fetches game grids from SteamGridDB (via internal API proxy), stores locally, updates `config/steam_library.toml`.
    - `placeholder-task`: Example task.
- **API Interaction:**
  - **Wolf API:** Direct communication via Unix domain socket (`/var/run/wolf/wolf.sock`) for pairing, client management, etc. Uses OpenAPI schema validation.
  - **Steam API:** Fetches user game libraries.
  - **SteamGridDB API:** Fetches game artwork (proxied via `/api/metadata/steamgriddb/...`).
- **Logging:**
  - Custom structured logging system (`src/lib/logger`).
  - Multiple levels (DEBUG, INFO, WARN, ERROR) and components (UI, SERVER, AUTH, etc.).
  - Multiple transports (Console, File, Container).
  - Client-side and server-side loggers.
  - Documentation available in `docs/technical/logging/`.
- **API Test Console:** UI (`/settings/api-test`) for testing internal API endpoints.
- **Configuration:**
  - Uses TOML files (`config/default.toml`, `config/tasks.toml`, `config/steam_library.toml`) as the primary data store.
  - Managed by utilities in `src/lib/config.ts`.
  - Includes encryption for sensitive fields (e.g., API keys).

## Architecture & Code Structure

- **Framework:** Leverages Next.js 14 App Router features (Server Components, Client Components, Route Handlers, Server Actions).
- **Organization:** Well-structured directories:
  - `src/app`: Routes, pages, route-specific logic.
  - `src/lib`: Core services, utilities, auth, config, logging, tasks.
  - `src/components`: Shared UI components (Shadcn).
  - `config/`: TOML configuration files.
  - `docs/`: Project documentation.
- **Data Flow:** Uses Server Actions for mutations, Route Handlers for APIs. Server Components likely fetch data directly from services/config.
- **Validation:** Zod used extensively for API requests, forms, and configuration validation.
- **Error Handling:** Employs `ErrorBoundary` components, toast notifications (`sonner`), and structured logging.
- **Security:** Middleware (`src/middleware.ts`) enforces auth/role checks. Sensitive config values are encrypted.

## Development Environment

- **Containerization:** Uses Docker Dev Containers for consistency.
- **IDE:** VS Code recommended, with specific extensions configured in `devcontainer.json`.

## Documentation

- Dedicated `docs/` directory with technical and feature documentation.
- `README.md`, `PLAN.md`, `TODO.md` provide project overview, planning, and task tracking.
