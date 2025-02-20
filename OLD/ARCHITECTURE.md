# [MOVED] WolfManager Architecture

> ⚠️ **Note**: This architecture documentation has been reorganized and moved to the `docs/architecture/` directory. 
> Please refer to [docs/architecture/README.md](docs/architecture/README.md) for the current architecture documentation.
> 
> This file has been preserved as [docs/architecture/legacy.md](docs/architecture/legacy.md) for historical reference.

## File Structure

### Services Directory (`src/services/`)
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
│   │   ├── index.ts       # ConfigService implementation
│   │   └── types.ts       # Config types
│   ├── cache/             # Cache management
│   │   └── index.ts       # CacheService implementation
│   ├── logs/              # Logging system
│   │   ├── index.ts       # LogService implementation
│   │   └── types.ts       # Logging types
│   ├── tasks/             # Task management
│   │   ├── index.ts       # TaskService implementation
│   │   └── types.ts       # Task types
│   └── base.ts            # Common API utilities
└── index.ts               # Service exports
```

## Core Services

### WolfService
**Location**: `src/services/api/wolf/index.ts`
**Related Files**:
- `src/services/api/wolf/types.ts` - Type definitions
- `src/components/pairing/PairingDialog.tsx` - UI for pairing
- `src/components/TaskManager.tsx` - Uses WolfService for client validation
- Handles Wolf game management and client pairing
- Key operations:
  - Game CRUD operations (getGames, updateGame, deleteGame)
  - Game synchronization (importGames, syncPlaytime)
  - Client pairing (getPendingPairRequests, findPairRequestByPin, confirmPairing)
  - Client management (getClients, validateClients)
- **Important**: Client IDs are handled as BigInt strings to preserve numeric precision

### ConfigService
**Location**: `src/services/api/config/index.ts`
**Related Files**:
- `src/services/api/config/types.ts` - Configuration types
- `src/components/Configuration.tsx` - Main config UI
- `src/components/UserSettings.tsx` - User management UI
- Manages application configuration and user settings
- Singleton pattern with state management
- Key operations:
  - Config CRUD (loadConfig, saveConfig, getConfig)
  - User management (addUser, deleteUser, selectUser, editUser)
  - Current user tracking (getCurrentUser)
- Config Structure:
  ```typescript
  interface Config {
    currentUser?: string;
    libraryPath: string;
    usersPath: string;
    cachePath: string;
    steamGridDbApiKey: string;
    debugEnabled: boolean;
    users: Record<string, UserConfig>;
  }
  ```

### TaskService
**Location**: `src/services/api/tasks/index.ts`
**Related Files**:
- `src/services/api/tasks/types.ts` - Task types
- `src/components/TaskManager.tsx` - Task UI
- `src/components/Configuration.tsx` - Task section
- Manages long-running operations and their status
- Implements observer pattern for task updates
- Persistent tasks:
  - Games list refresh
  - Artwork refresh
  - Cache clearing
  - Client validation
- Task Status Types: RUNNING, COMPLETED, FAILED
- Provides progress updates and error handling

### SteamService
**Location**: `src/services/api/steam/index.ts`
**Related Files**:
- `src/services/api/steam/artwork.ts` - Artwork handling
- `src/services/api/steam/games.ts` - Game management
- `src/services/api/steam/types.ts` - Steam types
- `src/components/GameGrid.tsx` - Game display UI
- Handles Steam integration
- Key features:
  - Game ownership tracking
  - Artwork management
  - Game metadata synchronization

### CacheService
**Location**: `src/services/api/cache/index.ts`
**Related Files**:
- `src/services/api/steam/artwork.ts` - Uses cache for artwork
- `src/components/GameCard.tsx` - Displays cached artwork
- Manages artwork caching
- Key operations:
  - Cache directory management
  - Artwork caching and retrieval
  - Cache invalidation

### LogService
**Location**: `src/services/api/logs/index.ts`
**Related Files**:
- `src/services/api/logs/types.ts` - Logging types
- `src/components/LogViewer.tsx` - Log display UI
- `src/services/api/base.ts` - Uses logger for API errors
- Centralized logging system
- Log levels: DEBUG, INFO, WARN, ERROR
- Supports component-based logging
- Provides log retrieval and clearing

## Key Data Types

### Wolf Types
```typescript
interface WolfGame {
  id: string;
  name: string;
  path: string;
  lastPlayed?: string;
  playtime?: number;
  artwork?: string;
}

