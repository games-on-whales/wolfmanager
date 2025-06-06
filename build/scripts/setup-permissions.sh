#!/bin/bash
set -e

source /opt/wolf/scripts/utils.sh

wolf_log "**** Configure directory permissions ****"

# Get environment variables with defaults
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UNAME="${UNAME:-node}"

# Application directories that need proper ownership
APP_DIRS=(
    "/app/config"
    "/app/config/logs"
    "/app/logs"
    "/app/.next"
    "/app/public"
)

# Create and set ownership for application directories
for dir in "${APP_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        wolf_log "Creating directory: $dir"
        mkdir -p "$dir"
    fi
    
    wolf_log "Setting ownership of $dir to ${PUID}:${PGID}"
    chown -R "$PUID:$PGID" "$dir"
    
    # Set appropriate permissions
    # Directories: 755 (owner: rwx, group: rx, others: rx)
    # Files: 644 (owner: rw, group: r, others: r)
    find "$dir" -type d -exec chmod 755 {} \;
    find "$dir" -type f -exec chmod 644 {} \;
done


# Set ownership of the main app directory contents (but not /app itself)
wolf_log "Setting ownership of application files"
chown -R "$PUID:$PGID" /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml 2>/dev/null || true
chown -R "$PUID:$PGID" /app/next.config.js 2>/dev/null || true
chown -R "$PUID:$PGID" /app/src 2>/dev/null || true

# Ensure node_modules has correct permissions if it exists
if [ -d "/app/node_modules" ]; then
    wolf_log "Setting ownership of node_modules"
    chown -R "$PUID:$PGID" /app/node_modules
fi

wolf_log "Directory permissions setup complete"