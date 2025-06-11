# WolfManager Docker Setup

This directory contains the Docker configuration for WolfManager, implementing security best practices and proper permission handling for containerized deployment.

## Overview

The Docker setup follows industry best practices including:
- Multi-stage builds for optimized image size
- Non-root user execution for security
- Proper permission handling for sockets and volumes
- Dynamic group management for device access
- Secure initialization pattern

## Files

### Core Files
- `Dockerfile` - Multi-stage build configuration
- `docker-entrypoint.sh` - Main entrypoint script
- `.dockerignore` - Build context exclusions
- `docker-compose.yml` - Development configuration
- `docker-compose.production.yml` - Production configuration

### Initialization Scripts
- `scripts/utils.sh` - Utility functions
- `scripts/setup-user.sh` - User and group creation
- `scripts/setup-permissions.sh` - Directory permissions
- `scripts/setup-groups.sh` - Socket and device group management

## Security Model

### Initialization Process
1. Container starts as `root` user
2. Runs initialization scripts to:
   - Create/configure the application user (`node` by default)
   - Set proper directory permissions
   - Add user to required groups for socket access
3. Switches to non-root user using `gosu`
4. Starts the application

### Permission Handling
The setup dynamically handles permissions for:
- `/var/run/wolf/wolf.sock` - Wolf server socket
- `/var/run/docker.sock` - Docker daemon socket

Additional devices can be configured using the `WOLF_REQUIRED_DEVICES_OVERRIDE` environment variable.

## Environment Variables

### User Configuration
- `PUID=1000` - User ID for the application user
- `PGID=1000` - Group ID for the application user  
- `UNAME=node` - Username for the application user
- `UMASK=022` - Default umask for file creation

### Device Override
- `WOLF_REQUIRED_DEVICES_OVERRIDE` - Comma-separated list of devices/sockets to configure

### Application Configuration
- `NODE_ENV=production` - Node.js environment
- `PORT=3000` - Application port
- `HOSTNAME=0.0.0.0` - Bind hostname

### Database Configuration
- `DATABASE_TYPE=sqlite` - Database backend: `sqlite`, `postgresql`, or `mysql`
- `DATABASE_URL` - Database connection string (optional for SQLite)
  - SQLite: `file:./data/wolfmanager.db` (default)
  - PostgreSQL: `postgresql://username:password@host:5432/database`
  - MySQL: `mysql://username:password@host:3306/database`

## Building the Image

### Development Build
```bash
docker build -f build/Dockerfile -t wolfmanager:dev .
```

### Production Build
```bash
docker build -f build/Dockerfile -t wolfmanager:latest .
```

### Build with Custom User
```bash
docker build -f build/Dockerfile \
  --build-arg PUID=1001 \
  --build-arg PGID=1001 \
  -t wolfmanager:custom .
```

## Running the Container

### Basic Run
```bash
docker run -d \
  --name wolfmanager \
  -p 3000:3000 \
  wolfmanager:latest
```

### With Socket Access and Database Persistence
```bash
docker run -d \
  --name wolfmanager \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/run/wolf:/var/run/wolf \
  -v wolfmanager_data:/app/data \
  wolfmanager:latest
```

### With Custom User
```bash
docker run -d \
  --name wolfmanager \
  -p 3000:3000 \
  -e PUID=1001 \
  -e PGID=1001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wolfmanager:latest
```

### Development with Volume Mounts
```bash
docker run -d \
  --name wolfmanager-dev \
  -p 3000:3000 \
  -v $(pwd):/app \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e NODE_ENV=development \
  wolfmanager:dev
```

## Docker Compose

### Development
```bash
docker-compose -f build/docker-compose.yml up -d
```

### Production
```bash
docker-compose -f build/docker-compose.production.yml up -d
```

### With External Database
For production deployments with PostgreSQL or MySQL:

```bash
# PostgreSQL example
docker run -d \
  --name wolfmanager \
  -p 3000:3000 \
  -e DATABASE_TYPE=postgresql \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/wolfmanager \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/run/wolf:/var/run/wolf \
  wolfmanager:latest

# MySQL example
docker run -d \
  --name wolfmanager \
  -p 3000:3000 \
  -e DATABASE_TYPE=mysql \
  -e DATABASE_URL=mysql://user:pass@mysql:3306/wolfmanager \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/run/wolf:/var/run/wolf \
  wolfmanager:latest
```

## Database Persistence

### SQLite (Default)
SQLite database files are stored in `/app/data` inside the container. Mount a volume to persist data:

```bash
-v wolfmanager_data:/app/data
```

### PostgreSQL/MySQL
When using external databases, ensure:
1. Database server is accessible from the container
2. Database and user are created beforehand
3. Connection string includes proper credentials and SSL settings if needed

### TOML Migration
If migrating from a TOML-based configuration, the container can run the migration automatically:

```bash
docker exec wolfmanager npm run migrate-toml -- migrate --backup --verbose
```

## Troubleshooting

### Permission Issues
If you encounter permission issues:

1. Check the container logs:
   ```bash
   docker logs wolfmanager
   ```

2. Verify socket permissions:
   ```bash
   ls -la /var/run/docker.sock
   ls -la /var/run/wolf/
   ```

3. Check user group membership inside container:
   ```bash
   docker exec wolfmanager id node
   ```

### Socket Access Problems
If the application can't access sockets:

1. Ensure sockets are mounted:
   ```bash
   docker inspect wolfmanager | grep -A 10 '"Mounts"'
   ```

2. Check socket group ownership:
   ```bash
   docker exec wolfmanager stat /var/run/docker.sock
   ```

3. Override device detection:
   ```bash
   docker run -e WOLF_REQUIRED_DEVICES_OVERRIDE="/var/run/docker.sock,/custom/socket" ...
   ```

### Build Issues
If builds fail:

1. Clear Docker build cache:
   ```bash
   docker builder prune
   ```

2. Build with no cache:
   ```bash
   docker build --no-cache -f build/Dockerfile .
   ```

3. Check .dockerignore exclusions:
   ```bash
   cat build/.dockerignore
   ```

## Best Practices

1. **Always run as non-root**: The setup ensures the application runs as a non-privileged user
2. **Use specific tags**: Avoid `latest` in production, use specific version tags
3. **Monitor logs**: Check initialization logs for permission warnings
4. **Secure secrets**: Use Docker secrets or external secret management for sensitive data
5. **Regular updates**: Keep base images and dependencies updated

## Security Considerations

- Container starts as root only for initialization, then drops privileges
- Sockets are accessed through group membership, not ownership changes
- Application files are owned by the non-root user
- Sensitive files are excluded via .dockerignore
- No secrets are baked into the image layers

## References

This implementation follows patterns from:
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Games on Whales (GOW)](https://github.com/games-on-whales/gow) permission handling
- Docker security best practices