interface WolfGameUpdate {
  name?: string;
  path?: string;
  lastPlayed?: string;
  playtime?: number;
  artwork?: string;
}
```

### User Configuration
```typescript
interface UserConfig {
  steamId: string;
  steamApiKey: string;
  clients?: Record<string, {
    friendlyName: string;
  }>;
}
```

## Best Practices

1. Error Handling:
   - All API calls use handleApiResponse/handleApiError
   - Errors are logged with component context
   - User-friendly error messages are propagated

2. Logging:
   - Use appropriate log levels (debug, info, warn, error)
   - Include component name in logs
   - Add relevant data context

3. State Management:
   - Services use singleton pattern
   - State changes notify subscribers
   - Config changes are persisted

4. API Patterns:
   - RESTful endpoints
   - Consistent error handling
   - Progress tracking for long operations

5. Client ID Handling:
   - Always use BigInt strings for client IDs
   - Preserve numeric precision
   - Use encodeURIComponent for URL paths

## Common Pitfalls to Avoid

1. Client ID Transformation:
   - DON'T convert client IDs to numbers
   - DON'T use parseInt/Number on client IDs
   - ALWAYS use BigInt.toString() for client IDs

2. Task Management:
   - DON'T create duplicate task instances
   - ALWAYS use existing task IDs
   - ALWAYS update task status appropriately

3. Configuration:
   - DON'T modify config directly
   - ALWAYS use ConfigService methods
   - ALWAYS handle currentUser checks

4. Error Handling:
   - DON'T swallow errors silently
   - ALWAYS log errors with context
   - ALWAYS use handleApiError

5. Cache Management:
   - DON'T assume cache exists
   - ALWAYS check cache before operations
   - ALWAYS handle cache misses gracefully

## UI Architecture

### Component Structure
- Layout-based architecture with reusable components
- Material-UI (MUI) as the base component library
- Styled components for custom styling
- Responsive design patterns

### Core Components

1. Layout Component
   - App shell with drawer navigation
   - Responsive app bar with search
   - Theme toggle support
   - User menu integration

2. Configuration Components
   - System settings management
   - User management
   - Task monitoring
   - Logging interface

3. Dialog Components
   - PairingDialog for device pairing
   - UserMenu for user management
   - Consistent dialog patterns with actions

### UI Patterns

1. Form Handling:
   - Controlled components with state management
   - Form validation and error handling
   - Consistent input patterns

2. State Management:
   - React hooks for local state
   - Service integration for global state
   - Event handling patterns

3. Styling Patterns:
   - MUI theme customization
   - Styled components for custom styling
   - Consistent spacing and layout

4. Error Handling:
   - Snackbar notifications
   - Form validation feedback
   - Error boundaries

5. Loading States:
   - Progress indicators
   - Skeleton loading
   - Task status updates

### Best Practices

1. Component Structure:
   - Functional components with TypeScript
   - Props interface definitions
   - Consistent naming conventions

2. State Management:
   - Use hooks for local state
   - Lift state up when needed
   - Avoid prop drilling

3. Event Handling:
   - Type-safe event handlers
   - Consistent naming (handle*)
   - Event propagation control

4. Styling:
   - Use MUI's sx prop for styling
   - Theme-aware styling
   - Responsive design patterns

### Common Pitfalls to Avoid

1. Component Design:
   - DON'T mix business logic with UI
   - DON'T duplicate component logic
   - ALWAYS use TypeScript interfaces

2. State Management:
   - DON'T mutate state directly
   - DON'T use complex state when simple state suffices
   - ALWAYS handle loading/error states

3. Event Handling:
   - DON'T use inline function handlers
   - DON'T ignore event types
   - ALWAYS cleanup event listeners

4. Styling:
   - DON'T use inline styles
   - DON'T mix styling approaches
   - ALWAYS use theme variables

### Example Component Pattern
```typescript
interface ComponentProps {
  // Props interface
}

export function Component({ prop1, prop2 }: ComponentProps): JSX.Element {
  // State hooks
  const [state, setState] = useState<StateType>();
  
  // Event handlers
  const handleEvent = (event: EventType): void => {
    // Handle event
  };
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return (
    <Box sx={{ /* theme-aware styles */ }}>
      {/* Component JSX */}
    </Box>
  );
}
```

### Component Relationships

#### Core Component Dependencies
```
Layout
├── UserMenu
│   └── PairingDialog
│       └── PinInput
└── TaskManager
    └── TaskList

