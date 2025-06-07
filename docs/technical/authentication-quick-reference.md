# Authentication Quick Reference

## Overview
WolfManager uses NextAuth.js v4 with JWT tokens and custom cookie configuration for cross-host compatibility.

## Key Files
- [`src/lib/auth.ts`](../../src/lib/auth.ts) - Main authentication configuration
- [`src/middleware.ts`](../../src/middleware.ts) - Route protection and authorization
- [`src/lib/auth/socket-permissions.ts`](../../src/lib/auth/socket-permissions.ts) - Socket access control

## Authentication Flow
1. **Login** → Credentials validated → JWT token created → Session cookie set
2. **Request** → Middleware checks token → Route access granted/denied
3. **API Call** → Server action validates session → Operation authorized

## Cookie Configuration (Cross-Host Fix)
```typescript
cookies: {
  sessionToken: {
    options: {
      httpOnly: true,
      sameSite: "lax",        // ✅ Allows cross-host access
      secure: false,          // ✅ Allows non-HTTPS internal networks
      domain: undefined,      // ✅ Works across different hosts
      path: "/",
    },
  },
}
```

## Common Patterns

### Server Action Authentication
```typescript
const session = await getServerSession(authOptions);
if (!session?.user) {
  return createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, "Authentication required");
}
```

### API Route Authentication
```typescript
const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Client Component Authentication
```typescript
const { data: session, status } = useSession();
if (status === "unauthenticated") redirect("/login");
```

## Route Protection

### Public Routes (No Auth Required)
- `/`, `/login`, `/first-time-setup`, `/api/auth`

### Admin Routes (Admin Role Required)
- `/users`, `/api/users`, `/api/system`, `/settings/api-test`

### Protected Routes (Any Authenticated User)
- `/clients`, `/settings`, `/api/user`, `/api/wolf`

## Troubleshooting

### Remote Access Issues
**Problem**: UNAUTHORIZED errors from remote machines
**Solution**: Verify cookie config has `sameSite: "lax"` and `domain: undefined`

### Session Not Persisting
**Problem**: User logged out on refresh
**Solution**: Check `NEXTAUTH_URL` environment variable

### First-Time Setup Loop
**Problem**: Stuck in setup redirect
**Solution**: Verify `requiresFirstTimeSetup` flag is cleared after password change

## Environment Variables
```bash
NEXTAUTH_SECRET=<64-char-key>     # Required
NEXTAUTH_URL=<app-url>            # Optional (auto-detected in dev)
ENCRYPTION_KEY=<32-char-key>      # Required
```

## Security Features
- ✅ Bcrypt password hashing
- ✅ JWT token signing
- ✅ HttpOnly cookies (XSS protection)
- ✅ Role-based access control
- ✅ Session expiration (8 hours)
- ✅ Comprehensive audit logging

## Socket Permissions
- **Admin Users**: Full access to Wolf and Docker sockets
- **Regular Users**: Read-only access to Wolf socket, no Docker access
- **Rate Limiting**: 60 req/min Wolf, 30 req/min Docker

For detailed information, see [Authentication Architecture](./authentication-architecture.md).