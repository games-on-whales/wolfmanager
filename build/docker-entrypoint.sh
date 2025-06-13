#!/bin/bash
set -euo pipefail

# Source utility functions
source /opt/wolf/scripts/utils.sh

wolf_log "=== WolfManager Container Startup ==="

# Get environment variables with defaults
UNAME="${UNAME:-node}"

# Execute initialization scripts only if running as root
if [ "$(id -u)" = "0" ]; then
    wolf_log "Running as root - executing initialization scripts"
    
    # Run user setup first
    if ! /opt/wolf/scripts/setup-user.sh; then
        wolf_log "ERROR: User setup failed"
        exit 1
    fi
    
    # Run permission setup
    if ! /opt/wolf/scripts/setup-permissions.sh; then
        wolf_log "ERROR: Permission setup failed"
        exit 1
    fi
    
    # Run device/socket group setup
    if ! /opt/wolf/scripts/setup-groups.sh; then
        wolf_log "ERROR: Group setup failed"
        exit 1
    fi
    
    # Setup symlink for .env.local to persist in /app/config
    wolf_log "Setting up persistent .env.local symlink"
    if [ ! -L "/app/.env.local" ]; then
        # If .env.local exists as a regular file and config version doesn't exist, move it
        if [ -f "/app/.env.local" ] && [ ! -L "/app/.env.local" ] && [ ! -f "/app/config/.env.local" ]; then
            wolf_log "Moving existing .env.local to /app/config/"
            mv "/app/.env.local" "/app/config/.env.local"
        elif [ -f "/app/.env.local" ] && [ ! -L "/app/.env.local" ] && [ -f "/app/config/.env.local" ]; then
            wolf_log "Config version already exists, removing container .env.local"
            rm "/app/.env.local"
        fi
        # Create symlink from .env.local to the persistent config location
        wolf_log "Creating symlink: /app/.env.local -> /app/config/.env.local"
        ln -sf "/app/config/.env.local" "/app/.env.local"
        # Ensure proper ownership
        chown -h "${UNAME}:${UNAME}" "/app/.env.local"
        chown "${UNAME}:${UNAME}" "/app/config/.env.local" 2>/dev/null || true
    else
        wolf_log "Symlink already exists for .env.local"
    fi
    
    wolf_log "Initialization complete - switching to ${UNAME} user"
    
    # If no command provided, use default command
    if [ $# -eq 0 ]; then
        wolf_log "No command provided - using default: pnpm start"
        set -- "pnpm" "start"
    fi
    
    # Execute command as the non-root user
    wolf_log "Executing command as ${UNAME}: $*"
    exec gosu "${UNAME}" "$@"
else
    wolf_log "Not running as root - skipping initialization"
    
    # If not root, just execute the command directly
    if [ $# -eq 0 ]; then
        wolf_log "No command provided - using default: pnpm start"
        exec pnpm start
    else
        wolf_log "Executing command directly: $*"
        exec "$@"
    fi
fi