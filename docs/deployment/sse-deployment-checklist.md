# SSE Real-Time Updates Deployment Checklist

## Overview

This checklist ensures a secure and successful deployment of the real-time Server-Sent Events (SSE) feature for client status updates in WolfUI. The SSE feature provides instant notifications of Wolf streaming client state changes, replacing traditional polling with efficient real-time communication.

**⚠️ CRITICAL**: This feature includes security-sensitive components that require careful configuration to prevent authentication bypasses and unauthorized access.

## Pre-Deployment Requirements

### Environment Variables

#### Required Security Variables
```bash
# Authentication & Session Security
NEXTAUTH_SECRET=<64-character-random-hex-string>     # NextAuth.js session encryption
INTERNAL_SERVICE_TOKEN=<32-character-random-string> # Service-to-service authentication

# Generate these securely:
# For NEXTAUTH_SECRET:
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# For INTERNAL_SERVICE_TOKEN:
INTERNAL_SERVICE_TOKEN=$(openssl rand -base64 32)

# Example for securely storing INTERNAL_SERVICE_TOKEN:
echo "INTERNAL_SERVICE_TOKEN=$INTERNAL_SERVICE_TOKEN" >> .env.production
```

#### Database Configuration
```bash
# Choose one database type
DATABASE_TYPE=sqlite|postgresql|mysql

# SQLite (default for development)
DATABASE_URL=file:./data/wolfmanager.db

# PostgreSQL (recommended for production)
DATABASE_URL=postgresql://username:password@host:5432/wolfmanager?ssl=true

# MySQL (alternative production option)
DATABASE_URL=mysql://username:password@host:3306/wolfmanager?ssl=true
```

#### Optional Configuration
```bash
# Feature flags
NEXT_PUBLIC_FEATURE_GAME_LIBRARY_ENABLED=true
NEXT_PUBLIC_FEATURE_BACKGROUND_TASKS_ENABLED=true

# Logging (development only)
DEBUG_LOGS=true
```

### Version Requirements

- **Node.js**: >= 18.17.0
- **Next.js**: ^14.x
- **Database Drivers**:
  - SQLite: `better-sqlite3` (included)
  - PostgreSQL: `pg` >= 8.x
  - MySQL: `mysql2` >= 3.x

### Dependencies Verification

```bash
# Check Node.js version
node --version

# Verify required packages
npm list next-auth @auth/core drizzle-orm

# Ensure SSE-specific dependencies
npm list next @radix-ui/react-toast
```

## Security Configuration

### 1. INTERNAL_SERVICE_TOKEN Setup

**Critical**: The `INTERNAL_SERVICE_TOKEN` prevents authentication bypasses in the WolfEventService.

```bash
# Generate secure token using the same method as NEXTAUTH_SECRET
INTERNAL_SERVICE_TOKEN=$(openssl rand -base64 32)

# Add to production environment
echo "INTERNAL_SERVICE_TOKEN=$INTERNAL_SERVICE_TOKEN" >> .env.production
```

**Security Note**: This token authenticates internal service calls to the Wolf SSE endpoint. Never expose this token in client-side code or logs. Ensure it is stored securely in your environment configuration files.

### 2. Session Security (Production)

```bash
# Session configuration for production
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Verify secure cookie settings are enabled
# In production, cookies automatically use:
# - httpOnly: true
# - secure: true (HTTPS only)
# - sameSite: "lax"
```

### 3. SSL/TLS Configuration

**Requirements for Production**:

```nginx
# Example Nginx SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;

# Enable HSTS
add_header Strict-Transport-Security "max-age=63072000" always;

# Proxy SSE connections with proper headers
location /api/client-events {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_buffering off;
    proxy_read_timeout 86400;
}
```

### 4. Firewall and Network Configuration

```bash
# Required ports
# 3000: Next.js application server
# 443: HTTPS (production)
# Database port: 5432 (PostgreSQL) or 3306 (MySQL)

# Firewall rules (example for ufw)
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 3000  # Internal network only
```

## Database Updates

### 1. Backup Before Migration

```bash
# SQLite backup
cp ./data/wolfmanager.db ./data/wolfmanager.db.backup.$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump -h localhost -U username wolfmanager > backup_$(date +%Y%m%d_%H%M%S).sql

# MySQL backup
mysqldump -h localhost -u username -p wolfmanager > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Schema Migration Execution

```bash
# Generate migration for lastSeen column if not exists
npm run db:generate:script

