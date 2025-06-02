# Fix for Clients Page 404 Error

## Problem Description

After logging in, the clients page fails to load with a 404 error and displays:
- "Error Loading Clients"
- "Failed to load client data"

## Root Cause Analysis

The issue is caused by the **missing Wolf socket volume mount** in the Docker container configuration. The WolfManager application needs to communicate with the Wolf server via a Unix domain socket at `/var/run/wolf/wolf.sock`, but this socket is not accessible inside the container.

## Diagnosis Steps

### 1. Run the Wolf Connection Diagnostic

Navigate to: `http://localhost:3000/debug/wolf-connection`

This diagnostic page will test:
- Socket file existence and permissions
- Environment information
- Wolf API endpoint validation
- Direct socket connections

### 2. Check Expected Results

**Failing Configuration:**
- Socket File Test: ❌ Fail (file not found)
- Wolf API Tests: ❌ Fail (connection refused)

**Working Configuration:**
- Socket File Test: ✅ Pass (socket exists and accessible)
- Wolf API Tests: ✅ Pass (successful API calls)

## Solution

### Option 1: Quick Fix for Existing Setup

If you're running WolfManager standalone and have Wolf running separately:

1. Update your `docker-compose.yml` to include the Wolf socket volume:

```yaml
version: "3.8"

services:
  wolf-admin:
    build:
      context: ..
      dockerfile: build/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXTAUTH_SECRET=your-generated-secret-here
      - ENCRYPTION_KEY=your-32-character-encryption-key
    volumes:
      - /var/run/wolf/wolf.sock:/var/run/wolf/wolf.sock:ro
    restart: unless-stopped
```

2. Restart the container:
```bash
docker-compose down
docker-compose up -d
```

### Option 2: Complete Production Setup

Use the comprehensive production configuration that includes both Wolf and WolfManager:

1. Copy `build/docker-compose.production.yml` to your deployment location
2. Set required environment variables:
```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32 | cut -c1-32)
```
3. Start the full stack:
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Option 3: Manual Docker Run

If using `docker run` commands:

```bash
# Ensure Wolf socket volume is mounted
docker run -d \
  --name wolf-admin \
  -p 3000:3000 \
  -v /var/run/wolf/wolf.sock:/var/run/wolf/wolf.sock:ro \
  -e NODE_ENV=production \
  -e NEXTAUTH_SECRET=your-secret \
  -e ENCRYPTION_KEY=your-key \
  your-wolf-admin-image
```

## Verification

After applying the fix:

1. Navigate to `http://localhost:3000/debug/wolf-connection`
2. Click "Run Wolf Connection Test"
3. Verify all tests pass:
   - ✅ Socket File Test: exists and accessible
   - ✅ Wolf API /pair/pending Test: successful response
   - ✅ Wolf API /clients Test: successful response

4. Navigate to `http://localhost:3000/clients`
5. Verify the clients page loads without errors

## Common Issues

### Wolf Socket Path

If Wolf is using a different socket path, update the volume mount accordingly:
```yaml
volumes:
  - /path/to/your/wolf.sock:/var/run/wolf/wolf.sock:ro
```

### Permission Issues

Ensure the socket has proper permissions. Wolf socket should be accessible by the container user:
```bash
# Check socket permissions
ls -la /var/run/wolf/wolf.sock

# Should show something like:
# srw-rw-r-- 1 root node ... /var/run/wolf/wolf.sock
```

### Wolf Not Running

Ensure Wolf server is running and the API socket is enabled:
```bash
# Test Wolf API directly
curl --unix-socket /var/run/wolf/wolf.sock http://localhost/api/v1/openapi-schema
```

## Additional Resources

- [Wolf Documentation](https://github.com/games-on-whales/wolf)
- [WolfManager Setup Guide](../README.md#getting-started)
- [Docker Compose Documentation](https://docs.docker.com/compose/)