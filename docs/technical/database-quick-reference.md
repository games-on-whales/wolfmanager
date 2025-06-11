# Database Quick Reference

## Overview

This quick reference provides practical examples and common operations for WolfManager's database layer. Use this guide for daily development tasks and troubleshooting.

## Environment Configuration

### Database Types

```bash
# SQLite (default)
DATABASE_TYPE=sqlite
# DATABASE_URL is optional, defaults to ./data/wolfmanager.db

# PostgreSQL
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://username:password@localhost:5432/wolfmanager

# MySQL
DATABASE_TYPE=mysql
DATABASE_URL=mysql://username:password@localhost:3306/wolfmanager
```

### Connection String Examples

```bash
# Local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/wolfmanager
DATABASE_URL=mysql://root:password@localhost:3306/wolfmanager

# Docker containers
DATABASE_URL=postgresql://postgres:password@postgres:5432/wolfmanager
DATABASE_URL=mysql://root:password@mysql:3306/wolfmanager

# Cloud databases (with SSL)
DATABASE_URL=postgresql://user:pass@host:5432/db?ssl=true&sslmode=require
DATABASE_URL=mysql://user:pass@host:3306/db?ssl=true
```

## NPM Scripts Reference

### Database Operations

```bash
# Schema and Migrations
npm run db:generate    # Generate new migration after schema changes
npm run db:migrate     # Apply pending migrations to database
npm run db:push        # Push schema changes directly (development only)
npm run db:studio      # Open Drizzle Studio database browser

# TOML Migration
npm run migrate-toml:check     # Preview what will be migrated
npm run migrate-toml:dry-run   # Dry run migration with detailed output
npm run migrate-toml           # Execute TOML to database migration
npm run migrate-toml:test      # Test migration system components
```

### Migration with Options

```bash
# TOML migration with backup and verbose output
npm run migrate-toml -- migrate --backup --verbose

# Force migration even if database has data
npm run migrate-toml -- migrate --force --backup --verbose

# Skip non-critical errors
npm run migrate-toml -- migrate --skip-errors --backup --verbose
```

## Helper Functions Reference

### Import Helpers

```typescript
import {
  // User operations
  getUserById,
  getUserByUsername,
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
  
  // Game operations
  getGameById,
  addGame,
  searchGames,
  addUserLibrary,
  addUserGame,
  
  // Task operations
  getTaskById,
  addTask,
  updateTaskStatus,
  
  // System operations
  getSystemConfig,
  setSystemConfig,
  
  // Client operations
  getClientDeviceById,
  addClientDevice,
} from '@/lib/db/helpers';
```

## Common Operations by Domain

### User Management

#### Create User
```typescript
const newUser = await addUser({
  username: 'johndoe',
  passwordHash: await bcrypt.hash('password', 12),
  displayName: 'John Doe',
  isAdmin: false,
  steamId: '76561198000000000', // optional
});
```

#### Get User
```typescript
// By ID
const user = await getUserById('user-uuid');

// By username
const user = await getUserByUsername('johndoe');

// By Steam ID
const user = await getUserBySteamId('76561198000000000');
```

#### Update User
```typescript
const updatedUser = await updateUser('user-uuid', {
  displayName: 'John Smith',
  isAdmin: true,
});
```

#### List All Users
```typescript
const users = await getAllUsers();
```

### Client Device Management

#### Add Client Device
```typescript
const device = await addClientDevice({
  userId: 'user-uuid',
  deviceName: 'Living Room Shield',
  pairSecret: 'generated-secret',
  macAddress: '00:11:22:33:44:55',
});
```

#### Get User's Devices
```typescript
const devices = await getClientDevicesByUserId('user-uuid');
```

#### Find Device by Pair Secret
```typescript
const device = await getClientDeviceByPairSecret('pair-secret');
```

### Game Library Management

#### Add Platform
```typescript
const platform = await addPlatform({
  id: 'steam',
  name: 'Steam',
  version: '1.0.0',
});
```

#### Add Game
```typescript
const game = await addGame({
  platformId: 'steam',
  platformGameId: '12345',
  name: 'Game Title',
  iconUrl: 'https://example.com/icon.jpg',
  bannerUrl: 'https://example.com/banner.jpg',
});
```

#### Create User Library
```typescript
const library = await addUserLibrary({
  userId: 'user-uuid',
  platformId: 'steam',
  steamUserId: '76561198000000000',
});
```

#### Add Game to User Library
```typescript
const userGame = await addUserGame({
  libraryId: 'library-uuid',
  gameId: 'game-uuid',
  playtimeMinutes: 120,
  lastPlayed: new Date(),
  isFavorite: false,
});
```

#### Search Games
```typescript
const games = await searchGames('action');
```

### Task Management

#### Create Task
```typescript
const task = await addTask({
  name: 'steam-library-sync',
  schedule: '0 */6 * * *', // Every 6 hours
  enabled: true,
  priority: 1,
});
```

#### Update Task Status
```typescript
await updateTaskStatus('task-uuid', 'running');
```

#### Get Tasks by Status
```typescript
const runningTasks = await getTasksByStatus('running');
const enabledTasks = await getEnabledTasks();
```

### System Configuration

#### Get Configuration
```typescript
// Single value
const steamApiKey = await getSystemConfig('steam.api_key');

// All configuration
const allConfig = await getAllSystemConfig();
```