# Apply database migrations
npm run db:migrate

# Verify migration success
npm run db:studio  # Opens Drizzle Studio for inspection
```

### 3. Index Verification

The SSE feature requires these indexes for optimal performance:

```sql
-- Verify these indexes exist:
-- client_devices_user_id_idx (for user filtering)
-- client_devices_wolf_client_id_idx (for event processing)
-- client_devices_user_id_wolf_client_id_unique_idx (for security)
```

**Verification Script**:
```bash
# Check indexes (SQLite)
sqlite3 ./data/wolfmanager.db ".schema client_devices"

# Check indexes (PostgreSQL)
psql -c "\d client_devices" wolfmanager

# Check indexes (MySQL)
mysql -e "SHOW INDEX FROM client_devices;" wolfmanager
```

## Application Configuration

### 1. Environment-Specific Settings

**Development**:
```bash
NODE_ENV=development
DEBUG_LOGS=true
DATABASE_TYPE=sqlite
```

**Staging**:
```bash
NODE_ENV=production
DEBUG_LOGS=true
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@staging-db:5432/wolfmanager?ssl=true
```

**Production**:
```bash
NODE_ENV=production
DEBUG_LOGS=false
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@prod-db:5432/wolfmanager?ssl=true&sslmode=require
```

### 2. Logging Configuration

SSE feature uses these log components:
- `WOLF_EVENTS`: WolfEventService operations
- `API`: SSE endpoint connections
- `PAIRING`: Client-side SSE connections
- `AUTH`: Authentication events

**Production Logging Setup**:
```bash
# Ensure log directory exists
mkdir -p /app/logs

# Configure log rotation
echo '/app/logs/wolf-ui.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 node node
}' > /etc/logrotate.d/wolf-ui
```

### 3. Performance Tuning

**Memory Management**:
```bash
# Set Node.js memory limits
NODE_OPTIONS="--max-old-space-size=2048"

# WolfEventService memory settings (configured in code):
# MAX_CLIENT_STATES: 1000 clients
# CLIENT_STATE_TTL: 24 hours
# CLEANUP_INTERVAL: 1 hour
```

**SSE Connection Limits**:
```bash
# Recommended limits per server instance:
# - 1000 concurrent SSE connections
# - Each connection: ~1KB memory + minimal CPU
# - Monitor with: ps aux | grep node
```

### 4. Resource Allocation

**Minimum Requirements**:
- CPU: 2 cores
- RAM: 2GB (1GB for app + 1GB for database)
- Disk: 10GB (logs + database growth)

**Production Recommendations**:
- CPU: 4 cores
- RAM: 4GB
- Disk: 50GB with SSD storage
- Network: 100Mbps (for SSE streams)

## Testing Checklist

### 1. Unit Test Execution

```bash
# Run all tests
npm test

# Test SSE-specific components
npm test -- --grep "SSE|WolfEventService|client-events"

# Test authentication
npm test -- --grep "auth"
```

### 2. Integration Test Scenarios

**Authentication Tests**:
```bash
# Test 1: Valid session access
curl -H "Cookie: next-auth.session-token=valid_token" \
     -H "Accept: text/event-stream" \
     http://localhost:3000/api/client-events

# Expected: 200 OK, SSE stream established

# Test 2: Invalid session rejection
curl -H "Accept: text/event-stream" \
     http://localhost:3000/api/client-events

# Expected: 401 Unauthorized
```

**SSE Functionality Tests**:
```bash
# Test 3: Event filtering
# 1. Login as user A
# 2. Connect to SSE endpoint
# 3. Generate events for user B's clients
# 4. Verify no events are received

# Test 4: Connection cleanup
# 1. Establish SSE connection
# 2. Terminate client connection
# 3. Verify server-side cleanup in logs
```

### 3. Security Vulnerability Scanning

```bash
# Dependency vulnerability scan
npm audit

# Fix high/critical vulnerabilities
npm audit fix

# Manual security checks
# 1. Verify INTERNAL_SERVICE_TOKEN is not logged
# 2. Check client-side code doesn't expose tokens
# 3. Confirm user isolation in SSE events
```

### 4. Performance Testing

**Load Testing SSE Connections**:
```bash
# Test concurrent SSE connections
# Use tools like Artillery.js or custom script