Configuration
├── UserSettings
├── SystemSettings
├── TaskManager
└── LogViewer

GameGrid
└── GameCard
    └── ArtworkDisplay
```

#### Service Usage in Components
```
Component          | Primary Services Used
-------------------|--------------------
UserMenu           | WolfService, ConfigService
PairingDialog      | WolfService
Configuration      | ConfigService, TaskService
TaskManager        | TaskService
LogViewer          | LogService
GameGrid           | SteamService, CacheService
GameCard           | CacheService
ArtworkDisplay     | CacheService
```

#### Key Component Files
```
src/components/
├── Layout.tsx              # Main app layout
├── Configuration.tsx       # Configuration panel
├── UserMenu.tsx           # User management
├── TaskManager.tsx        # Task monitoring
├── LogViewer.tsx          # Log display
├── GameGrid.tsx           # Game display
└── pairing/               # Pairing components
    ├── PairingDialog.tsx
    └── PinInput.tsx
```

## API Architecture

### Core API Patterns

1. Error Handling:
   ```typescript
   export class ApiError extends Error {
     constructor(
       message: string,
       public status?: number,
       public statusText?: string,
       public data?: any
     ) {
       super(message);
       this.name = 'ApiError';
     }
   }
   ```

2. Response Handling:
   ```typescript
   async function handleApiResponse<T>(response: Response, component: string): Promise<T> {
     if (!response.ok) {
       throw new ApiError(
         `API request failed: ${response.statusText}`,
         response.status,
         response.statusText
       );
     }
     return response.json() as T;
   }
   ```

3. Service Pattern:
   ```typescript
   class ServiceName {
     async methodName(): Promise<ReturnType> {
       try {
         Logger.debug('Starting operation', 'ServiceName');
         const response = await fetch('/api/endpoint');
         const data = await handleApiResponse<ReturnType>(response, 'ServiceName');
         Logger.info('Operation successful', 'ServiceName');
         return data;
       } catch (error) {
         await handleApiError(error, 'ServiceName');
         throw error;
       }
     }
   }
   ```

### Best Practices

1. Error Handling:
   - Use ApiError for consistent error types
   - Always include component context
   - Log errors with appropriate level
   - Propagate errors to UI when needed

2. Logging:
   - Debug logs for operation start
   - Info logs for successful completion
   - Error logs with full context
   - Component-based logging

3. Response Handling:
   - Type-safe responses with generics
   - Consistent error handling
   - JSON parsing in central location
   - Status code checking

4. Request Patterns:
   - RESTful endpoints
   - Consistent URL structure
   - Proper HTTP methods
   - Content-Type headers

### Common Pitfalls to Avoid

1. Error Handling:
   - DON'T swallow errors silently
   - DON'T log without context
   - ALWAYS use handleApiError
   - ALWAYS include component name

2. Response Handling:
   - DON'T assume response is JSON
   - DON'T skip error checking
   - ALWAYS use handleApiResponse
   - ALWAYS type responses

3. Request Patterns:
   - DON'T hardcode URLs
   - DON'T skip content types
   - ALWAYS encode URL parameters
   - ALWAYS validate request data

4. Logging:
   - DON'T over-log
   - DON'T log sensitive data
   - ALWAYS use appropriate levels
   - ALWAYS include context

### Task Management

1. Task Structure:
   ```typescript
   interface Task {
     id: string;
     name: string;
     status: TaskStatus;
     progress: number;
     message: string;
     startTime: string;
     endTime?: string;
     error?: Error;
   }
   ```

2. Task Status Updates:
   ```typescript
   private updateTask(
     taskId: string,
     update: Partial<Pick<Task, 'status' | 'progress' | 'message' | 'error'>>
   ): void {
     // Update task and notify subscribers
   }
   ```

3. Task Patterns:
   - Unique task IDs
   - Progress tracking
   - Status updates
   - Error handling
   - Subscriber notifications 

## API Endpoints

### Wolf API
```
/api/wolf/
├── games/
│   ├── GET /                # Get all games
│   ├── PUT /:id            # Update game
│   ├── DELETE /:id         # Delete game
│   ├── POST /import        # Import games
│   └── POST /sync          # Sync playtime
├── pair/
│   ├── GET /pending        # Get pending pair requests
│   └── POST /client        # Confirm pairing
└── clients/
    ├── GET /               # Get paired clients
    └── POST /unpair        # Unpair client
