# WolfManager Architecture Guide

## Quick Reference

### Critical Patterns
- [Client ID Handling](./critical-patterns.md#client-id-handling)
- [Game Synchronization](./critical-patterns.md#game-synchronization)
- [Cache Management](./critical-patterns.md#cache-management)
- [Task Management](./critical-patterns.md#task-management)
- [Configuration Updates](./critical-patterns.md#configuration-updates)

### Service Patterns
- [Service Structure](./services.md#service-structure)
- [Core Services](./services.md#core-services)
- [State Management](./services.md#state-management)
- [Service Dependencies](./services.md#service-dependencies)

### UI Patterns
- [Component Structure](./ui.md#component-structure)
- [Component Relationships](./ui.md#component-relationships)
- [UI Patterns](./ui.md#ui-patterns)
- [Styling Patterns](./ui.md#styling-patterns)

### API Guide
- [API Overview](./api.md#api-overview)
- [API Endpoints](./api.md#api-endpoints)
- [Response Formats](./api.md#response-formats)
- [Error Handling](./api.md#error-handling)

### Testing Guide
- [Test Structure](./testing.md#test-structure)
- [Testing Patterns](./testing.md#testing-patterns)
- [Component Testing](./testing.md#component-testing)
- [Service Testing](./testing.md#service-testing)

## Documentation Structure

### 1. Services (`services.md`)
Core service implementations and patterns:
- Service architecture and structure
- State management patterns
- Service dependencies
- Best practices

### 2. Critical Patterns (`critical-patterns.md`)
Essential implementation details:
- Client ID handling
- Game synchronization
- Cache management
- Task management
- Configuration updates

### 3. UI Architecture (`ui.md`)
Component design and implementation:
- Component structure
- State management
- Styling patterns
- Best practices

### 4. API Architecture (`api.md`)
API design and implementation:
- Endpoint structure
- Response formats
- Error handling
- API versioning

### 5. Testing (`testing.md`)
Testing strategies and patterns:
- Test organization
- Component testing
- Service testing
- API testing

## Common Tasks

### Adding Features

1. **Service Changes**
   - Review [Service Patterns](./services.md)
   - Follow [Critical Patterns](./critical-patterns.md)
   - Add tests following [Testing Guide](./testing.md)

2. **UI Changes**
   - Review [UI Patterns](./ui.md)
   - Follow component structure
   - Add component tests

3. **API Changes**
   - Review [API Guide](./api.md)
   - Follow response formats
   - Add API tests

### Fixing Bugs

1. **Identify Pattern**
   - Check [Critical Patterns](./critical-patterns.md)
   - Review service dependencies
   - Check component relationships

2. **Implement Fix**
   - Follow relevant patterns
   - Add regression tests
   - Update documentation

3. **Verify**
   - Run test suite
   - Check related components
   - Verify API responses

### Making UI Changes

1. **Component Updates**
   - Follow [UI Patterns](./ui.md)
   - Use proper styling
   - Handle state correctly

2. **Service Integration**
   - Review [Service Patterns](./services.md)
   - Follow state management
   - Add integration tests

## Warning Signs

### Client ID Issues
- Using numbers instead of strings
- Direct comparisons
- Missing validation

### State Management
- Direct state mutation
- Missing subscriber updates
- Race conditions

### Cache Issues
- Direct cache access
- Missing invalidation
- Inconsistent state

### Task Management
- Direct status updates
- Missing error handling
- Incomplete lifecycle

### Configuration
- Direct updates
- Missing validation
- Silent changes

## File Organization

```
architecture/
├── README.md              # This guide
├── services.md            # Service patterns
├── critical-patterns.md   # Critical implementations
├── ui.md                  # UI architecture
├── api.md                # API documentation
└── testing.md            # Testing guide
```

## Best Practices

1. **Code Organization**
   - Follow file structure
   - Use consistent patterns
   - Document changes

2. **Implementation**
   - Follow critical patterns
   - Add proper tests
   - Handle errors

3. **Documentation**
   - Update relevant guides
   - Add examples
   - Keep patterns current

4. **Testing**
   - Write comprehensive tests
   - Follow test patterns
   - Maintain test suite

## Related Resources

- [Project README](../../README.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Development Setup](../../DEVELOPMENT.md) 