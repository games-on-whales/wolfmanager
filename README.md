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
      # NEXTAUTH_SECRET and ENCRYPTION_KEY are auto-generated on first startup
      # - NEXTAUTH_SECRET=your-secret-here  # Optional: provide your own
      # - ENCRYPTION_KEY=your-32-char-key   # Optional: provide your own
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

## Automatic Secret Generation

WolfManager automatically generates secure secrets on first startup, eliminating the need for manual configuration in most cases. This feature simplifies deployment while maintaining security best practices.

### How It Works

When WolfManager starts for the first time, it automatically:

1. **Generates NEXTAUTH_SECRET**: A 64-character secure random string used for NextAuth.js session encryption
2. **Generates ENCRYPTION_KEY**: A 32-character secure key used for encrypting sensitive data like Steam API keys
3. **Creates .env.local file**: Stores the generated secrets for persistence across restarts
4. **Logs generation**: Provides console output indicating which secrets were auto-generated

### Security Benefits

- **Cryptographically secure**: Uses Node.js `crypto.randomBytes()` for maximum entropy
- **Unique per installation**: Each deployment gets its own unique secrets
- **No default values**: Eliminates security risks from shared or default secrets
- **Automatic rotation**: Regenerates invalid or missing keys automatically

### Manual Configuration (Optional)

While auto-generation is recommended for most users, you can still provide your own secrets:

```bash
# Generate your own secrets (optional)
openssl rand -hex 32  # For NEXTAUTH_SECRET
openssl rand -hex 16  # For ENCRYPTION_KEY (32 characters)
```

Then set them in your environment:
```yaml
environment:
  - NEXTAUTH_SECRET=your-64-character-secret-here
  - ENCRYPTION_KEY=your-32-character-key-here
```

### Container Environments

Auto-generation works seamlessly in Docker containers:
- Secrets are generated on first container startup
- Persisted through volume mounts to `/app/config` or `/app/data`
- Environment variables take precedence over auto-generation
- No additional configuration required

### Backward Compatibility

Existing deployments continue to work unchanged:
- Pre-existing `.env.local` files are respected
- Environment variables take precedence over auto-generation
- No breaking changes to existing configurations

### First Time Setup

1. **Access the Interface**: Navigate to `http://localhost:3000` in your web browser
2. **Complete Initial Setup**: Follow the first-time setup wizard to create your admin account
3. **Configure Wolf Connection**: Ensure WolfManager can communicate with your Wolf instance
4. **Add Users**: Create user accounts for people who will be streaming games
5. **Pair Devices**: Help users pair their devices (phones, tablets, PCs) for game streaming

## Database Configuration

WolfManager uses Drizzle ORM with support for multiple database backends, providing flexibility for different deployment scenarios:

- **SQLite** (default) - Stores data in `./data/wolfmanager.db`, perfect for development and single-user deployments
- **PostgreSQL** - Production-ready database for larger deployments
- **MySQL** - Alternative production database option

### Environment Variables

Configure your database using these environment variables:

- `DATABASE_TYPE` - Database type: `sqlite`, `postgresql`, or `mysql` (default: `sqlite`)
- `DATABASE_URL` - Connection string for PostgreSQL/MySQL (optional for SQLite)

### Database Setup Examples

#### SQLite (Default)
```bash
# .env file
DATABASE_TYPE=sqlite
# DATABASE_URL is optional for SQLite, defaults to ./data/wolfmanager.db
```

#### PostgreSQL
```bash
# .env file
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://username:password@localhost:5432/wolfmanager
```

#### MySQL
```bash
# .env file
DATABASE_TYPE=mysql
DATABASE_URL=mysql://username:password@localhost:3306/wolfmanager
```

### Migration from TOML

If you have existing TOML configuration files, WolfManager includes a migration tool to transfer your data to the database:

```bash
# Preview what will be migrated (safe to run)
npm run migrate-toml:check

# Perform the migration with backup
npm run migrate-toml -- migrate --backup --verbose
```

For detailed migration instructions, see the [Migration Guide](docs/migration-guide.md).

### Database Operations

WolfManager includes several npm scripts for database management:

```bash
# Database schema and migrations
npm run db:generate    # Generate new migrations after schema changes
npm run db:migrate     # Apply pending migrations to database
npm run db:push        # Push schema changes directly (development only)
npm run db:studio      # Open Drizzle Studio database browser

# TOML migration tools
npm run migrate-toml:check     # Preview TOML migration
npm run migrate-toml           # Execute TOML migration
npm run migrate-toml:dry-run   # Dry run migration preview
```

### Docker Configuration

When using Docker, mount a volume for database persistence:

```yaml
services:
  wolf-admin:
    image: ghcr.io/games-on-whales/wolfmanager/wolfmanager:latest
    environment:
      - DATABASE_TYPE=sqlite  # or postgresql/mysql
      - DATABASE_URL=postgresql://... # if using PostgreSQL/MySQL
    volumes:
      - ./data:/app/data      # Persist SQLite database
      - ./config:/app/config  # Persist config directory
```

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
- **Database**: Drizzle ORM with SQLite/PostgreSQL/MySQL support
- **Authentication**: NextAuth.js with secure session management
- **Type Safety**: TypeScript with Zod schema validation
- **Containerization**: Docker with optimized production builds

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

# Initialize database (first time setup)
npm run db:migrate

# Start development server
npm run dev
```

The database will be automatically initialized on first run. For development with different database backends:

```bash
# Development with PostgreSQL
DATABASE_TYPE=postgresql DATABASE_URL=postgresql://... npm run dev

# Development with MySQL
DATABASE_TYPE=mysql DATABASE_URL=mysql://... npm run dev
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
