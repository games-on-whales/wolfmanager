# WolfManager

A modern web interface for managing [Wolf](https://github.com/games-on-whales/wolf) - the self hosted game streaming solution that lets you stream your games to any device using the Moonlight client. WolfManager provides an intuitive dashboard for configuring Wolf, managing game libraries, user management, and monitoring your streaming setup.

## What is WolfManager?

WolfManager is a comprehensive web-based management interface designed to simplify the administration of Wolf game streaming instances. Whether you're running a personal game streaming setup or managing multiple users and devices, WolfManager provides the tools you need to:

- **Manage Users & Devices**: Handle user accounts, device pairing, and access permissions 
- **Logging Viewer**: View logs for both Wolf container and wolfmanger

These are the current features for now with more capabilities to come in the future.

## AI Development Story

WolfManager began as a proof of concept (POC) in early 2025 to explore using AI for software development. Its initial success led to a complete refactor of the original codebase, adopting technologies like Next.js, NextAuth, and ShadCN. These frameworks were selected for their strong documentation, broad adoption, and excellent support in AI models such as Claude and ChatGPT.

Development originally took place using Cursor, but I later transitioned to the RooCode extension due to its Orchestration mode and other advanced features that made managing more complex codebases easier. That said, I continue to explore and evaluate both tools as they evolve.

During this process, I also adopted the use of MCPs (Model Collaboration Plugins) with both platforms to enhance AI performance:

- **Repomix** – Provides a high-level overview of the codebase, helping AI agents better understand project structure and make more accurate code edits.
- **Context7** – Offers high-quality, vetted documentation and examples across many languages and frameworks. This significantly improves solution quality, particularly when the AI model’s training data may be outdated.


## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center">
        <a href="docs/images/clients.png">
          <img src="docs/images/clients.png" alt="Client Management" width="200" height="150" style="object-fit: cover;">
        </a>
        <br>
        <em>Client Management</em>
        <br>
        <small>Manage paired devices and handle new client pairing requests</small>
      </td>
      <td align="center">
        <a href="docs/images/user_management.png">
          <img src="docs/images/user_management.png" alt="User Management" width="200" height="150" style="object-fit: cover;">
        </a>
        <br>
        <em>User Management</em>
        <br>
        <small>Create and manage user accounts with role-based permissions</small>
      </td>
      <td align="center">
        <a href="docs/images/settings.png">
          <img src="docs/images/settings.png" alt="System Settings" width="200" height="150" style="object-fit: cover;">
        </a>
        <br>
        <em>System Settings</em>
        <br>
        <small>Configure Wolf settings, metadata providers, and system preferences</small>
      </td>
      <td align="center">
        <a href="docs/images/systemlogs.png">
          <img src="docs/images/systemlogs.png" alt="System Logs" width="200" height="150" style="object-fit: cover;">
        </a>
        <br>
        <em>System Logs</em>
        <br>
        <small>Monitor Wolf container logs and troubleshoot issues in real-time</small>
      </td>
    </tr>
  </table>
</div>

## Quick Start

### Prerequisites

Before setting up WolfManager, you'll need a working Wolf installation. If you haven't set up Wolf yet, follow the comprehensive deployment guide:

**📖 [Wolf Deployment Guide](https://games-on-whales.github.io/wolf/stable/user/quickstart.html)**

### Running WolfManager with Docker Compose

The easiest way to deploy WolfManager is using Docker Compose. Create a `docker-compose.yml` file:

```yaml
services:
  wolf-admin:
    image: ghcr.io/games-on-whales/wolfmanager/wolfmanager:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXTAUTH_SECRET=xyz
      - NEXTAUTH_URL=http://localhost:3000
    volumes:
      - /var/run/wolf:/var/run/wolf              # Mount Wolf socket
      - /var/run/docker.sock:/var/run/docker.sock # Mount Docker socket
      - ./config:/app/config                      # Persist config directory
    restart: unless-stopped
```

Then start the service:

```bash
docker-compose up -d
```

WolfManager will be available at `http://localhost:3000`

### First Time Setup

1. **Access the Interface**: Navigate to `http://localhost:3000` in your web browser
2. **Complete Initial Setup**: Follow the first-time setup wizard to create your admin account
3. **Configure Wolf Connection**: Ensure WolfManager can communicate with your Wolf instance
4. **Add Users**: Create user accounts for people who will be streaming games
5. **Pair Devices**: Help users pair their devices (phones, tablets, PCs) for game streaming

## Key Features

### ✅ Currently Available

- **User Authentication & Management**
  - Secure login system with role-based access control
  - Admin and standard user roles
  - User Create / Update / Delete
  - Paired Client to User Mapping

- **Client & Device Management**  
  - Device pairing workflow for Moonlight clients
  - Real-time pairing request handling
  - Paired device overview and management
  - Paired devices mapped mapped to the user who paired it

- **Logs**
  - Wolf container log viewing
  - Wolf Manager Logs

- **API Integration**
  - Full Wolf API integration with schema validation
  - Interactive API testing console
  - Type-safe API communication


### 🚧 Roadmap

**Plug-In System**
Develop a flexible plug-in system that allows the community to extend WolfManager’s capabilities. For example, plugins could be created to support external libraries such as Steam or RomM. These plugins would integrate seamlessly with the WolfManager platform to:
- Allow users to connect and manage their preferred game libraries  
- Automate the download and installation process for games  
- Fetch and display artwork specific to each library


**Wolf Launch**
Enable the ability for WolfManager to detect your system and then correctly launch Wolf with a known good configuration


## Technology Stack

WolfManager is built with modern web technologies for optimal performance and maintainability:

- **Frontend**: Next.js 14 with App Router, React Server Components
- **UI Components**: Shadcn UI, Radix UI Primitives, Tailwind CSS
- **Backend**: Node.js with Next.js API Routes
- **Authentication**: NextAuth.js with secure session management
- **Type Safety**: TypeScript with Zod schema validation
- **Containerization**: Docker with optimized production builds
- **TOML**: Configuration storage

## Development

### Development Environment

For development, we recommend using VS Code with Dev Containers:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/games-on-whales/wolfmanager
   cd wolfmanager
   ```

2. **Open in VS Code**:
   ```bash
   code .
   ```

3. **Reopen in Container**: When prompted, click "Reopen in Container" or use the Command Palette (F1) and select "Dev Containers: Reopen in Container"

The Dev Container will automatically:
- Install all dependencies
- Configure the development environment  
- Mount the Wolf API socket
- Start the development server at `http://localhost:3000`

### Local Development

If you prefer local development:

```bash
# Prerequisites: Node.js 18+, access to Wolf socket
npm install
npm run dev
```

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** and create a feature branch
2. **Follow the established patterns** and TypeScript best practices
3. **Test your changes** thoroughly
4. **Submit a pull request** with a clear description

### Code Guidelines

- Use TypeScript with strict type checking
- Follow the established component architecture
- Implement proper error handling
- Add appropriate tests where applicable
- Maintain accessibility standards

## Architecture Overview

WolfManager follows a modern full-stack architecture:

- **API Layer**: Next.js Route Handlers with OpenAPI schema validation
- **Authentication**: NextAuth.js with role-based access control
- **UI Architecture**: React Server Components with client-side interactivity
- **Wolf Integration**: Unix socket communication with type-safe API client
- **Data Flow**: Server Actions for mutations, cached responses for performance

## Support & Documentation

- **Wolf Documentation**: [games-on-whales.github.io/wolf](https://games-on-whales.github.io/wolf/)
- **Issues & Bug Reports**: [GitHub Issues](https://github.com/games-on-whales/wolfmanager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/games-on-whales/wolfmanager/discussions)

## License

WolfManager is open source software. See [LICENSE](LICENSE) for details.

---

*Built with ❤️ for the Wolf game streaming community*
