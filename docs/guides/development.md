
# Development Workflow

This diagram illustrates our release-based development workflow where `stable` serves as the main production branch.

```mermaid
%%{init: { 'logLevel': 'info', 'theme': 'base', 'gitGraph': {'showBranches': true, 'showCommitLabel': true, 'mainBranchName': 'stable'}} }%%
gitGraph
    commit id: "Initial commit" tag: "202506.001"
    
    %% Create release branch for June 2025 second release
    branch release/202506.002
    checkout release/202506.002
    commit id: "Setup release 202506.002"
    
    %% Feature development from release branch
    branch feature/user-auth
    checkout feature/user-auth
    commit id: "Add login component"
    commit id: "Implement JWT auth"
    commit id: "Add password validation"
    
    %% Another feature branch
    checkout release/202506.002
    branch feature/dashboard
    checkout feature/dashboard
    commit id: "Create dashboard layout"
    commit id: "Add metrics widgets"
    
    %% Hotfix branch for critical issue
    checkout stable
    branch hotfix/security-patch
    checkout hotfix/security-patch
    commit id: "Fix XSS vulnerability" type: HIGHLIGHT
    
    %% Merge hotfix back to stable immediately
    checkout stable
    merge hotfix/security-patch
    commit id: "Deploy hotfix" tag: "202506.001.1"
    
    %% Continue feature development
    checkout feature/user-auth
    commit id: "Add unit tests"
    
    %% Merge completed features into release
    checkout release/202506.002
    merge feature/user-auth
    commit id: "Integrate auth feature"
    
    checkout release/202506.002
    merge feature/dashboard
    commit id: "Integrate dashboard"
    
    %% Bug fix directly on release branch
    commit id: "Fix integration issues"
    commit id: "Update documentation"
    
    %% Merge hotfix into release branch to keep in sync
    merge hotfix/security-patch
    commit id: "Sync security patch"
    
    %% Final release preparation
    commit id: "Bump version to 202506.002"
    commit id: "Update changelog"
    
    %% Deploy to stable when ready
    checkout stable
    merge release/202506.002
    commit id: "Release 202506.002" tag: "202506.002"
```

## Workflow Explanation

### Branch Strategy
- **`stable`**: Main production branch containing stable, released code
- **`release/YYYYMM.###`**: Release preparation branches created from stable
- **`feature/feature-name`**: Feature development branches created from release
- **`hotfix/issue-name`**: Critical fixes created from stable for immediate deployment

### Versioning Scheme
Our releases follow the **YYYYMM.###** format:
- **YYYY**: 4-digit year (e.g., 2025)
- **MM**: 2-digit month (01-12)
- **###**: 3-digit increment starting from 001 for each month

**Examples:**
- `202506.001` - First release in June 2025
- `202506.002` - Second release in June 2025
- `202507.001` - First release in July 2025
- `202506.001.1` - Hotfix for 202506.001

### Development Process
1. **Release Planning**: Create release branch from `stable` using next version number (e.g., `release/202506.002`)
2. **Feature Development**: Create feature branches from the target release branch
3. **Feature Integration**: Merge completed features back into release branch
4. **Hotfix Handling**: Create hotfix branches from `stable`, deploy immediately with patch version (e.g., `202506.001.1`)
5. **Release Deployment**: When release is ready, merge back to `stable` with version tag

### Docker Tagging Strategy

Our Docker images are automatically built and tagged through GitHub Actions for both preview and production releases.

#### Automated Tagging Process

**Preview Releases (Release Branch)**
1. **Trigger**: Docker build runs automatically on push to `release/YYYYMM.###` branches
2. **Version Generation**: Uses `preview-YYYYMM.###` format for testing
3. **Tag Creation**: Automatically creates preview tag for testing environments
4. **Registry**: Images are pushed to GitHub Container Registry (`ghcr.io`)

**Production Releases (Stable Branch)**
1. **Trigger**: Docker build runs automatically on push to `stable` branch
2. **Version Generation**: Uses the same YYYYMM.### format as git tags
3. **Tag Creation**: Automatically creates and pushes git tag, then builds Docker image with matching tag
4. **Registry**: Images are pushed to GitHub Container Registry (`ghcr.io`)

