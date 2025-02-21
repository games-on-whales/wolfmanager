# WolfManager

A web interface for managing Wolf, providing a centralized dashboard for game library management and Wolf configuration.

## Table of Contents

- [Features](#features)
  - [Implemented](#implemented)
  - [Work in Progress](#work-in-progress)
- [Technology Stack](#technology-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Development Tools](#development-tools)
- [Architecture](#architecture)
  - [Key Components](#key-components)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Alternative: Local Development](#alternative-local-development)
- [Contributing](#contributing)
  - [Development Workflow](#development-workflow)
  - [Code Style](#code-style)
- [Known Issues](#known-issues)
- [FAQ](#faq)
  - [How does this help with shared libraries?](#how-does-this-help-with-shared-libraries)
  - [User and Device Management](#user-and-device-management)

## Features

> - ✅ Implemented
> - 🚧 Partially Implemented
> - ❌ Not Started

### Implemented

- **Service Architecture**

  - ✅ Wolf API integration with OpenAPI schema validation
  - ✅ Next.js App Router with server components
  - ✅ Authentication with NextAuth.js
  - ✅ Server-side API validation and type safety
  - ✅ Zod schema validation for API requests
  - ✅ React Server Components for improved performance

- **UI Components**

  - ✅ Modern React component architecture with TypeScript
  - ✅ Shadcn UI component library
  - ✅ Radix UI primitives for accessible components
  - ✅ Tailwind CSS for styling
  - ✅ Dark mode support
  - ✅ Responsive design patterns
  - ✅ Interactive API test console
  - 🚧 User management interface

- **Core Functionality**
  - ✅ User authentication and session management
  - ✅ Role-based access control (admin/standard user)
    - ✅ Page-level access control
    - ✅ Protected API routes
    - ✅ Role-specific UI elements
  - ✅ API endpoint testing with schema validation
  - 🚧 Client pairing workflow
  - 🚧 Configuration management
  - ✅ Real-time validation of API requests

### Work in Progress

- **Game Management**

  - ❌ SteamCMD integration for game installation
  - ❌ Automatic Wolf app configuration
  - ❌ Manual artwork search interface
  - ❌ user state management (ie user save files persisted to hold folder all cases)

- **Wolf Integration**
  - ❌ Multi-device state handling
  - ❌ Real-time event handling

## Technology Stack

### Frontend

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI Components**:
  - Shadcn UI (based on Radix UI)
  - Tailwind CSS for styling
  - Custom React components
- **State Management**: React Server Components + Client Hooks
- **API Integration**: Server Actions + API Routes
- **Validation**: Zod for runtime type checking

### Backend

- **Runtime**: Node.js
- **API**: Next.js API Routes with OpenAPI validation
- **Authentication**: NextAuth.js
- **Data Validation**: Zod schemas
- **Wolf Integration**: Unix socket communication

### Development Tools

- **IDE**: VS Code with Cursor
- **Build Tool**: Next.js build system
- **Container**: Docker + Dev Containers
- **Version Control**: Git
- **API Testing**: Built-in API Test Console

## Architecture

### Key Components

1. **API Layer**

   - Server-side API routes with OpenAPI schema validation
   - Type-safe request/response handling
   - Authentication middleware
   - Wolf socket communication

2. **Authentication**

   - NextAuth.js integration
   - Role-based access control
   - Secure session management

3. **UI Architecture**

   - React Server Components for static content
   - Client components for interactive features
   - Responsive layout system
   - Component composition with Shadcn UI

4. **Data Flow**
   - Server-side data fetching
   - Type-safe API communication
   - Real-time updates (planned)
   - Cached responses for performance

## Getting Started

### Prerequisites

- Docker Desktop with Dev Containers support
- VS Code with Dev Containers extension
- Wolf instance running with API socket enabled
- Git for version control

### Development Setup

1. **Wolf API Socket Setup**

   Ensure Wolf is running with the API socket enabled. The socket should be mounted at `/var/run/wolf/wolf.sock`. If using a different path, set the `WOLF_SOCKET_PATH` environment variable.

   You can verify the API is working by testing with curl:

   ```bash
   curl --unix-socket /var/run/wolf/wolf.sock http://localhost/api/v1/openapi-schema
   ```

2. **Dev Container Setup**

   ```bash
   # Clone the repository
   git clone https://github.com/games-on-whales/wolfmanager
   cd wolfmanager

   # Open in VS Code
   code .
   ```

   When VS Code opens:

   1. Click the notification to "Reopen in Container" or
   2. Press F1, type "Dev Containers: Reopen in Container"

   The Dev Container will:

   - Set up all required dependencies
   - Configure the development environment
   - Mount the Wolf API socket
   - Start the development server

3. **Access the Interface**
   Once the Dev Container is running, open:
   ```
   http://localhost:3000
   ```

### Alternative: Local Development

While Dev Containers are recommended, you can also develop locally if you have:

- Node.js 18+
- Access to Wolf API socket at `/var/run/wolf/wolf.sock`
- Development tools (npm, git, etc.)

Follow the standard setup:

```bash
npm install
npm run dev
```

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Implement changes following the established patterns
4. Add tests where applicable
5. Submit a pull request

### Code Style

- Follow TypeScript best practices
- Use functional components
- Implement proper error handling
- Add appropriate TypeScript types
- Follow the established component structure

## Known Issues

- Some API endpoints need additional error handling
- Real-time event handling needs implementation
- WebSocket integration for live updates

## FAQ

### How does this help with shared libraries?

WolfManager aims to simplify game management by creating an app entry for each game, using the appropriate container (initially Steam). Game files will be mounted into the container as a read-only layer, while the writable layer will point to the user's profile path. This setup ensures that:

1. **Seamless User Experience:** Users can launch Moonlight, select a game, and start playing.
2. **Persistent Game State:** Game progress and settings are saved directly to the user's profile path.
3. **Automated Updates:** WolfManager handles game updates via SteamCMD, keeping everything up to date without manual intervention.

### User and Device Management

Wolf operates based on devices, not users, with each device having its own state folder. However, Wolf does support sharing a single state folder across multiple devices.

To simplify user management, WolfManager will:

1. **Create User State Folders:** Each user will have a dedicated state folder.
2. **Link Devices to Users:** All devices for a user will point to the same state folder.
3. **Manage Pairing:** User and device pairing will be handled through WolfManager.

This approach is part of future development and may evolve as the project progresses.
