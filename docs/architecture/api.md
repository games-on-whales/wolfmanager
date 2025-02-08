# API Architecture

## Quick Links
- [API Overview](#api-overview)
- [API Endpoints](#api-endpoints)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [API Versioning](#api-versioning)

## API Overview

### Base URLs
- Wolf API: `/api/wolf`
- Steam API: `/api/steam`
- Config API: `/api/config`
- Cache API: `/api/cache`
- Logs API: `/api/logs`

### Authentication
All API endpoints require authentication via API key in the `X-API-Key` header.

## API Endpoints

### Wolf API
**Base Path**: `/api/wolf`

#### Client Management
```
GET    /clients                # List all clients
POST   /clients                # Add new client
DELETE /clients/:id            # Remove client
GET    /clients/:id/status     # Get client status
```

#### Game Management
```
GET    /games                  # List all games
POST   /games                  # Add new game
PUT    /games/:id             # Update game
DELETE /games/:id             # Remove game
POST   /games/sync            # Sync game data
```

#### Pairing
```
GET    /pair/requests         # Get pending pair requests
POST   /pair/confirm         # Confirm pairing
DELETE /pair/reject          # Reject pairing
```

### Steam API
**Base Path**: `/api/steam`

#### Game Management
```
GET    /games                 # List owned games
POST   /games/sync           # Sync Steam library
GET    /games/:id            # Get game details
```

#### Artwork
```
GET    /artwork/:id           # Get game artwork
POST   /artwork/cache         # Cache artwork
DELETE /artwork/cache/:id     # Clear artwork cache
```

### Config API
**Base Path**: `/api/config`

#### System Configuration
```
GET    /system               # Get system config
PUT    /system               # Update system config
```

#### User Management
```
GET    /users                # List users
POST   /users                # Add user
PUT    /users/:id            # Update user
DELETE /users/:id            # Remove user
```

### Cache API
**Base Path**: `/api/cache`

```
GET    /artwork/:id          # Get cached artwork
POST   /artwork              # Cache new artwork
DELETE /artwork/:id          # Remove cached artwork
GET    /status              # Get cache status
POST   /clear               # Clear cache
```

### Logs API
**Base Path**: `/api/logs`

```
GET    /                     # Get all logs
POST   /                     # Add log entry
DELETE /                     # Clear logs
GET    /level/:level        # Get logs by level
```

## Response Formats

### Success Response
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}
```

### Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
```

## Error Handling

### HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error

### Error Types
```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

### Error Examples
```typescript
// Not Found Error
{
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Client not found',
    details: { clientId: '123' }
  },
  timestamp: '2024-01-01T00:00:00Z'
}

// Validation Error
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: {
      field: 'clientId',
      reason: 'Must be a valid BigInt string'
    }
  },
  timestamp: '2024-01-01T00:00:00Z'
}
```

## API Versioning

### Version Header
All requests should include the API version header:
```
X-API-Version: 1.0
```

### Version Compatibility
- Major version changes (1.0 -> 2.0) indicate breaking changes
- Minor version changes (1.0 -> 1.1) indicate backward-compatible features
- Patch version changes (1.0.0 -> 1.0.1) indicate bug fixes

## Best Practices

1. Request Validation:
   - Validate all input parameters
   - Use strong typing
   - Check data constraints
   - Sanitize user input

2. Response Handling:
   - Consistent response format
   - Proper error codes
   - Detailed error messages
   - Include request ID

3. Security:
   - API key validation
   - Input sanitization
   - Rate limiting
   - Error message security

4. Performance:
   - Response caching
   - Pagination
   - Compression
   - Request timeouts

## Related Documentation
- [Service Patterns](./services.md) - For service implementation
- [Critical Patterns](./critical-patterns.md) - For critical API patterns
- [Testing Guide](./testing.md) - For API testing 