```

### Steam API
```
/api/steam/
├── games/
│   └── GET /owned          # Get owned games
└── artwork/
    ├── GET /:appId        # Get game artwork
    └── POST /refresh      # Refresh artwork
```

### Config API
```
/api/config/
├── GET /                   # Get config
├── POST /                  # Save config
└── users/
    ├── POST /             # Add user
    ├── DELETE /:username  # Delete user
    ├── PUT /:username     # Update user
    └── POST /:username/select # Select user
```

### Cache API
```
/api/cache/
├── POST /ensure           # Ensure cache directory
└── artwork/
    ├── GET /:appId       # Get cached artwork
    ├── POST /            # Cache artwork
    └── POST /clear       # Clear cache
```

### Logs API
```
/api/logs/
├── GET /                  # Get logs
├── POST /                 # Write log
└── POST /clear           # Clear logs
```

### Response Formats

#### Success Response
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
}
```

#### Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}
```

### Common HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

### API Versioning
- All endpoints are currently v1 (implicit)
- Future versions will be prefixed with /api/v2/, /api/v3/, etc. 

## State Management

### Service State
Each service maintains its own state:
```typescript
// ConfigService
private config: Config | null = null;
private isInitialized = false;

// TaskService
private tasks: Task[] = [];
private subscribers: TaskSubscriber[] = [];

// LogService
private subscribers: LogSubscriber[] = [];
private logEntries: LogEntry[] = [];
```

### State Flow
```
User Action
    ↓
Component Event Handler
    ↓
Service Method Call
    ↓
API Request
    ↓
State Update
    ↓
Subscriber Notifications
    ↓
UI Update
```

### Observer Pattern Implementation
```typescript
// Subscriber type
type Subscriber<T> = (data: T) => void;

// Service implementation
class ServiceExample {
  private subscribers: Subscriber[] = [];
  
  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  private notifySubscribers(data: any): void {
    this.subscribers.forEach(subscriber => subscriber(data));
  }
}
```

### State Update Patterns

1. Direct Updates
```typescript
// Update and notify
private updateState(newState: State): void {
  this.state = newState;
  this.notifySubscribers(this.state);
}
```

2. Optimistic Updates
```typescript
// Update immediately, revert on error
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

3. Batch Updates
```typescript
// Collect changes and update once
private batchUpdate(updates: Update[]): void {
  const newState = updates.reduce(
    (state, update) => this.applyUpdate(state, update),
    this.state
  );
  this.updateState(newState);
}
```

### State Dependencies
```
ConfigService → All Services (provides configuration)
TaskService → WolfService, SteamService (monitors operations)
LogService → All Services (provides logging)
CacheService → SteamService (provides artwork caching)
```

## Testing Patterns

### Test File Structure
```
src/
└── __tests__/
    ├── components/         # Component tests
    │   └── __snapshots__/ # Snapshot files
    ├── services/          # Service tests
    └── utils/             # Test utilities
```

### Component Testing
```typescript
// Component test pattern
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  it('renders correctly', () => {
    const { container } = render(<Component {...props} />);
    expect(container).toMatchSnapshot();
  });

  it('handles user interactions', () => {
    const onAction = jest.fn();
    render(<Component onAction={onAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

### Service Testing
```typescript
// Service test pattern
describe('ServiceName', () => {
  beforeEach(() => {
    // Reset service state
    jest.clearAllMocks();
  });

  it('handles successful operations', async () => {
    const mockResponse = { /* test data */ };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await service.operation();
    expect(result).toEqual(mockResponse);
  });

  it('handles errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    await expect(service.operation()).rejects.toThrow('API Error');
  });
});
```

### Mock Patterns

1. API Mocks
```typescript
// Mock API response
const mockApiResponse = {
  ok: true,
  json: () => Promise.resolve({ data: 'test' }),
  status: 200,
  statusText: 'OK'
};

