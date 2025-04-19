# WolfUI System Constraints and Limitations

This document outlines the key constraints and limitations of the WolfUI system, including technical limitations, scalability concerns, security considerations, and potential improvement areas.

## Data Storage Constraints

### TOML File-Based Storage

The use of TOML files as the primary data store introduces several significant constraints:

#### Concurrency Issues

**Constraint:** The system lacks a proper file locking mechanism for TOML files.

**Impact:**

- Race conditions can occur during concurrent write operations
- Multiple users updating settings simultaneously may lead to data corruption
- Background tasks writing to configuration while users are making changes can cause lost updates
- No transactional integrity for operations that modify multiple parts of a file

**Example Scenario:**

```
User A loads config → User B loads config → User A modifies and saves → User B modifies and saves (overwriting User A's changes)
```

**Mitigation Options:**

- Implement file locking using a library like `proper-lockfile`
- Add optimistic concurrency control with version checking
- Consider migrating to a database with proper transaction support
- Implement a queue for write operations to serialize changes

#### Scalability Limitations

**Constraint:** TOML files don't scale well for large amounts of data or high-throughput operations.

**Impact:**

- Performance degrades as configuration files grow
- Loading large files into memory consumes significant resources
- No indexing capabilities for efficient data retrieval
- Full file read/write for any change, regardless of size

**Quantitative Limits:**

- Files over 1MB may cause noticeable performance degradation
- More than 100 concurrent users could lead to frequent write conflicts
- Large Steam libraries with thousands of games may cause slow loading times

**Mitigation Options:**

- Split configuration into multiple domain-specific files
- Implement caching to reduce file reads
- Consider a database for high-volume data (e.g., game libraries, logs)

#### Querying Inefficiency

**Constraint:** TOML files lack efficient querying capabilities.

**Impact:**

- Searching or filtering data requires loading the entire file into memory
- Complex queries require custom implementation in application code
- No support for aggregations or joins across data
- Inefficient for reporting or analytics use cases

**Example:**
Finding all games with a specific tag requires:

1. Loading the entire library file
2. Parsing it into memory
3. Iterating through all games
4. Filtering based on criteria
5. Returning the results

**Mitigation Options:**

- Implement in-memory indexing for frequently queried data
- Consider a hybrid approach with a database for query-intensive data
- Use caching for common query patterns

## Architectural Constraints

### Unix Socket Communication

**Constraint:** Communication with the Wolf backend relies on a Unix Domain Socket.

**Impact:**

- WolfUI must run on the same host as the Wolf backend
- Limited to platforms that support Unix sockets
- Socket file permissions must be carefully managed
- No built-in load balancing or failover capabilities

**Deployment Limitations:**

- Cannot distribute components across multiple hosts
- Difficult to containerize separately from Wolf backend
- Limited horizontal scaling options

**Mitigation Options:**

- Add an HTTP API option for distributed scenarios
- Implement a proxy service for cross-host communication
- Consider a message queue for asynchronous communication

### Single-Instance Task Scheduler

**Constraint:** The background task scheduler runs only on a single instance.

**Impact:**

- Tasks only execute on the instance where the scheduler is active
- No coordination between multiple instances
- Potential for duplicate task execution in multi-instance deployments
- Single point of failure for scheduled operations

**Reliability Concerns:**

- If the instance running the scheduler fails, tasks won't execute
- No automatic failover to another instance
- No built-in task distribution or load balancing

**Mitigation Options:**

- Implement a distributed lock mechanism for multi-instance coordination
- Consider a dedicated job queue system (e.g., Bull, Agenda)
- Make tasks idempotent to handle potential duplicate executions
- Add health checks and automatic recovery for the scheduler

## Security Constraints

### Password Hashing Inconsistency

**Constraint:** Previous reviews noted potential inconsistencies in password hashing.

**Impact:**

- Risk of passwords being stored insecurely
- Inconsistent security across different parts of the application
- Potential vulnerability if plain text passwords are stored or logged

**Specific Concerns:**

- The `updateUserAction` function in `src/app/users/actions.ts` may not consistently hash passwords
- Password updates might bypass proper hashing in some code paths

**Mitigation Requirements:**

- Ensure `bcryptjs.hashSync` (or async equivalent) is always used for password updates
- Implement a pre-save hook or middleware to enforce password hashing
- Add unit tests to verify password hashing behavior

### Secret Management

**Constraint:** Sensitive data (API keys, encryption keys) requires secure handling.

**Impact:**

- Risk of exposing sensitive information in logs, client-side code, or error messages
- Encryption key management challenges in production environments
- Limited key rotation capabilities

**Sensitive Data Points:**

- Steam API keys
- SteamGridDB API keys
- Encryption keys for TOML data
- User credentials

**Mitigation Requirements:**

- Implement proper secret management for production environments
- Ensure sensitive data is never exposed in logs or error messages
- Add key rotation capabilities for encryption keys
- Consider a dedicated secrets management solution for production

### Socket Permissions

**Constraint:** The Unix domain socket file requires correct permissions.

**Impact:**

- Incorrect permissions could allow unauthorized access to the Wolf backend
- Overly restrictive permissions could prevent WolfUI from communicating with Wolf
- Permission issues may be difficult to diagnose

