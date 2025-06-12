# TOML to Database Migration System

This migration system provides a comprehensive solution to migrate existing TOML configuration data to the new database schema.

## Overview

The migration system consists of several modules that work together to:
1. Read and validate TOML configuration files
2. Transform TOML data to database-compatible formats
3. Execute the migration with proper error handling and logging
4. Provide CLI tools for easy migration management

## Architecture

```
src/lib/migration/
├── index.ts           # Main exports
├── types.ts           # TypeScript interfaces
├── toml-readers.ts    # TOML file reading and validation
├── transformers.ts    # Data transformation logic
├── migrator.ts        # Migration orchestration
└── README.md          # This file

src/scripts/
└── migrate-toml-to-db.ts  # CLI migration script
```

## TOML File Structure

The migration system expects the following TOML files:

### `config/default.toml`
Contains users, system configuration, and metadata providers:
```toml
[system]
name = "WolfUI"
version = "1.0.0"

[users.admin]
id = "1"
username = "admin"
password_hash = "$2b$10$..."
is_admin = true
# ... other user fields

[metadataProviders.steamgridDb]
enabled = true
apiKey = "encrypted_api_key"
```

### `config/libraries/steam.toml`
Contains game library data:
```toml
[metadata]
platform = "steam"
last_sync = "2025-04-09T12:49:01.833Z"
version = "1.0.0"

[games.123456]
name = "Game Name"
icon_url = "hash_url"
platform_id = "123456"
last_updated = "2025-04-09T12:49:02.266Z"

[user_libraries.admin]
[[user_libraries.admin.games]]
platform_id = "123456"
name = "Game Name"
playtime_total = 3600
playtime_linux = 1800
```

### `config/tasks.toml`
Contains background tasks:
```toml
[[tasks]]
id = "uuid"
name = "task-name"
description = "Task description"
schedule = "*/5 * * * *"
is_enabled = true
status = "IDLE"
```

## Usage

### Command Line Interface

The migration system provides a CLI script with several commands:

```bash
# Preview migration without making changes
npm run migrate-toml:check

# Dry run with detailed output
npm run migrate-toml:dry-run

# Perform actual migration
npm run migrate-toml

# Manual script execution with options
ts-node src/scripts/migrate-toml-to-db.ts [COMMAND] [OPTIONS]
```

### Available Commands

- `migrate` - Perform the TOML to database migration (default)
- `check` - Check TOML files and preview migration without executing
- `backup` - Create a database backup

### Available Options

- `--dry-run` - Preview what would be migrated without making changes
- `--force` - Force migration even if database contains data
- `--backup` - Create a backup of the database before migration
- `--skip-errors` - Continue migration even if some operations fail
- `-v, --verbose` - Enable verbose output
- `-h, --help` - Show help message

### Examples

```bash
# Check if TOML files are valid and show what would be migrated
npm run migrate-toml:check

# Perform migration with backup and verbose output
ts-node src/scripts/migrate-toml-to-db.ts migrate --backup --verbose

# Force migration and skip errors
ts-node src/scripts/migrate-toml-to-db.ts migrate --force --skip-errors

# Dry run to see what would happen
ts-node src/scripts/migrate-toml-to-db.ts --dry-run --verbose
```

## Programmatic Usage

You can also use the migration system programmatically:

```typescript
import { migrateTomlToDatabase } from '@/lib/migration';

// Perform migration with options
const result = await migrateTomlToDatabase({
  dryRun: false,
  backup: true,
  verbose: true,
  skipErrors: false,
});

if (result.success) {
  console.log(`Migration completed! Created ${result.usersCreated} users.`);
} else {
  console.error('Migration failed:', result.errors);
}
```

## Migration Process

The migration follows this order to maintain referential integrity:

1. **Validate TOML Files** - Check that all files exist and have valid structure
2. **Create Backup** (if requested) - Backup existing database
3. **Migrate Users** - Create user accounts from `default.toml`
4. **Migrate Platforms and Games** - Create platforms and games from `steam.toml`
5. **Migrate User Libraries** - Create user-platform associations
6. **Migrate User Games** - Create user game ownership records
7. **Migrate Tasks** - Create background tasks from `tasks.toml`
8. **Migrate System Config** - Create system configuration entries
9. **Migrate Metadata Providers** - Create metadata provider configurations