#### Docker Tag Examples
- **Preview Release**: `ghcr.io/[repository]/wolfmanager:preview-202506.002`
- **Production Release**: `ghcr.io/[repository]/wolfmanager:202506.002`
- **Latest Stable**: `ghcr.io/[repository]/wolfmanager:latest` (always points to most recent stable)
- **Development Branches**: `ghcr.io/[repository]/wolfmanager:feature-user-auth` (branch name sanitized)

#### Tag Safety Features
- **Duplicate Prevention**: Workflow checks for existing tags before creation
- **Automatic Increment**: Scans existing tags to determine next increment number
- **Multi-platform**: Builds for both `linux/amd64` and `linux/arm64`
- **Metadata**: Includes build information, version, and creation timestamp

#### Complete Workflow Integration
```
Feature Merge → Release Branch → Preview Docker → Testing → Stable Branch → Production Docker
     ↓              ↓                ↓              ↓           ↓              ↓
  feature/auth  release/202506.002  preview-202506.002  QA Testing  202506.002  wolfmanager:202506.002
```

#### Deployment Pipeline
1. **Development**: Features merged into release branch trigger preview builds
2. **Testing**: Preview images (`preview-YYYYMM.###`) deployed to staging/test environments
3. **Validation**: QA testing performed on preview releases
4. **Production**: Release branch merged to stable triggers production build with final version tag

### Key Improvements
- **Clear Semantic Commits**: Descriptive commit messages that explain the actual changes
- **Proper Branching Strategy**: Follows the specified stable→release→feature workflow
- **Date-based Versioning**: Uses YYYYMM.### format for clear chronological tracking
- **Automated Docker Deployment**: Seamless integration between git releases and container deployment
- **Visual Clarity**: Enabled branch visibility and commit labels for better readability
- **Documentation Context**: Added comprehensive explanation of the workflow
- **Realistic Scenarios**: Includes common development scenarios like hotfixes and feature integration

## Database Development

WolfManager uses Drizzle ORM with support for multiple database backends. This section covers database development workflows, schema management, and testing.

### Database Setup for Development

#### Prerequisites

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Compile better-sqlite3** (for SQLite support):
   ```bash
   npm rebuild better-sqlite3
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env to configure DATABASE_TYPE (default: sqlite)
   ```

#### Database Initialization

The database will be automatically initialized on first application run. For manual initialization:

```bash
# Apply migrations
npm run db:migrate

# Or push schema changes (development only)
npm run db:push
```

### Schema Development Workflow

When making changes to the database schema:

1. **Modify schema files** in [`src/lib/db/schema/`](../src/lib/db/schema/)
2. **Generate migration**: `npm run db:generate`
3. **Review generated migration** in [`src/lib/db/migrations/`](../src/lib/db/migrations/)
4. **Apply migration**: `npm run db:migrate`
5. **Test your changes** thoroughly

#### Schema Files Structure

- [`users.ts`](../src/lib/db/schema/users.ts) - User accounts and authentication
- [`clients.ts`](../src/lib/db/schema/clients.ts) - Client device management
- [`games.ts`](../src/lib/db/schema/games.ts) - Games, platforms, and user libraries
- [`tasks.ts`](../src/lib/db/schema/tasks.ts) - Background task management
- [`system.ts`](../src/lib/db/schema/system.ts) - System configuration and metadata providers

### Helper Functions

WolfManager provides type-safe helper functions for all database operations:

```typescript
import {
  getUserById,
  addUser,
  getAllGames,
  getSystemConfig,
  setSystemConfig
} from '@/lib/db/helpers';

// User operations
const user = await getUserById('user-id');
const newUser = await addUser({
  username: 'newuser',
  passwordHash: hashedPassword,
  isAdmin: false,
});

// Game operations
const games = await getAllGames();

// System configuration
const configValue = await getSystemConfig('some.config.key');
await setSystemConfig('some.config.key', 'new value');
```

#### Helper Functions by Domain

- **Users**: [`getUserById()`](../src/lib/db/helpers/users.ts), [`addUser()`](../src/lib/db/helpers/users.ts), [`updateUser()`](../src/lib/db/helpers/users.ts), etc.
- **Games**: [`getGameById()`](../src/lib/db/helpers/games.ts), [`addGame()`](../src/lib/db/helpers/games.ts), [`searchGames()`](../src/lib/db/helpers/games.ts), etc.
- **Tasks**: [`getTaskById()`](../src/lib/db/helpers/tasks.ts), [`addTask()`](../src/lib/db/helpers/tasks.ts), [`updateTaskStatus()`](../src/lib/db/helpers/tasks.ts), etc.
- **System**: [`getSystemConfig()`](../src/lib/db/helpers/system.ts), [`setSystemConfig()`](../src/lib/db/helpers/system.ts), etc.

