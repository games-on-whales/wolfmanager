# Critical Implementation Patterns

This document outlines critical implementation patterns that **must be followed** to maintain system stability.

## Quick Links
- [Client ID Handling](#client-id-handling)
- [Game Synchronization](#game-synchronization)
- [Cache Management](#cache-management)
- [Task Management](#task-management)
- [Configuration Updates](#configuration-updates)

## Client ID Handling

### Overview
Client IDs from Wolf are large numbers that exceed JavaScript's safe integer limits. They must be handled as BigInt strings throughout the application.

### Implementation Location
- Primary: `src/services/api/wolf/index.ts`
- Related: 
  - `src/components/pairing/PairingDialog.tsx`
  - `src/components/UserSettings.tsx`

### Critical Pattern
```typescript
// CORRECT: Use BigInt for client IDs
interface Client {
  id: string;  // BigInt as string
  name: string;
}

// Handle client ID as string
function handleClient(clientId: string) {
  // Validate client ID format
  if (!/^\d+$/.test(clientId)) {
    throw new Error('Invalid client ID format');
  }
  
  // Store as string, treat as BigInt when needed
  const numericId = BigInt(clientId);
  return numericId.toString();
}

// INCORRECT: Using number for client IDs
interface WrongClient {
  id: number;  // Will lose precision
  name: string;
}
```

### Dependencies
- WolfService depends on correct client ID handling
- PairingDialog component uses client IDs for pairing
- UserSettings component manages client relationships

### Warning Signs
1. Loss of Precision:
```typescript
// WARNING: Will lose precision
const clientId = 123456789123456789;
const wrongId = Number(clientId);  // Precision lost

// CORRECT: Keep as string
const safeId = '123456789123456789';
```

2. Comparison Issues:
```typescript
// WARNING: Direct number comparison
if (clientId === 123456789123456789) // Unsafe

// CORRECT: String comparison
if (clientId === '123456789123456789') // Safe
```

3. API Responses:
```typescript
// WARNING: Parsing as number
const response = { clientId: Number(rawId) };

// CORRECT: Keep as string
const response = { clientId: rawId.toString() };
```

### Usage Examples
1. Pairing New Client:
```typescript
async function pairClient(client: PairedClient, name: string) {
  const clientId = BigInt(client.client_id).toString();
  await ConfigService.editUser(
    currentUser,
    undefined,
    undefined,
    {
      ...existingClients,
      [clientId]: { friendlyName: name }
    }
  );
}
```

2. Finding Client:
```typescript
function findClient(clientId: string) {
  const normalizedId = BigInt(clientId).toString();
  return clients.find(c => BigInt(c.client_id).toString() === normalizedId);
}
```

## Game Synchronization

### Implementation Location
- Primary: `src/services/api/wolf/games.ts`
- Related: `src/services/api/steam/games.ts`

### Critical Pattern
```typescript
interface Game {
  id: string;
  name: string;
  playtime: number;
  lastPlayed: string;
  source: 'wolf' | 'steam';
}

// CORRECT: Atomic updates
async function updateGame(game: Game): Promise<void> {
  // Validate required fields
  if (!game.id || !game.name) {
    throw new Error('Missing required fields');
  }

  // Handle partial updates
  const existing = await getGame(game.id);
  const updated = {
    ...existing,
    ...game,
    lastUpdated: new Date().toISOString()
  };

  await saveGame(updated);
}

// INCORRECT: Direct updates without validation
async function unsafeUpdate(game: Partial<Game>): Promise<void> {
  await saveGame(game); // Dangerous
}
```

### Dependencies
- SteamService provides game data
- WolfService manages game state
- TaskService tracks sync progress

### Warning Signs
1. Missing Fields:
```typescript
// WARNING: Partial update without validation
await updateGame({ id: '123' }); // Missing name

// CORRECT: Full update with validation
await updateGame({
  id: '123',
  name: 'Game Name',
  playtime: 0,
  lastPlayed: new Date().toISOString(),
  source: 'wolf'
});
```

2. Race Conditions:
```typescript
// WARNING: Multiple concurrent updates
games.forEach(async game => {
  await updateGame(game);
});

// CORRECT: Sequential updates
for (const game of games) {
  await updateGame(game);
}
```

## Cache Management

### Implementation Location
- Primary: `src/services/api/cache/index.ts`
- Related: `src/services/api/steam/artwork.ts`

### Critical Pattern
```typescript
class CacheService {
  // CORRECT: Proper cache operations
  async getOrFetch(key: string, fetch: () => Promise<Data>): Promise<Data> {
    // Check cache first
    const cached = await this.get(key);
    if (cached) return cached;

    // Fetch and cache
    const data = await fetch();
    await this.set(key, data);
    return data;
  }

  // INCORRECT: Race condition prone
  async unsafeGetOrFetch(key: string, fetch: () => Promise<Data>): Promise<Data> {
    if (await this.has(key)) {
      return this.get(key);
    }
    const data = await fetch();
    await this.set(key, data);
    return data;
  }
}
```

### Dependencies
- SteamService uses cache for artwork
- UI components display cached artwork
- TaskService manages cache operations

### Warning Signs
1. Cache Invalidation:
```typescript
// WARNING: Direct cache deletion
await cache.delete(key);

// CORRECT: Managed invalidation
await cache.invalidate(key, {
  notifySubscribers: true,
  cleanupFiles: true
});
```

2. Cache Consistency:
```typescript
// WARNING: Inconsistent cache state
await cache.set(key, data);
await cache.delete(key);
// Data might still be in use

// CORRECT: Atomic operations
await cache.atomic(key, async () => {
  await cache.set(key, data);
  await cache.cleanup();
});
```

## Task Management

### Implementation Location
- Primary: `src/services/api/tasks/index.ts`
- Related: `src/components/TaskManager.tsx`

### Critical Pattern
```typescript
interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  error?: Error;
}

class TaskService {
  // CORRECT: Proper task lifecycle
  async runTask<T>(
    type: TaskType,
    operation: (update: ProgressUpdate) => Promise<T>
  ): Promise<T> {
    const task = await this.create({ type });
    try {
      const result = await operation(progress => {
        this.updateProgress(task.id, progress);
      });
      await this.complete(task.id);
      return result;
    } catch (error) {
      await this.fail(task.id, error);
      throw error;
    }
  }
}
```

### Dependencies
- WolfService uses tasks for sync
- SteamService uses tasks for updates
- UI components show task progress

### Warning Signs
1. Task State:
```typescript
// WARNING: Direct state mutation
task.status = 'complete';

// CORRECT: State transition
await taskService.transition(task.id, 'complete');
```

2. Error Handling:
```typescript
// WARNING: Lost error context
task.error = new Error('Failed');

// CORRECT: Error with context
await taskService.fail(task.id, {
  error: new Error('Failed'),
  context: { operation: 'sync' }
});
```

## Configuration Updates

### Implementation Location
- Primary: `src/services/api/config/index.ts`
- Related: `src/components/Configuration.tsx`

### Critical Pattern
```typescript
class ConfigService {
  // CORRECT: Safe config updates
  async updateConfig(updates: Partial<Config>): Promise<void> {
    const current = await this.getConfig();
    const validated = await this.validate({
      ...current,
      ...updates
    });
    await this.saveConfig(validated);
    await this.notifyConfigUpdate(validated);
  }

  // INCORRECT: Unsafe updates
  async unsafeUpdate(updates: Partial<Config>): Promise<void> {
    await this.saveConfig(updates);
  }
}
```

### Dependencies
- All services depend on config
- UI components use config
- System settings rely on config

### Warning Signs
1. Validation:
```typescript
// WARNING: Skip validation
await config.set('key', value);

// CORRECT: Validate before update
const validated = await config.validate('key', value);
await config.set('key', validated);
```

2. Notifications:
```typescript
// WARNING: Silent update
config.data = newData;

// CORRECT: Notify subscribers
await config.update(newData, {
  notify: true,
  validate: true
});
```

## Best Practices

1. Data Handling:
   - Validate all inputs
   - Use strong types
   - Handle edge cases
   - Maintain data integrity

2. State Management:
   - Atomic operations
   - Proper validation
   - Clear state transitions
   - Error recovery

3. Error Handling:
   - Detailed error messages
   - Error context
   - Recovery procedures
   - User feedback

4. Performance:
   - Efficient operations
   - Resource cleanup
   - Proper caching
   - Optimized updates

## Related Documentation
- [Service Patterns](./services.md) - For service implementation
- [UI Patterns](./ui.md) - For component implementation
- [Testing Guide](./testing.md) - For testing patterns 