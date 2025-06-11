# Database Architecture Documentation

## Overview

WolfManager uses Drizzle ORM to provide a type-safe, multi-database abstraction layer that supports SQLite, PostgreSQL, and MySQL. This architecture enables flexible deployment options while maintaining data integrity and performance.

## Database Schema Design

### Core Entities

The database schema is organized around five core domains:

#### 1. Users Domain
- **Primary Table**: `users`
- **Purpose**: User authentication, authorization, and profile management
- **Key Relationships**: One-to-many with client devices and user libraries

#### 2. Client Devices Domain  
- **Primary Table**: `client_devices`
- **Purpose**: Management of paired Moonlight clients and device authentication
- **Key Relationships**: Many-to-one with users

#### 3. Games Domain
- **Tables**: `platforms`, `games`, `user_libraries`, `user_games`
- **Purpose**: Multi-platform game catalog and user-specific game libraries
- **Key Relationships**: Complex many-to-many relationships between users, platforms, and games

#### 4. Tasks Domain
- **Primary Table**: `tasks`
- **Purpose**: Background task scheduling and execution tracking
- **Key Relationships**: Self-contained with system configuration integration

#### 5. System Configuration Domain
- **Tables**: `system_config`, `metadata_providers`
- **Purpose**: Application configuration and external service integration
- **Key Relationships**: Referenced by other domains for configuration lookup

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│    users    │1      1:N│  client_devices  │         │   tasks     │
│─────────────│◄─────────│──────────────────│         │─────────────│
│ id (PK)     │          │ id (PK)          │         │ id (PK)     │
│ username    │          │ user_id (FK)     │         │ name        │
│ password    │          │ device_name      │         │ schedule    │
│ is_admin    │          │ pair_secret      │         │ status      │
│ steam_id    │          │ last_seen        │         │ enabled     │
└─────────────┘          └──────────────────┘         └─────────────┘
       │                                                      │
       │1                                                     │
       │                                                      │
       │N                                               ┌─────────────┐
┌─────────────┐         ┌──────────────────┐           │system_config│
│user_libraries│1      1:N│   user_games     │           │─────────────│
│─────────────│◄─────────│──────────────────│           │ key (PK)    │
│ id (PK)     │          │ id (PK)          │           │ value       │
│ user_id (FK)│          │ library_id (FK)  │           │ updated_at  │
│ platform_id │          │ game_id (FK)     │           └─────────────┘
│ steam_user  │          │ playtime_minutes │                  │
└─────────────┘          │ last_played      │                  │
       │                 │ is_favorite      │           ┌─────────────┐
       │N                └──────────────────┘           │metadata_    │
       │                          │N                    │ providers   │
       │1                         │                     │─────────────│
┌─────────────┐                   │1                    │ id (PK)     │
│  platforms  │1                ┌─────────────┐         │ name        │
│─────────────│◄────────────────│    games    │         │ enabled     │
│ id (PK)     │N                │─────────────│         │ config      │
│ name        │                 │ id (PK)     │         │ priority    │
│ version     │                 │ platform_id │         └─────────────┘
└─────────────┘                 │ platform_   │
                                │  game_id    │
                                │ name        │
                                │ icon_url    │
                                └─────────────┘
```

## Multi-Database Support Architecture

### Database Abstraction Layer

WolfManager implements database abstraction through:

1. **Schema Variants**: Each table has variants for SQLite, PostgreSQL, and MySQL
2. **Runtime Type Selection**: Helper functions select the appropriate schema at runtime
3. **Connection Management**: Database connections are managed per database type
4. **Migration Compatibility**: Migrations are generated for the primary database (SQLite) but are compatible across backends

### Database Type Selection

```typescript
// Example: User table selection based on database type
function getUsersTable() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return usersSqlite;
    case 'postgresql':
      return usersPostgres;
    case 'mysql':
      return usersMysql;
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}
```

### Connection Configuration

- **SQLite**: File-based storage with WAL mode for concurrency
- **PostgreSQL**: Connection pooling with SSL support
- **MySQL**: Connection pooling with optimized settings

## Migration Architecture

### TOML to Database Migration

The migration system transforms legacy TOML configuration files into the new database schema:

#### Migration Process Flow

1. **TOML Reading**: Parse and validate existing TOML files
2. **Data Transformation**: Convert TOML structures to database entities
3. **Validation**: Ensure data integrity and constraint compliance
4. **Batch Processing**: Insert data in optimized batches
5. **Verification**: Validate successful migration

#### Migration Components

- **Readers**: TOML file parsing and validation
- **Transformers**: Data structure conversion
- **Migrator**: Orchestrates the complete migration process
- **Validators**: Ensure data integrity

### Schema Migrations

Traditional schema migrations handle database structure changes:

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate
```