### Testing with Different Database Backends

#### SQLite (Default)
```bash
# Default development setup
npm run dev
```

#### PostgreSQL
```bash
# Start PostgreSQL (using Docker)
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -e POSTGRES_DB=wolfmanager -p 5432:5432 -d postgres:15

# Configure environment
DATABASE_TYPE=postgresql DATABASE_URL=postgresql://postgres:password@localhost:5432/wolfmanager npm run dev
```

#### MySQL
```bash
# Start MySQL (using Docker)
docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=wolfmanager -p 3306:3306 -d mysql:8

# Configure environment
DATABASE_TYPE=mysql DATABASE_URL=mysql://root:password@localhost:3306/wolfmanager npm run dev
```

### Database Operations Reference

#### Schema Management
```bash
npm run db:generate    # Generate new migration after schema changes
npm run db:migrate     # Apply pending migrations
npm run db:push        # Push schema changes (development only)
npm run db:studio      # Open Drizzle Studio database browser
```

#### TOML Migration
```bash
npm run migrate-toml:check     # Preview TOML migration
npm run migrate-toml:dry-run   # Dry run migration
npm run migrate-toml           # Execute TOML migration
npm run migrate-toml:test      # Test migration components
```

### Database Browser

Use Drizzle Studio to browse and manage your database:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:3000/studio` where you can:
- Browse all tables and data
- Execute queries
- Manage relationships
- View schema information

### Performance Considerations

#### Indexes
The schema includes optimized indexes for:
- User lookups by username and Steam ID
- Game searches and filtering
- Task status and execution queries
- Client device pairing operations

#### Connection Pooling
- **SQLite**: Uses WAL mode for better concurrency
- **PostgreSQL**: Automatic connection pooling
- **MySQL**: Connection pooling with optimized settings

### Debugging Database Issues

#### Enable Debug Logging
```bash
# Add to .env file
LOG_LEVEL=debug
```

#### Check Database Health
```typescript
import { checkDatabaseHealth } from '@/lib/db';

const isHealthy = await checkDatabaseHealth();
console.log('Database healthy:', isHealthy);
```

#### Common Issues

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

### Contributing Database Changes

When contributing database-related changes:

1. **Update schemas** in [`src/lib/db/schema/`](../src/lib/db/schema/)
2. **Generate migrations** with `npm run db:generate`
3. **Add helper functions** in [`src/lib/db/helpers/`](../src/lib/db/helpers/)
4. **Update exports** in index files
5. **Add tests** for new functionality
6. **Update documentation** if needed

See the [Database Layer README](../src/lib/db/README.md) for complete API documentation.

## Security & Environment Management

### Automatic Secret Generation

WolfManager implements automatic generation of cryptographic secrets to simplify deployment while maintaining security best practices. This feature addresses the common issue of developers using weak or default secrets in production.

#### Implementation Overview

The auto-generation system is implemented in [`src/lib/env.ts`](../src/lib/env.ts) and automatically invoked during application startup via [`src/instrumentation.ts`](../src/instrumentation.ts).

**Key Components:**

1. **[`ensureSecureKeys()`](../src/lib/env.ts:61)** - Main function that checks and generates missing secrets
2. **[`generateSecureKey()`](../src/lib/env.ts:14)** - Cryptographically secure key generation using Node.js crypto
3. **[`readEnvFile()`](../src/lib/env.ts)** / **[`writeEnvFile()`](../src/lib/env.ts)** - Environment file management
4. **[`getLocalIpAddress()`](../src/lib/env.ts:48)** - Development URL auto-configuration

#### Auto-Generation Process

```typescript
// Called automatically during application startup
export function ensureSecureKeys(): void {
  // 1. Check if secrets already exist in environment variables
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  const hasEncryptionKey = !!process.env.ENCRYPTION_KEY;
  
  // 2. Skip if both secrets are already available
  if (hasNextAuthSecret && hasEncryptionKey) {
    return;
  }
  
  // 3. Read existing .env.local file
  const envVars = readEnvFile();
  
  // 4. Generate missing secrets
  if (!hasNextAuthSecret && !envVars.NEXTAUTH_SECRET) {
    envVars.NEXTAUTH_SECRET = generateSecureKey(64);
  }
  
  if (!hasEncryptionKey && (!envVars.ENCRYPTION_KEY || envVars.ENCRYPTION_KEY.length !== 32)) {
    envVars.ENCRYPTION_KEY = generateSecureKey(32);
  }
  
  // 5. Write updated .env.local file
  writeEnvFile(envVars);
  
  // 6. Set environment variables for current process
  process.env.NEXTAUTH_SECRET = envVars.NEXTAUTH_SECRET;
  process.env.ENCRYPTION_KEY = envVars.ENCRYPTION_KEY;
}
```

#### Security Features

**Cryptographic Security:**
- Uses Node.js `crypto.randomBytes()` for maximum entropy
- Generates 64-character NEXTAUTH_SECRET (512 bits of entropy)
- Generates 32-character ENCRYPTION_KEY (256 bits of entropy)
- No predictable patterns or weak default values

**Environment Precedence:**
1. Environment variables (highest priority)
2. Existing `.env.local` file values
3. Auto-generation (fallback)

**Container Support:**
- Works seamlessly in Docker containers
- Respects volume mounts for persistence
- Handles both development and production environments

#### Development Workflow

**Local Development:**
```bash
# Secrets are auto-generated on first run
npm run dev

