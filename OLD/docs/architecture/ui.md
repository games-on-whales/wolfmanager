# UI Architecture

## Quick Links
- [Component Structure](#component-structure)
- [Component Relationships](#component-relationships)
- [UI Patterns](#ui-patterns)
- [State Management](#state-management)
- [Styling Patterns](#styling-patterns)

## Component Structure

### Directory Layout
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

### Core Components

#### Layout Component
**Location**: `src/components/Layout.tsx`
**Purpose**: Main application shell
**Key Features**:
- App shell with drawer navigation
- Responsive app bar with search
- Theme toggle support
- User menu integration

#### Configuration Components
**Location**: `src/components/Configuration.tsx`
**Purpose**: System configuration interface
**Key Features**:
- System settings management
- User management
- Task monitoring
- Logging interface

#### Dialog Components
**Location**: `src/components/pairing/*`
**Purpose**: Modal interfaces
**Key Features**:
- PairingDialog for device pairing
- UserMenu for user management
- Consistent dialog patterns

## Component Relationships

### Component Tree
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

### Service Integration
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

## UI Patterns

### Component Pattern
```typescript
interface ComponentProps {
  // Props interface with clear types
}

export function Component({ prop1, prop2 }: ComponentProps): JSX.Element {
  // State hooks at the top
  const [state, setState] = useState<StateType>();
  
  // Event handlers with consistent naming
  const handleEvent = (event: EventType): void => {
    // Handle event
  };
  
  // Effects after handlers
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Render last
  return (
    <Box sx={{ /* theme-aware styles */ }}>
      {/* Component JSX */}
    </Box>
  );
}
```

### Form Handling
```typescript
function FormComponent() {
  // Form state
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Validation
  const validate = (data: FormData): FormErrors => {
    // Return validation errors
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(formData);
    if (Object.keys(errors).length === 0) {
      // Submit form
    }
  };
}
```

### Error Handling
```typescript
function ComponentWithError() {
  // Error state
  const [error, setError] = useState<Error | null>(null);

  // Error display
  if (error) {
    return (
      <Alert severity="error">
        {error.message}
      </Alert>
    );
  }

  // Error boundary usage
  return (
    <ErrorBoundary fallback={<ErrorComponent />}>
      {/* Component content */}
    </ErrorBoundary>
  );
}
```

## State Management

### Local State
```typescript
// Use hooks for local state
const [state, setState] = useState<StateType>(initialState);

// Derived state
const derivedValue = useMemo(() => {
  return expensiveComputation(state);
}, [state]);

// Effect cleanup
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);
```

### Service Integration
```typescript
function ComponentWithService() {
  // Service subscription
  useEffect(() => {
    const unsubscribe = ServiceName.subscribe(data => {
      // Handle updates
    });
    return unsubscribe;
  }, []);

  // Service operations
  const handleOperation = async () => {
    try {
      await ServiceName.operation();
    } catch (error) {
      // Handle error
    }
  };
}
```

## Styling Patterns

### Theme Usage
```typescript
// Theme-aware styles
const StyledComponent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius
}));

// Direct sx prop
<Box sx={{ 
  display: 'flex',
  gap: 2,
  p: 2,
  bgcolor: 'background.paper'
}}>
```

### Responsive Design
```typescript
// Breakpoint handling
<Box sx={{ 
  width: {
    xs: '100%',    // Mobile
    sm: '50%',     // Tablet
    md: '33.33%'   // Desktop
  },
  p: {
    xs: 1,
    sm: 2,
    md: 3
  }
}}>
```

## Best Practices

1. Component Structure:
   - Functional components with TypeScript
   - Props interface definitions
   - Consistent file organization
   - Clear component hierarchy

2. State Management:
   - Use hooks for local state
   - Lift state when needed
   - Avoid prop drilling
   - Clear update patterns

3. Error Handling:
   - Use error boundaries
   - Consistent error display
   - User-friendly messages
   - Error recovery patterns

4. Performance:
   - Memoize expensive computations
   - Proper dependency arrays
   - Lazy loading when needed
   - Cleanup subscriptions

## Related Documentation
- [Service Patterns](./services.md) - For service integration
- [Critical Patterns](./critical-patterns.md) - For critical UI patterns
- [Testing Guide](./testing.md) - For UI testing 