global.fetch = jest.fn().mockResolvedValue(mockApiResponse);
```

2. Service Mocks
```typescript
// Mock service implementation
jest.mock('../services/ServiceName', () => ({
  operation: jest.fn().mockResolvedValue('result')
}));
```

3. Component Mocks
```typescript
// Mock child component
jest.mock('./ChildComponent', () => {
  return function MockChildComponent(props: any) {
    return <div data-testid="mock-child">{JSON.stringify(props)}</div>;
  };
});
```

### Test Utilities

1. Render Helpers
```typescript
// Custom render with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <ConfigProvider>
        {ui}
      </ConfigProvider>
    </ThemeProvider>
  );
}
```

2. Test Data Generators
```typescript
// Generate test data
function createTestGame(override = {}): WolfGame {
  return {
    id: 'test-id',
    name: 'Test Game',
    path: '/test/path',
    ...override
  };
}
```

3. Mock Service Responses
```typescript
// Mock service responses
const mockResponses = {
  games: [createTestGame(), createTestGame()],
  config: { /* test config */ },
  error: new Error('Test error')
};
```

### Testing Best Practices

1. Component Testing:
   - Test user interactions
   - Verify state changes
   - Check rendered output
   - Test error states

2. Service Testing:
   - Test success paths
   - Test error handling
   - Verify state updates
   - Check subscriber notifications

3. Integration Testing:
   - Test component trees
   - Verify service integration
   - Test user flows
   - Check error boundaries

4. Test Organization:
   - Group related tests
   - Use descriptive names
   - Follow AAA pattern (Arrange, Act, Assert)
   - Keep tests focused 

## Critical Implementation Details

### Client ID Handling
**Owner Service**: `WolfService`
**Implementation Location**: `src/services/api/wolf/index.ts`
**Used By**:
- `PairingDialog.tsx` - Client pairing and config updates
- `UserSettings.tsx` - Client management
- `ConfigService` - Client storage in user config

**Critical Pattern**:
```typescript
// Always use BigInt for client IDs
const clientId = BigInt(client.client_id).toString()

// When comparing client IDs
const matches = BigInt(id1).toString() === BigInt(id2).toString()

// When storing in config
const updatedClients = {
  [BigInt(clientId).toString()]: {
    friendlyName: name
  }
}
```

**Dependencies**:
1. Config Storage:
   ```typescript
   interface UserConfig {
     clients?: Record<string, {
       friendlyName: string;
     }>;
   }
   ```

2. API Responses:
   ```typescript
   interface PairedClient {
     client_id: string;  // Comes as string, must be handled as BigInt
     app_state_folder: string;
   }
   ```

**Warning Signs**:
- Using Number() or parseInt() on client IDs
- Direct string comparison without BigInt conversion
- Missing toString() after BigInt conversion

### Game Synchronization
**Owner Service**: `WolfService`
**Implementation Location**: `src/services/api/wolf/index.ts`
**Used By**:
- `GameGrid.tsx` - Game display and updates
- `TaskService` - Sync operations

**Critical Pattern**:
```typescript
// Game updates must preserve these fields
interface WolfGameUpdate {
  name?: string;
  path?: string;
  lastPlayed?: string;
  playtime?: number;
  artwork?: string;
}

// All fields are optional to allow partial updates
const update: WolfGameUpdate = {
  playtime: newPlaytime  // Only update what changed
}
```

### Cache Management
**Owner Service**: `CacheService`
**Implementation Location**: `src/services/api/cache/index.ts`
**Used By**:
- `SteamService` - Artwork caching
- `GameCard.tsx` - Artwork display

**Critical Pattern**:
```typescript
// Always check cache before fetching
const cached = await CacheService.getCachedArtwork(appId);
if (!cached) {
  // Only then fetch and cache
  await CacheService.cacheArtwork(appId, imageUrl);
}
```

### Task Management
**Owner Service**: `TaskService`
**Implementation Location**: `src/services/api/tasks/index.ts`
**Used By**:
- All long-running operations
- `TaskManager.tsx` - UI display

**Critical Pattern**:
```typescript
// Tasks must be updated in this order
this.updateTask(taskId, {
  status: TaskStatus.RUNNING,
  message: 'Starting...',
  progress: 0
});

// Final status must be set
this.updateTask(taskId, {
  status: TaskStatus.COMPLETED,  // or FAILED
  message: 'Done',
  progress: 100
});
```

### Configuration Updates
**Owner Service**: `ConfigService`
**Implementation Location**: `src/services/api/config/index.ts`
**Used By**:
- All services for configuration
- User management
- Client management

**Critical Pattern**:
```typescript
// Always use editUser for user updates
await ConfigService.editUser(
  username,
  undefined,  // Skip steamId update
  undefined,  // Skip steamApiKey update
  updatedClients  // Only update clients
);

// Never modify config directly
const config = ConfigService.getConfig();
// ❌ config.users[username] = newConfig;
// ✅ await ConfigService.editUser(username, ...updates);
``` 