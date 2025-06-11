# Database Layer

## Overview

This is a comprehensive database layer for WolfUI that supports multiple database types (SQLite, PostgreSQL, MySQL) with a unified interface. The layer includes:

- **Schema definitions** - Type-safe table schemas using Drizzle ORM
- **Helper functions** - Convenient CRUD operations for all entities
- **Migration system** - Database initialization and schema management
- **Multi-database support** - Runtime switching between database types

## Architecture

### Directory Structure

```
src/lib/db/
├── schema/           # Table schema definitions
│   ├── users.ts
│   ├── clients.ts
│   ├── games.ts
│   ├── tasks.ts
│   ├── system.ts
│   └── index.ts
├── helpers/          # Database helper functions
│   ├── users.ts
│   ├── clients.ts
│   ├── games.ts
│   ├── tasks.ts
│   ├── system.ts
│   ├── types.ts
│   └── index.ts
├── migrations/       # Database migration files
│   ├── 0000_initial_schema.sql
│   └── meta/
├── config.ts         # Database configuration
├── index.ts          # Database connection management
├── init.ts           # Database initialization
└── utils.ts          # Database utilities
```

### Database Support

The layer supports three database types:

1. **SQLite** (default) - File-based database, perfect for development and single-user deployments
2. **PostgreSQL** - Production-ready RDBMS with advanced features
3. **MySQL** - Popular RDBMS with wide compatibility

### Configuration

Database configuration is controlled via environment variables:

```env
# Database type (sqlite, postgresql, mysql)
DATABASE_TYPE=sqlite

# Database connection URL
DATABASE_URL=file:./data/wolfmanager.db
# OR for PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/wolfmanager
# OR for MySQL:
# DATABASE_URL=mysql://user:password@localhost:3306/wolfmanager
```

## Schema

### Core Tables

#### Users
- User accounts with authentication
- Admin roles and permissions
- Steam integration support

#### Client Devices
- Paired client devices for Wolf streaming
- Device-specific pairing secrets

#### Games & Libraries
- Multi-platform game catalog
- User-specific game libraries
- Playtime tracking

#### Tasks
- Scheduled task management
- Task execution history and status

#### System Configuration
- Key-value configuration storage
- Metadata provider settings

## Helper Functions

All database operations are exposed through helper functions organized by domain:

### User Operations
```typescript
import { getUserById, addUser, updateUser, deleteUser } from '@/lib/db/helpers';

// Get user by ID
const user = await getUserById('user-id');

// Create new user
const newUser = await addUser({
  username: 'newuser',
  passwordHash: hashedPassword,
  isAdmin: false,
});

// Update user
const updatedUser = await updateUser('user-id', {
  displayName: 'New Display Name',
});
```

### Game Operations
```typescript
import { 
  addPlatform, 
  addGame, 
  addUserLibrary, 
  addUserGame 
} from '@/lib/db/helpers';

// Add a platform
await addPlatform({
  id: 'steam',
  name: 'Steam',
  version: '1.0.0'
});

// Add a game
await addGame({
  platformId: 'steam',
  platformGameId: '12345',
  name: 'Game Name',
  iconUrl: 'https://example.com/icon.jpg'
});
```

### System Configuration
```typescript
import { getSystemConfig, setSystemConfig } from '@/lib/db/helpers';

// Get configuration value
const value = await getSystemConfig('some.config.key');

// Set configuration value
await setSystemConfig('some.config.key', 'new value');
```

## Database Initialization

### Automatic Setup

The database layer includes automatic initialization:

```typescript
import { initializeDatabase } from '@/lib/db/init';

// Initialize database (run migrations, seed data)
await initializeDatabase();
```

### Manual Migration

For production deployments, you can run migrations manually:

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema changes (development)
npm run db:push
```

## Setup Instructions

### Development Environment

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Compile better-sqlite3** (for SQLite support):
   ```bash
   npm rebuild better-sqlite3
   ```

3. **Set environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env to set DATABASE_TYPE=sqlite (default)
   ```

4. **Initialize database**:
   ```bash
   npm run dev
   # Database will be automatically initialized on first run
   ```

### Production Environment

1. **PostgreSQL Setup**:
   ```bash
   # Install PostgreSQL client libraries
   npm install pg @types/pg
   
   # Set environment variables
   export DATABASE_TYPE=postgresql
   export DATABASE_URL=postgresql://user:password@localhost:5432/wolfmanager
   ```

2. **MySQL Setup**:
   ```bash
   # Install MySQL client libraries  
   npm install mysql2 @types/mysql2
   
   # Set environment variables
   export DATABASE_TYPE=mysql
   export DATABASE_URL=mysql://user:password@localhost:3306/wolfmanager
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

## Testing

Test database functionality:

```bash
# Run database initialization test
npx tsx src/scripts/test-db-init.ts
```

## Type Safety

All database operations are fully typed using TypeScript and Drizzle ORM. This provides:

- **Compile-time type checking** for all database operations
- **IntelliSense support** in your IDE
- **Runtime type validation** for data integrity

## Error Handling

The database layer includes comprehensive error handling:

- Connection errors are logged and re-thrown
- Schema validation errors provide detailed feedback
- Transaction failures are properly rolled back
- Health checks verify database connectivity

## Performance

The database layer is optimized for performance:

- **Connection pooling** for PostgreSQL and MySQL
- **Prepared statements** for better query performance
- **Indexes** on frequently queried columns
- **WAL mode** for SQLite concurrency

## Migration Guide

### From SQLite to PostgreSQL

1. Export existing data:
   ```bash
   # TODO: Add export script
   ```

2. Update configuration:
   ```env
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://...
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

4. Import data:
   ```bash
   # TODO: Add import script
   ```

## Troubleshooting

### Common Issues

1. **better-sqlite3 compilation errors**:
   ```bash
   npm rebuild better-sqlite3
   # OR
   npm install --build-from-source better-sqlite3
   ```

2. **PostgreSQL connection errors**:
   - Verify PostgreSQL is running
   - Check connection string format
   - Ensure database exists

3. **MySQL connection errors**:
   - Verify MySQL is running
   - Check connection string format
   - Ensure database exists

### Debugging

Enable debug logging:
```env
LOG_LEVEL=debug
```

Check database health:
```typescript
import { checkDatabaseHealth } from '@/lib/db';
const isHealthy = await checkDatabaseHealth();
console.log('Database healthy:', isHealthy);
```

## Contributing

When adding new features:

1. **Update schemas** in `src/lib/db/schema/`
2. **Generate migrations** with `npm run db:generate`
3. **Add helper functions** in `src/lib/db/helpers/`
4. **Update exports** in index files
5. **Add tests** for new functionality

## API Reference

See the individual helper files for complete API documentation:

- [User Helpers](./helpers/users.ts)
- [Client Helpers](./helpers/clients.ts) 
- [Game Helpers](./helpers/games.ts)
- [Task Helpers](./helpers/tasks.ts)
- [System Helpers](./helpers/system.ts)