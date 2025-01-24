# Testing Guide

## Quick Links
- [Test Structure](#test-structure)
- [Testing Patterns](#testing-patterns)
- [Component Testing](#component-testing)
- [Service Testing](#service-testing)
- [API Testing](#api-testing)

## Test Structure

### Directory Layout
```
src/
├── __tests__/              # Test files
│   ├── components/         # Component tests
│   ├── services/          # Service tests
│   ├── api/               # API tests
│   └── utils/             # Test utilities
└── __mocks__/             # Mock implementations
    ├── services/          # Service mocks
    └── api/               # API mocks
```

### Test File Naming
- Component tests: `ComponentName.test.tsx`
- Service tests: `ServiceName.test.ts`
- API tests: `endpoint.test.ts`
- Integration tests: `feature.integration.test.ts`

## Testing Patterns

### Component Test Pattern
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  // Setup and teardown
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Clean up after tests
  });

  // Test cases
  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    render(<Component />);
    await fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });
});
```

### Service Test Pattern
```typescript
import { ServiceName } from './ServiceName';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(() => {
    service = new ServiceName();
  });

  it('performs operation successfully', async () => {
    const result = await service.operation();
    expect(result).toBeDefined();
  });

  it('handles errors correctly', async () => {
    await expect(service.failingOperation())
      .rejects
      .toThrow('Expected error');
  });
});
```

### API Test Pattern
```typescript
import { api } from './api';

describe('API Endpoint', () => {
  it('returns expected data', async () => {
    const response = await api.get('/endpoint');
    expect(response.status).toBe(200);
    expect(response.data).toMatchSnapshot();
  });

  it('handles invalid input', async () => {
    await expect(api.post('/endpoint', invalidData))
      .rejects
      .toMatchObject({
        status: 400,
        message: 'Invalid input'
      });
  });
});
```

## Component Testing

### Test Categories

1. Rendering Tests
```typescript
it('renders with default props', () => {
  render(<Component />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});

it('renders with custom props', () => {
  render(<Component customProp="value" />);
  expect(screen.getByText('value')).toBeInTheDocument();
});
```

2. Interaction Tests
```typescript
it('handles click events', async () => {
  const handleClick = jest.fn();
  render(<Component onClick={handleClick} />);
  await fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

3. State Tests
```typescript
it('updates state on interaction', async () => {
  render(<Component />);
  await fireEvent.click(screen.getByText('Toggle'));
  expect(screen.getByText('New State')).toBeInTheDocument();
});
```

### Testing UI Components

1. Dialog Testing
```typescript
it('opens and closes dialog', async () => {
  render(<DialogComponent />);
  await fireEvent.click(screen.getByText('Open'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await fireEvent.click(screen.getByText('Close'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

2. Form Testing
```typescript
it('submits form data', async () => {
  const handleSubmit = jest.fn();
  render(<FormComponent onSubmit={handleSubmit} />);
  await fireEvent.change(screen.getByLabelText('Input'), {
    target: { value: 'test' }
  });
  await fireEvent.click(screen.getByText('Submit'));
  expect(handleSubmit).toHaveBeenCalledWith({ input: 'test' });
});
```

## Service Testing

### Test Categories

1. Operation Tests
```typescript
it('performs CRUD operations', async () => {
  const result = await service.create(data);
  expect(result).toBeDefined();
  
  const updated = await service.update(result.id, newData);
  expect(updated).toMatchObject(newData);
  
  await service.delete(result.id);
  await expect(service.get(result.id))
    .rejects
    .toThrow('Not found');
});
```

2. State Management Tests
```typescript
it('manages state correctly', () => {
  const subscriber = jest.fn();
  service.subscribe(subscriber);
  service.updateState(newState);
  expect(subscriber).toHaveBeenCalledWith(newState);
});
```

3. Error Handling Tests
```typescript
it('handles errors appropriately', async () => {
  await expect(service.operation(invalidData))
    .rejects
    .toThrow('Validation error');
});
```

### Testing Services

1. WolfService Tests
```typescript
describe('WolfService', () => {
  it('handles client pairing', async () => {
    const pin = await service.generatePin();
    expect(pin).toMatch(/^\d{4}$/);
    
    const result = await service.confirmPairing(pin);
    expect(result.clientId).toBeDefined();
  });
});
```

2. ConfigService Tests
```typescript
describe('ConfigService', () => {
  it('manages configuration', async () => {
    await service.updateConfig(newConfig);
    const config = await service.getConfig();
    expect(config).toMatchObject(newConfig);
  });
});
```

## API Testing

### Test Categories

1. Endpoint Tests
```typescript
it('handles GET request', async () => {
  const response = await request(app)
    .get('/api/endpoint')
    .set('X-API-Key', validKey);
  expect(response.status).toBe(200);
  expect(response.body).toMatchSnapshot();
});
```

2. Authentication Tests
```typescript
it('requires valid API key', async () => {
  const response = await request(app)
    .get('/api/endpoint')
    .set('X-API-Key', invalidKey);
  expect(response.status).toBe(401);
});
```

3. Validation Tests
```typescript
it('validates request body', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send(invalidData)
    .set('X-API-Key', validKey);
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});
```

## Best Practices

1. Test Organization:
   - Group related tests
   - Clear test descriptions
   - Proper setup/teardown
   - Isolated test cases

2. Test Coverage:
   - Critical paths
   - Edge cases
   - Error scenarios
   - Integration points

3. Test Maintenance:
   - Avoid test duplication
   - Use test utilities
   - Keep tests focused
   - Regular updates

4. Performance:
   - Fast test execution
   - Minimal dependencies
   - Efficient mocking
   - Parallel execution

## Related Documentation
- [Service Patterns](./services.md) - For service implementation details
- [UI Patterns](./ui.md) - For component implementation details
- [API Guide](./api.md) - For API implementation details 