## Data Transformations

The system transforms TOML data to match the database schema:

### User Transformation
```toml
# TOML
[users.admin]
username = "admin"
password_hash = "$2b$10$..."
is_admin = true
```

```typescript
// Database
{
  username: "admin",
  passwordHash: "$2b$10$...",
  isAdmin: true,
  createdAt: "2025-04-09T12:49:01.833Z",
  updatedAt: "2025-04-09T12:49:01.833Z"
}
```

### Game Transformation
```toml
# TOML
[games.123456]
name = "Game Name"
icon_url = "hash"
platform_id = "123456"
```

```typescript
// Database
{
  platformId: "steam",
  platformGameId: "123456",
  name: "Game Name",
  iconUrl: "hash",
  lastUpdated: "2025-04-09T12:49:02.266Z"
}
```

## Error Handling

The migration system provides comprehensive error handling:

- **Validation Errors** - Invalid TOML structure or missing required fields
- **Database Errors** - Constraint violations, connection issues
- **File System Errors** - Missing files, permission issues
- **Transformation Errors** - Data format or type conversion issues

### Error Recovery Options

- `--skip-errors` - Continue migration on non-critical errors
- `--backup` - Create backup before migration for rollback capability
- Detailed error reporting with specific error messages and context

## Logging and Output

The migration system provides detailed logging:

```
🚀 Starting TOML to Database Migration
📋 Validating TOML files...
✅ Found 3 valid TOML files: default.toml, steam.toml, tasks.toml
💾 Creating database backup...
🔄 Migrating users...
  ✅ Created user: admin
  ✅ Created user: test4
🔄 Migrating platforms and games...
  ✅ Created platform: Steam
  📦 Created 100 games...
  📦 Created 200 games...
  ✅ Created 287 games total
🎉 Migration completed successfully!

📊 Migration Results:
═══════════════════════════════════════════════════
✅ Status: SUCCESS
⏱️  Duration: 2341ms
👥 Users: 2
🎮 Platforms: 1
🎯 Games: 287
⚙️  Tasks: 3
🔧 System Configs: 2
🏷️  Metadata Providers: 1
```

## Database Schema Compatibility

The migration system is compatible with all supported database types:
- SQLite (default for development)
- PostgreSQL (production)
- MySQL (production)

The schema-agnostic approach uses the existing database helper functions to ensure compatibility across all database types.

## Security Considerations

- **Encrypted Data** - API keys and sensitive data are properly encrypted/decrypted
- **Password Hashes** - Existing password hashes are preserved
- **Backup Security** - Database backups should be stored securely
- **Access Control** - Migration should be run with appropriate database permissions

## Troubleshooting

### Common Issues

1. **TOML Parse Errors**
   - Check TOML syntax with a validator
   - Ensure proper escaping of special characters
   - Verify file encoding (UTF-8)

2. **Database Connection Issues**
   - Verify database configuration in `.env`
   - Check database server is running
   - Ensure proper permissions

3. **Constraint Violations**
   - Check for duplicate usernames or IDs
   - Verify foreign key relationships
   - Use `--skip-errors` for non-critical violations

4. **Memory Issues with Large Game Libraries**
   - Process games in batches (handled automatically)
   - Increase Node.js memory limit if needed
   - Consider running migration on a system with more RAM

### Debug Mode

Enable verbose output for detailed debugging:

```bash
ts-node src/scripts/migrate-toml-to-db.ts migrate --verbose
```

This will show:
- Detailed progress for each step
- Individual item creation logs
- Performance timing information
- Detailed error context

## Contributing

When modifying the migration system:

1. Update type definitions in `types.ts`
2. Add validation logic in `toml-readers.ts`
3. Update transformation logic in `transformers.ts`
4. Update orchestration in `migrator.ts`
5. Update this README with any changes
6. Test with sample TOML data
7. Verify compatibility with all database types

## Future Enhancements

Potential improvements for the migration system:

- **Incremental Migration** - Only migrate changed data
- **Rollback Functionality** - Automated rollback on failure
- **Progress Persistence** - Resume interrupted migrations
- **Parallel Processing** - Parallel game creation for large libraries
- **Data Validation** - More comprehensive TOML data validation
- **Migration History** - Track migration runs and results