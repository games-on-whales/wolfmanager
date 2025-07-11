# Security Fixes - June 2025

This document outlines the critical security vulnerabilities that were identified and fixed in the WolfUI application.

## Summary of Fixes

### 1. Authentication Bypass in WolfEventService (CRITICAL)

**Issue**: The `socket-service.ts` had an authentication bypass that allowed internal system calls without a session for the `/events` endpoint.

**Fix**: 
- Removed the authentication bypass completely
- Implemented proper service-to-service authentication using an internal service token
- Added `callWolfApiStreamInternal()` method for legitimate internal service calls
- Internal services must now use the `INTERNAL_SERVICE_TOKEN` environment variable

**Implementation**:
```typescript
// Before (VULNERABLE):
if (session === null && operation === SOCKET_OPERATIONS.READ && endpoint === "/events") {
    return { valid: true };
}

// After (SECURE):
// Internal calls must provide a service token
if (isInternalCall && process.env.INTERNAL_SERVICE_TOKEN) {
    const internalToken = session as any;
    if (internalToken?.serviceToken === process.env.INTERNAL_SERVICE_TOKEN) {
        return { valid: true };
    }
}
```

### 2. Data Filtering Vulnerability in SSE Route (HIGH)

**Issue**: The client-events SSE route had weak filtering that could potentially broadcast events to unauthorized users.

**Fix**:
- Added strict validation of event data structure
- Enhanced clientId validation (type checking, string validation)
- Added logging for security events
- Prevented broadcast of events without clientId (except PAIR_REQUEST_UPDATE)
- Added detailed security logging for audit trails

### 3. Memory Leak in WolfEventService (MEDIUM)

**Issue**: The `clientStates` Map in WolfEventService grew unboundedly, potentially causing memory exhaustion.

**Fix**:
- Implemented TTL (Time To Live) of 24 hours for cached entries
- Added maximum size limit of 1000 client states
- Implemented periodic cleanup every hour
- Added cleanup on service disposal
- Remove oldest entries when limit is exceeded

**Configuration**:
```typescript
private readonly MAX_CLIENT_STATES = 1000;
private readonly CLIENT_STATE_TTL = 24 * 60 * 60 * 1000; // 24 hours
private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
```

### 4. Session Security Configuration (MEDIUM)

**Issue**: Session cookies were not configured to use secure flag in production.

**Fix**:
- Enabled secure cookies in production environments
- Reduced session timeout from 8 hours to 4 hours
- Increased session update frequency from 1 hour to 30 minutes

**Implementation**:
```typescript
secure: process.env.NODE_ENV === "production", // Use secure cookies in production
maxAge: 4 * 60 * 60, // Reduced to 4 hours
updateAge: 30 * 60, // Update every 30 minutes
```

### 5. Error Handling and Resource Cleanup (LOW)

**Issue**: SSE connections lacked proper error handling and resource cleanup.

**Fix**:
- Added try-catch blocks around stream operations
- Implemented proper cleanup function for event listeners
- Added connection state tracking
- Implemented exponential backoff for reconnection attempts
- Added process signal handlers (SIGINT, SIGTERM) for graceful shutdown
- Added maximum reconnection attempts to prevent infinite loops

## Required Actions

1. **Add Internal Service Token**:
   ```bash
   # Generate a secure token
   openssl rand -hex 32
   
   # Add to .env file
   INTERNAL_SERVICE_TOKEN=<generated-token>
   ```

2. **Update Production Configuration**:
   - Ensure `NODE_ENV=production` is set in production environments
   - This enables secure cookies automatically

3. **Monitor Memory Usage**:
   - Monitor the WolfEventService memory usage
   - Adjust `MAX_CLIENT_STATES` if needed based on your usage patterns

4. **Review Logs**:
   - New security events are logged with LogComponent.API and LogComponent.AUTH
   - Monitor these logs for potential security issues

## Testing Recommendations

1. **Authentication Testing**:
   - Verify that direct calls to `/api/client-events` without authentication return 401
   - Test that the Wolf event service can still connect using internal authentication

2. **Event Filtering**:
   - Test that users only receive events for their own clients
   - Verify that events without clientId are properly filtered

3. **Memory Management**:
   - Load test with many client connections
   - Verify that old client states are cleaned up after 24 hours
   - Check that memory usage stabilizes at expected levels

4. **Session Security**:
   - Verify secure cookies are used in production
   - Test session timeout after 4 hours of inactivity

## Security Best Practices Moving Forward

1. **Never bypass authentication** - Always use proper service-to-service authentication
2. **Validate all input** - Check types and values before processing
3. **Implement resource limits** - Prevent unbounded growth of any data structures
4. **Use secure defaults** - Enable security features based on environment
5. **Handle errors gracefully** - Prevent information leakage through error messages
6. **Log security events** - Maintain audit trails for security-relevant operations

## Questions or Concerns

If you have any questions about these security fixes or need assistance with implementation, please contact the security team.