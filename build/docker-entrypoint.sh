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