## Indexing Strategy

### Primary Indexes

Each table includes optimized indexes for common query patterns:

#### Users Table
- Primary: `id` (UUID)
- Unique: `username`
- Index: `steam_id` (for Steam integration)

#### Client Devices Table
- Primary: `id` (UUID)
- Index: `user_id` (foreign key)
- Unique: `pair_secret` (for device pairing)

#### Games Table
- Primary: `id` (UUID)
- Unique: `platform_id + platform_game_id` (composite)
- Index: `name` (for search functionality)

#### User Games Table
- Primary: `id` (UUID)
- Index: `library_id, game_id` (composite for lookups)
- Index: `last_played` (for recent games)

### Performance Optimization

- **Composite Indexes**: Multi-column indexes for complex queries
- **Partial Indexes**: Conditional indexes for specific use cases
- **Foreign Key Indexes**: Automatic indexing of foreign key relationships

## Data Relationships

### User-Centric Design

The schema follows a user-centric design where:

1. **Users** are the central entity
2. **Client Devices** belong to users
3. **User Libraries** represent user-platform relationships
4. **User Games** track individual game ownership and playtime

### Relationship Cardinalities

- User → Client Devices: One-to-Many
- User → User Libraries: One-to-Many
- User Library → User Games: One-to-Many
- Platform → Games: One-to-Many
- Game → User Games: One-to-Many

## Security Considerations

### Data Encryption

- **Password Hashes**: Bcrypt with salt rounds
- **Steam API Keys**: Encrypted at rest
- **Pair Secrets**: Cryptographically secure random generation

### Access Control

- **Role-Based Access**: Admin vs standard user roles
- **Data Isolation**: Users can only access their own data
- **API Key Management**: Secure storage and retrieval

## Performance Characteristics

### Database-Specific Optimizations

#### SQLite
- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Pragma Settings**: Optimized for application workload
- **File Locking**: Proper concurrent access handling

#### PostgreSQL
- **Connection Pooling**: Efficient connection management
- **Query Optimization**: PostgreSQL-specific query hints
- **VACUUM Strategy**: Automated maintenance scheduling

#### MySQL
- **InnoDB Engine**: ACID compliance and foreign key support
- **Connection Pooling**: MySQL-specific pool configuration
- **Index Optimization**: MySQL-optimized index strategies

### Scalability Considerations

- **Horizontal Scaling**: Database can be moved to dedicated servers
- **Caching Layer**: Application-level caching for frequent queries
- **Read Replicas**: Support for read-only database replicas

## Backup and Recovery

### Backup Strategies

#### SQLite
- **File-based Backup**: Simple file copying with application shutdown
- **Online Backup**: SQLite backup API for hot backups
- **Volume Snapshots**: Filesystem-level backup strategies

#### PostgreSQL/MySQL
- **Database Dumps**: pg_dump / mysqldump for complete backups
- **Point-in-Time Recovery**: Transaction log replay capability
- **Replication**: Streaming replication for disaster recovery

### Migration Backup

The migration tool includes automatic backup functionality:

```bash
# Migration with automatic backup
npm run migrate-toml -- migrate --backup --verbose
```

## Monitoring and Observability

### Database Health Checks

```typescript
import { checkDatabaseHealth } from '@/lib/db';

// Verify database connectivity and basic operations
const isHealthy = await checkDatabaseHealth();
```

### Performance Monitoring

- **Query Performance**: Slow query logging and analysis
- **Connection Metrics**: Pool utilization and connection counts
- **Index Usage**: Monitor index effectiveness and usage patterns

## Future Considerations

### Planned Enhancements

1. **Read Replicas**: Support for read-only database replicas
2. **Sharding Strategy**: Horizontal partitioning for large deployments
3. **Caching Layer**: Redis integration for frequently accessed data
4. **Analytics Database**: Separate OLAP database for reporting

### Migration Path Forward

The current architecture supports:
- **Zero-downtime migrations** for schema changes
- **Rolling deployments** with backward compatibility
- **Data archival** strategies for long-term storage

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Adjust connection pool settings
2. **Lock Contention**: Monitor concurrent access patterns
3. **Migration Failures**: Use migration rollback and recovery procedures
4. **Performance Degradation**: Analyze query patterns and index usage

### Debug Tools

- **Drizzle Studio**: Web-based database browser
- **Query Logging**: Enable debug logging for SQL queries
- **Performance Profiling**: Database-specific profiling tools

This architecture provides a robust foundation for WolfManager's data layer, supporting current requirements while maintaining flexibility for future growth and enhancement.