# Check generated secrets
cat .env.local

# Force regeneration (remove existing file)
rm .env.local
npm run dev
```

**Docker Development:**
```bash
# Auto-generation works in containers
docker run -v $(pwd):/app wolfmanager:dev

# With persistence
docker run -v wolfmanager_config:/app/config wolfmanager:latest
```

#### Testing Auto-Generation

**Unit Testing:**
```typescript
import { ensureSecureKeys, generateSecureKey } from '@/lib/env';

describe('Secret Generation', () => {
  test('generates secure keys', () => {
    const key = generateSecureKey(32);
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[a-f0-9]+$/);
  });
  
  test('respects existing environment variables', () => {
    process.env.NEXTAUTH_SECRET = 'existing-secret';
    ensureSecureKeys();
    expect(process.env.NEXTAUTH_SECRET).toBe('existing-secret');
  });
});
```

**Integration Testing:**
```bash
# Test in clean environment
rm -f .env.local
unset NEXTAUTH_SECRET ENCRYPTION_KEY
npm run dev

# Verify secrets were generated
grep -E "(NEXTAUTH_SECRET|ENCRYPTION_KEY)" .env.local
```

#### Debugging Auto-Generation

**Enable Debug Logging:**
The system provides console output indicating when secrets are generated:

```
[ENV] Checking and ensuring secure keys are available...
[ENV] Generated secure keys: NEXTAUTH_SECRET, ENCRYPTION_KEY
[ENV] Updated .env.local with generated keys
```

**Common Issues:**

1. **Permission errors writing .env.local:**
   ```bash
   # Check write permissions
   ls -la .env.local
   chmod 644 .env.local
   ```

2. **Container persistence issues:**
   ```bash
   # Ensure proper volume mounts
   docker run -v wolfmanager_config:/app/config ...
   ```

3. **Environment variable conflicts:**
   ```bash
   # Check existing environment
   env | grep -E "(NEXTAUTH_SECRET|ENCRYPTION_KEY)"
   ```

#### Security Considerations

**Best Practices:**
- Auto-generation is enabled by default for security
- Manual secrets should be at least as strong as auto-generated ones
- Secrets are never logged or exposed in error messages
- `.env.local` files should be excluded from version control

**Production Deployment:**
- Auto-generation works in all deployment scenarios
- Consider using external secret management for enterprise deployments
- Rotate secrets periodically using the regeneration process
- Monitor logs for generation events during deployments

#### Migration from Manual Setup

Existing deployments with manual secrets continue to work unchanged:

```bash
# Existing .env.local with manual secrets
NEXTAUTH_SECRET=manually-set-secret
ENCRYPTION_KEY=manually-set-key

# Auto-generation respects existing values
npm run dev  # No changes made to existing secrets
```

#### Future Enhancements

Planned improvements to the auto-generation system:
- Secret rotation scheduling
- Integration with external secret managers (HashiCorp Vault, AWS Secrets Manager)
- Backup and recovery mechanisms
- Enhanced logging and monitoring