# artillery-sse-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "SSE Connection Test"
    requests:
      - get:
          url: "/api/client-events"
          headers:
            Accept: "text/event-stream"
            Cookie: "next-auth.session-token={{session_token}}"
```

## Deployment Steps

### 1. Pre-Deployment Verification

```bash
# Verify environment variables
env | grep -E "(NEXTAUTH_SECRET|INTERNAL_SERVICE_TOKEN|DATABASE_URL)"

# Check database connectivity
npm run db:studio

# Verify Wolf server connection
curl http://localhost:48010/api/v1/status  # Adjust port as needed
```

### 2. Build and Deploy

```bash
# Install dependencies
npm ci --production

# Build application
npm run build

# Start application
npm start

# Or using PM2 for production
pm2 start ecosystem.config.js
```

**ecosystem.config.js** (PM2 configuration):
```javascript
module.exports = {
  apps: [{
    name: 'wolf-ui',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 3. Health Check Verification

```bash
# Application health
curl -f http://localhost:3000/api/health || exit 1

# SSE endpoint availability
timeout 10s curl -H "Accept: text/event-stream" \
    -H "Cookie: next-auth.session-token=test" \
    http://localhost:3000/api/client-events | head -1

# Database connectivity
npm run db:studio --port 4983 --host 0.0.0.0 &
curl -f http://localhost:4983 || exit 1
```

### 4. Rollback Procedures

**Database Rollback**:
```bash
# SQLite rollback
cp ./data/wolfmanager.db.backup.TIMESTAMP ./data/wolfmanager.db

# PostgreSQL rollback
psql wolfmanager < backup_TIMESTAMP.sql

# MySQL rollback
mysql wolfmanager < backup_TIMESTAMP.sql
```

**Application Rollback**:
```bash
# Using PM2
pm2 stop wolf-ui
git checkout previous-stable-tag
npm ci --production
npm run build
pm2 start wolf-ui

# Using Docker
docker stop wolf-ui
docker run -d --name wolf-ui previous-image-tag
```

## Post-Deployment Verification

### 1. SSE Connection Testing

**Manual Testing**:
```bash
# Test 1: Successful connection
curl -v -H "Accept: text/event-stream" \
    -H "Cookie: next-auth.session-token=$(cat session_token)" \
    http://localhost:3000/api/client-events

# Expected output:
# < HTTP/1.1 200 OK
# < Content-Type: text/event-stream
# event: connected
# data: {"message":"SSE connection established"}
```

**Browser Testing**:
```javascript
// Open browser console on /clients page
// Verify SSE connection indicator shows "Live" with green dot
// Check Network tab for persistent EventSource connection
console.log("SSE Status:", document.querySelector('[data-testid="sse-status"]')?.textContent);
```

### 2. Real-Time Update Functionality

**Test Scenario**:
1. Login to WolfUI
2. Navigate to clients page
3. Verify "Live" indicator is green
4. Start/stop streaming on a Wolf client
5. Confirm immediate status updates without page refresh

**Expected Behaviors**:
- Status changes from "OFFLINE" → "STREAMING" → "OFFLINE"
- Last seen timestamps update in real-time
- Session badges appear/disappear correctly

### 3. Security Audit Verification

```bash
# Verify log entries show proper security
grep "SSE connection established" /app/logs/wolf-ui.log
grep "Filtering out event for unauthorized client" /app/logs/wolf-ui.log

# Check for authentication bypass attempts
grep "INTERNAL_SERVICE_TOKEN" /app/logs/wolf-ui.log
# Should only show legitimate internal service calls

# Verify user isolation
grep "clientId.*userId" /app/logs/wolf-ui.log
```

### 4. Performance Monitoring Setup

**Key Metrics to Monitor**:

```bash
# 1. Active SSE connections
netstat -an | grep :3000 | grep ESTABLISHED | wc -l

# 2. Memory usage
ps aux | grep node | awk '{print $6}' # RSS memory

# 3. Event processing rate
grep "Processing event" /app/logs/wolf-ui.log | tail -100

# 4. Database query performance
# Monitor client_devices table query times
```

**Monitoring Dashboard Setup**:
```bash
# Example Prometheus metrics (if using monitoring)
# sse_connections_active{instance="wolf-ui"} 
# sse_events_processed_total{type="CLIENT_UPDATE"}
# sse_connection_errors_total{reason="auth_failed"}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. SSE Connection Fails (Gray "Live" Indicator)

**Symptoms**: Browser shows SSE connection as disconnected

**Debug Steps**:
```bash
# Check browser network tab for error codes
# 401/403: Authentication issue
# 502/503: Server connectivity issue

# Server-side logs
grep "SSE connection" /app/logs/wolf-ui.log

# Check NextAuth session
grep "Session validation" /app/logs/wolf-ui.log
```

**Solutions**:
- Verify user is properly authenticated
- Check NEXTAUTH_SECRET environment variable
- Confirm session hasn't expired (4-hour default)

#### 2. Events Not Updating UI

**Symptoms**: SSE connected but client status doesn't change

**Debug Steps**:
```bash
# Check event filtering
grep "Filtering out event" /app/logs/wolf-ui.log

# Verify user owns the clients
# Check client_devices table for userId associations

# Monitor WolfEventService logs
grep "WolfEventService" /app/logs/wolf-ui.log
```

**Solutions**:
- Verify client ownership in database
- Check Wolf server event generation
- Restart WolfEventService if necessary

#### 3. Database Last Seen Not Updating

**Symptoms**: lastSeen timestamps remain stale

**Debug Steps**:
```bash
# Check database connection
npm run db:studio

# Monitor database updates
grep "Updated lastSeen" /app/logs/wolf-ui.log

# Check for database errors
grep "Failed to update lastSeen" /app/logs/wolf-ui.log
```

**Solutions**:
- Verify database write permissions
- Check database connection string
- Confirm lastSeen column exists in schema

#### 4. Memory Leaks

**Symptoms**: Increasing memory usage over time

**Debug Steps**:
```bash
# Monitor memory usage
watch -n 5 'ps aux | grep node'

# Check client state cache size
grep "Cleaned up stale client states" /app/logs/wolf-ui.log

# Monitor SSE connection count
netstat -an | grep :3000 | grep ESTABLISHED | wc -l
```

**Solutions**:
- Verify periodic cleanup is running (logs every hour)
- Check for stuck SSE connections
- Restart application if memory exceeds 2GB

### Log File Locations

```bash
# Application logs
/app/logs/wolf-ui.log          # Main application log
/app/logs/wolf-ui.error.log    # Error-only log

# System logs
/var/log/nginx/access.log      # Nginx access logs
/var/log/nginx/error.log       # Nginx error logs

# PM2 logs (if using PM2)
~/.pm2/logs/wolf-ui-out.log    # PM2 stdout
~/.pm2/logs/wolf-ui-error.log  # PM2 stderr
```

### Debug Procedures

**Enable Debug Logging**:
```bash
# Add to environment
DEBUG_LOGS=true

# Restart application
pm2 restart wolf-ui

# Monitor debug output
tail -f /app/logs/wolf-ui.log | grep DEBUG
```

**Manual SSE Testing**:
```bash
# Test SSE endpoint directly
curl -N -H "Accept: text/event-stream" \
    -H "Cookie: next-auth.session-token=$(cat session_token)" \
    http://localhost:3000/api/client-events

# Expected: Continuous stream with keep-alive messages every 20 seconds
```

### Emergency Contacts and Procedures

**Escalation Path**:
1. **Level 1**: Application restart
   ```bash
   pm2 restart wolf-ui
   ```

2. **Level 2**: Service restart with cleanup
   ```bash
   pm2 stop wolf-ui
   pm2 delete wolf-ui
   pm2 start ecosystem.config.js
   ```

3. **Level 3**: Database rollback
   ```bash
   # Use backup procedures from rollback section
   ```

4. **Level 4**: Full application rollback
   ```bash
   # Use git rollback procedures
   ```

## Monitoring and Maintenance

### Key Metrics to Monitor

#### 1. SSE Performance Metrics

```bash
# Connection count
netstat -an | grep :3000 | grep ESTABLISHED | wc -l
# Alert if > 800 connections

# Event processing rate
grep -c "Processing event" /app/logs/wolf-ui.log
# Should process events within 10ms

# Connection errors
grep -c "SSE connection error" /app/logs/wolf-ui.log
# Alert if > 10 errors/hour
```

#### 2. Application Health Metrics

```bash
# Memory usage
ps aux | grep node | awk '{sum+=$6} END {print sum/1024 " MB"}'
# Alert if > 2048 MB

# CPU usage
top -p $(pgrep node) -n 1 | grep node | awk '{print $9}'
# Alert if > 80% for sustained periods

# Database connection pool
# Monitor active connections to database
```

#### 3. Security Metrics

```bash
# Failed authentication attempts
grep -c "Invalid credentials\|Unauthorized" /app/logs/wolf-ui.log
# Alert if > 50 failures/hour

# Suspicious event filtering
grep -c "Filtering out event for unauthorized client" /app/logs/wolf-ui.log
# Normal operation, but spike may indicate attack

# Internal service token usage
grep -c "Internal service call" /app/logs/wolf-ui.log
# Should be steady, spikes may indicate issues
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| SSE Connections | 600 | 800 | Scale horizontally |
| Memory Usage | 1.5GB | 2GB | Restart service |
| CPU Usage | 70% | 85% | Investigate load |
| Auth Failures | 30/hour | 50/hour | Security review |
| Database Errors | 5/hour | 20/hour | Check DB health |

### Regular Maintenance Tasks

#### Daily Tasks
```bash
# Check service health
pm2 status

# Monitor log file sizes
du -sh /app/logs/*.log

# Verify SSE connections
curl -f http://localhost:3000/api/client-events -H "Accept: text/event-stream" --max-time 5
```

#### Weekly Tasks
```bash
# Rotate logs manually if needed
logrotate -f /etc/logrotate.d/wolf-ui

# Update dependencies (security patches)
npm audit

# Database maintenance
npm run db:studio  # Check for data growth
```

#### Monthly Tasks
```bash
# Database backup
pg_dump wolfmanager > backup_monthly_$(date +%Y%m%d).sql

# Performance review
# Analyze SSE connection patterns
# Review memory usage trends
# Check for any performance degradation

# Security audit
# Review authentication logs
# Check for any suspicious patterns
# Update security configurations if needed
```

### Performance Optimization Recommendations

#### 1. SSE Connection Optimization

```bash
# Nginx configuration for SSE
# Disable buffering for real-time delivery
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400;

# Connection keep-alive optimization
proxy_set_header Connection '';
proxy_http_version 1.1;
```

#### 2. Database Optimization

```sql
-- Index optimization for SSE queries
CREATE INDEX IF NOT EXISTS idx_client_devices_user_wolf_client 
ON client_devices(user_id, wolf_client_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM client_devices WHERE user_id = 'uuid';
```

#### 3. Memory Management

```javascript
// WolfEventService optimization (already implemented)
// - Periodic cleanup every hour
// - TTL of 24 hours for cached entries
// - Maximum 1000 cached client states

// Additional optimization for high-load scenarios
process.env.NODE_OPTIONS = '--max-old-space-size=4096';  // Increase if needed
```

#### 4. Horizontal Scaling Considerations

**Current Limitations**:
- Single-server SSE connections
- In-memory client state storage
- No event persistence

**Scaling Solutions** (Future Enhancements):
```bash
# Redis pub/sub for multi-server deployments
# Event persistence in database
# Load balancer with sticky sessions
# Connection pooling optimization
```

---

## Deployment Sign-off Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database backup completed
- [ ] Security tokens generated
- [ ] SSL certificates installed
- [ ] Dependencies updated

### Deployment
- [ ] Application built successfully
- [ ] Database migrations applied
- [ ] Health checks pass
- [ ] SSE endpoint responds correctly
- [ ] Authentication works

### Post-Deployment
- [ ] Real-time updates functional
- [ ] User isolation verified
- [ ] Performance metrics baseline established
- [ ] Monitoring alerts configured
- [ ] Documentation updated

### Security Verification
- [ ] INTERNAL_SERVICE_TOKEN secured
- [ ] User event filtering working
- [ ] Authentication bypass prevented
- [ ] SSL/TLS properly configured
- [ ] Security logs monitored

**Deployment Completed By**: _________________  
**Date**: _________________  
**Verified By**: _________________  
**Date**: _________________

---

*This checklist should be completed in full for production deployments. For development/staging environments, security and performance requirements may be relaxed but should still be verified.*