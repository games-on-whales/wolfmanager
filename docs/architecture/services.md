# Service Architecture

## Quick Links
- [Service Structure](#service-structure)
- [State Management](#state-management)
- [Service Implementation](#service-implementation)
- [Service Dependencies](#service-dependencies)

## Service Structure

### Directory Layout
```
src/services/
├── api/
│   ├── wolf/              # Wolf-related services
│   │   ├── index.ts       # Main WolfService implementation
│   │   └── types.ts       # Wolf-related types
│   ├── steam/             # Steam integration
│   │   ├── index.ts       # Main SteamService
│   │   ├── artwork.ts     # Artwork handling
│   │   ├── games.ts       # Game management
│   │   └── types.ts       # Steam-related types
│   ├── config/            # Configuration management
│   ├── cache/             # Cache management
│   ├── logs/              # Logging system
│   └── tasks/             # Task management
└── index.ts               # Service exports
```

## Core Services

### WolfService
**Location**: `src/services/api/wolf/index.ts`
**Purpose**: Handles Wolf game management and client pairing
**Key Operations**:
- Game CRUD operations (getGames, updateGame, deleteGame)
- Game synchronization (importGames, syncPlaytime)
- Client pairing (getPendingPairRequests, findPairRequestByPin, confirmPairing)
- Client management (getClients, validateClients)

### ConfigService
**Location**: `src/services/api/config/index.ts`
**Purpose**: Manages application configuration and user settings
**Key Operations**:
- Config CRUD (loadConfig, saveConfig, getConfig)
- User management (addUser, deleteUser, selectUser, editUser)
- Current user tracking (getCurrentUser)

### TaskService
**Location**: `src/services/api/tasks/index.ts`
**Purpose**: Manages long-running operations and their status
**Key Features**:
- Task status tracking
- Progress updates
- Error handling
- Observer pattern for updates

### SteamService
**Location**: `src/services/api/steam/index.ts`
**Purpose**: Handles Steam integration
**Key Features**:
- Game ownership tracking
- Artwork management
- Game metadata synchronization

### CacheService
**Location**: `src/services/api/cache/index.ts`
**Purpose**: Manages artwork caching
**Key Operations**:
- Cache directory management
- Artwork caching and retrieval
- Cache invalidation

### LogService
**Location**: `src/services/api/logs/index.ts`
**Purpose**: Centralized logging system
**Key Features**:
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Component-based logging
- Log retrieval and clearing

## State Management

### Service State Pattern
```typescript
class ServiceExample {
  // Private state
  private state: State;
  private subscribers: Subscriber[] = [];

  // State access
  getState(): State {
    return this.state;
  }

  // State updates
  private updateState(newState: State): void {
    this.state = newState;
    this.notifySubscribers();
  }

  // Subscriber management
  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
}
```

### State Update Patterns

1. Direct Updates
```typescript
private updateState(newState: State): void {
  this.state = newState;
  this.notifySubscribers(this.state);
}
```

2. Optimistic Updates
```typescript
async function optimisticUpdate(): Promise<void> {
  const previousState = this.state;
  try {
    this.updateState(newState);
    await this.saveToServer();
  } catch (error) {
    this.updateState(previousState);
    throw error;
  }
}
```

## Service Dependencies

### Dependency Graph
```
ConfigService → All Services (provides configuration)
TaskService → WolfService, SteamService (monitors operations)
LogService → All Services (provides logging)
CacheService → SteamService (provides artwork caching)
```

### Initialization Order
1. LogService (independent)
2. ConfigService (requires logging)
3. CacheService (requires config)
4. TaskService (requires config)
5. SteamService (requires config, cache)
6. WolfService (requires config, tasks)

## Best Practices

1. State Management:
   - Use private state
   - Provide controlled access
   - Implement subscriber pattern
   - Handle optimistic updates

2. Error Handling:
   - Use ApiError for consistency
   - Log all errors
   - Provide context
   - Handle rollbacks

3. Initialization:
   - Check dependencies
   - Handle async setup
   - Validate configuration
   - Log status

4. Testing:
   - Mock dependencies
   - Test state changes
   - Verify subscribers
   - Check error cases

## Related Documentation
- [Critical Patterns](./critical-patterns.md) - For critical implementation details
- [API Guide](./api.md) - For API integration
- [Testing Guide](./testing.md) - For service testing 