#### Set Configuration
```typescript
await setSystemConfig('steam.api_key', 'your-api-key');
await setSystemConfig('system.name', 'My Wolf Server');
```

#### Metadata Providers
```typescript
// Add metadata provider
const provider = await addMetadataProvider({
  name: 'steamgriddb',
  enabled: true,
  config: {
    apiKey: 'your-api-key',
    preferredStyle: 'alternate',
  },
  priority: 1,
});

// Get enabled providers
const providers = await getEnabledMetadataProviders();
```

## Database Schema Quick Reference

### Table Relationships

```
users (1) ←→ (N) client_devices
users (1) ←→ (N) user_libraries
user_libraries (1) ←→ (N) user_games
platforms (1) ←→ (N) games
games (1) ←→ (N) user_games
```

### Key Tables

#### users
- `id` (UUID, PK)
- `username` (unique)
- `password_hash`
- `display_name`
- `is_admin` (boolean)
- `steam_id` (optional)

#### client_devices
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `device_name`
- `pair_secret` (unique)
- `mac_address`
- `last_seen`

#### games
- `id` (UUID, PK)
- `platform_id` (FK)
- `platform_game_id`
- `name`
- `icon_url`
- `banner_url`

#### tasks
- `id` (UUID, PK)
- `name` (unique)
- `schedule` (cron format)
- `enabled` (boolean)
- `status`
- `last_run`

## Troubleshooting

### Common Issues

#### SQLite Issues

**Better-sqlite3 compilation error:**
```bash
npm rebuild better-sqlite3
# OR
npm install --build-from-source better-sqlite3
```

**Database file permissions:**
```bash
# Ensure data directory exists and is writable
mkdir -p ./data
chmod 755 ./data
```

#### PostgreSQL Issues

**Connection refused:**
```bash
# Check PostgreSQL is running
systemctl status postgresql
# OR for Docker
docker ps | grep postgres

# Test connection
psql -h localhost -U username -d wolfmanager
```

**Database doesn't exist:**
```sql
-- Create database
CREATE DATABASE wolfmanager;
```

#### MySQL Issues

**Connection refused:**
```bash
# Check MySQL is running
systemctl status mysql
# OR for Docker
docker ps | grep mysql

# Test connection
mysql -h localhost -u username -p wolfmanager
```

**Character set issues:**
```sql
-- Ensure UTF8 character set
CREATE DATABASE wolfmanager 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

### Migration Issues

#### TOML parse errors
```bash
# Validate TOML files
npm run migrate-toml:test

# Check specific file syntax
node -e "console.log(require('@iarna/toml').parse(require('fs').readFileSync('config/default.toml', 'utf8')))"
```

#### Constraint violations
```bash
# Use force flag to overwrite existing data
npm run migrate-toml -- migrate --force --backup

# Or skip errors for non-critical issues
npm run migrate-toml -- migrate --skip-errors --backup
```

### Performance Issues

#### Slow queries
```typescript
// Enable query logging
process.env.LOG_LEVEL = 'debug';

// Check database health
import { checkDatabaseHealth } from '@/lib/db';
const healthy = await checkDatabaseHealth();
```

#### Memory issues during migration
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run migrate-toml
```

## Database Browser

### Drizzle Studio

```bash
# Open database browser
npm run db:studio

# Available at http://localhost:3000/studio
```

Features:
- Browse all tables and data
- Execute custom queries
- View relationships
- Schema visualization

### Alternative Tools

#### SQLite
```bash
# Command line
sqlite3 ./data/wolfmanager.db

# GUI tools
# - DB Browser for SQLite
# - SQLiteStudio
```

#### PostgreSQL
```bash
# Command line
psql -h localhost -U username -d wolfmanager

# GUI tools
# - pgAdmin
# - DBeaver
```

#### MySQL
```bash
# Command line
mysql -h localhost -u username -p wolfmanager

# GUI tools
# - MySQL Workbench
# - phpMyAdmin
# - DBeaver
```

## Testing Different Databases

### Quick Database Setup

#### PostgreSQL (Docker)
```bash
docker run --name postgres-test \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=wolfmanager \
  -p 5432:5432 -d postgres:15

DATABASE_TYPE=postgresql \
DATABASE_URL=postgresql://postgres:password@localhost:5432/wolfmanager \
npm run dev
```

#### MySQL (Docker)
```bash
docker run --name mysql-test \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=wolfmanager \
  -p 3306:3306 -d mysql:8

DATABASE_TYPE=mysql \
DATABASE_URL=mysql://root:password@localhost:3306/wolfmanager \
npm run dev
```

### Running Tests

```bash
# Test with different databases
DATABASE_TYPE=sqlite npm test
DATABASE_TYPE=postgresql DATABASE_URL=postgresql://... npm test
DATABASE_TYPE=mysql DATABASE_URL=mysql://... npm test
```

## Best Practices

### Development
- Always use migrations for schema changes
- Test with multiple database backends before deployment
- Use the database browser for debugging
- Enable debug logging for troubleshooting

### Production
- Use PostgreSQL or MySQL for production deployments
- Implement regular backup strategies
- Monitor database performance
- Use connection pooling
- Enable SSL for remote databases

### Security
- Never commit database credentials to version control
- Use environment variables for all database configuration
- Implement proper access controls
- Regularly rotate database passwords
- Use SSL/TLS for database connections in production

This quick reference covers the most common database operations and troubleshooting scenarios you'll encounter while developing with WolfManager.