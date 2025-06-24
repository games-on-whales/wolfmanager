#!/bin/bash
set -e
source /opt/wolf/scripts/utils.sh

wolf_log "**** Configure directory permissions (optimized) ****"

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

# Create all directories in one pass
wolf_log "Creating directories if needed"
mkdir -p "${APP_DIRS[@]}"

# Single chown command for all directories
wolf_log "Setting ownership of all directories to ${PUID}:${PGID}"
chown -R "$PUID:$PGID" "${APP_DIRS[@]}"

# Single find command for all directories - set permissions in one pass
wolf_log "Setting directory and file permissions"
find "${APP_DIRS[@]}" \( -type d -exec chmod 755 {} + \) -o \( -type f -exec chmod 644 {} + \)

# Set ownership of main app files in batch with single chown call
wolf_log "Setting ownership of application files"
chown -R "$PUID:$PGID" \
    /app/package.json \
    /app/pnpm-lock.yaml \
    /app/pnpm-workspace.yaml \
    /app/next.config.js \
    /app/src \
    2>/dev/null || true

# Handle node_modules if it exists
if [ -d "/app/node_modules" ]; then
    wolf_log "Setting ownership of node_modules"
    find /app/node_modules -print0 | xargs -0 -P $(nproc) chown -h "$PUID:$PGID"
fi

wolf_log "Directory permissions setup complete"