**Mitigation Requirements:**

- Implement proper permission checks during startup
- Document correct permission settings for production
- Add clear error messages for permission-related issues

## Performance Constraints

### Client-Side Bundle Size

**Constraint:** Large client-side JavaScript bundles can impact performance.

**Impact:**

- Slower initial page load times
- Increased memory usage on client devices
- Reduced performance on low-end devices or slow connections

**Contributing Factors:**

- UI component libraries
- Client-side validation libraries
- Third-party dependencies

**Mitigation Options:**

- Implement code splitting and lazy loading
- Use Server Components where possible to reduce client-side JavaScript
- Optimize bundle size with tree shaking and dead code elimination
- Consider performance budgets for key pages

### Memory Usage

**Constraint:** Loading large configuration files into memory can consume significant resources.

**Impact:**

- Higher memory usage on the server
- Potential out-of-memory errors with very large datasets
- Increased garbage collection activity

**Critical Operations:**

- Loading and parsing large TOML files
- Processing large Steam libraries
- Handling concurrent requests with large data sets

**Mitigation Options:**

- Implement streaming for large file operations
- Add pagination for large data sets
- Consider memory-efficient data structures
- Monitor and optimize memory usage

## Maintenance Constraints

### Centralized Configuration Module

**Constraint:** The `config.ts` module is becoming overly complex with multiple responsibilities.

**Impact:**

- Increased risk of bugs due to complexity
- Difficult to maintain and extend
- Single point of failure for many operations
- Testing challenges due to broad scope

**Specific Issues:**

- Handles both reading and writing of multiple configuration files
- Manages encryption and decryption of sensitive data
- Implements validation logic for various data types
- Contains business logic for user and client management

**Mitigation Requirements:**

- Refactor into smaller, domain-specific modules
- Separate concerns (reading, writing, encryption, validation)
- Improve test coverage
- Consider a more structured approach to configuration management

### Error Handling for Socket Communication

**Constraint:** Direct socket communication requires robust error handling.

**Impact:**

- Connection issues may not be properly detected or reported
- Timeouts could lead to hanging operations
- Unexpected responses from the Wolf backend may cause errors

**Failure Scenarios:**

- Socket file not found or inaccessible
- Wolf backend not running
- Connection timeout
- Malformed response data

**Mitigation Requirements:**

- Implement comprehensive error handling for all socket operations
- Add timeouts for socket operations
- Provide clear error messages for common failure scenarios
- Consider retry mechanisms for transient failures

## Deployment Constraints

### Host Coupling

**Constraint:** WolfUI must run on the same host as the Wolf backend.

**Impact:**

- Limited deployment flexibility
- Difficult to scale components independently
- Resource contention between WolfUI and Wolf backend
- Single point of failure for both components

**Deployment Scenarios Affected:**

- Containerized deployments
- Cloud hosting
- Load-balanced environments
- High-availability configurations

**Mitigation Options:**

- Implement an HTTP API option for the Wolf backend
- Consider a microservices approach for future versions
- Document deployment best practices for the coupled architecture

### Environment Dependencies

**Constraint:** The application has specific environment dependencies.

**Impact:**

- Deployment complexity
- Potential compatibility issues across different environments
- Dependency on specific Node.js versions or system libraries

**Key Dependencies:**

- Node.js runtime
- Unix socket support
- File system access for TOML files
- Encryption libraries

**Mitigation Options:**

- Document all environment dependencies
- Provide containerized deployment options
- Implement compatibility checks during startup
- Consider a more portable architecture for future versions

## Future Improvement Areas

### Database Migration

**Opportunity:** Migrate from TOML files to a proper database.

**Benefits:**

- Improved concurrency handling
- Better scalability for larger datasets
- Efficient querying capabilities
- Proper transaction support
- Improved data integrity

**Options:**

- SQLite for simple deployments (still file-based but with proper concurrency)
- PostgreSQL for more robust, scalable deployments
- MongoDB for document-oriented data that doesn't require complex relationships

**Implementation Considerations:**

- Maintain backward compatibility during transition
- Provide migration tools for existing data
- Update the configuration service to support both storage methods

### API-Based Wolf Communication

**Opportunity:** Add an HTTP API option for Wolf backend communication.

**Benefits:**

- Ability to distribute components across multiple hosts
- Improved scalability options
- Better platform compatibility
- Simplified containerization

**Implementation Considerations:**

- Maintain Unix socket support for backward compatibility
- Implement authentication for the HTTP API
- Consider performance implications of network vs. socket communication

### Distributed Task Scheduling

**Opportunity:** Implement a more robust, distributed task scheduling system.

**Benefits:**

- Improved reliability with automatic failover
- Ability to distribute tasks across multiple instances
- Better monitoring and management capabilities
- Support for more complex scheduling patterns

**Options:**

- Dedicated job queue system (Bull, Agenda)
- Distributed lock mechanism for the existing scheduler
- External scheduling service

**Implementation Considerations:**

- Maintain backward compatibility for existing tasks
- Provide migration path for task definitions
- Consider operational complexity trade-offs
