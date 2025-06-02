#!/bin/bash
set -e

echo "=== WolfManager Container Startup ==="

# Function to safely change ownership if we have permission
fix_socket_permissions() {
    local socket_path="$1"
    local socket_name="$2"
    
    if [ -S "$socket_path" ]; then
        echo "Found $socket_name at $socket_path"
        
        # Check current ownership
        local current_owner=$(stat -c "%u:%g" "$socket_path" 2>/dev/null || echo "unknown")
        echo "$socket_name current ownership: $current_owner"
        
        # Try to make it accessible to node user (if we have permission)
        if chgrp node "$socket_path" 2>/dev/null; then
            echo "Successfully set $socket_name group to 'node'"
        else
            echo "Cannot change $socket_name group (likely no permission) - checking if accessible..."
            if [ -r "$socket_path" ] && [ -w "$socket_path" ]; then
                echo "$socket_name is already accessible to current user"
            else
                echo "WARNING: $socket_name may not be accessible to node user"
            fi
        fi
        
        # Make sure it has proper permissions for group access
        chmod g+rw "$socket_path" 2>/dev/null || echo "Cannot change $socket_name permissions (proceeding anyway)"
    else
        echo "WARNING: $socket_name not found at $socket_path"
    fi
}

# Config directory permissions should be set during build
echo "Checking config directory permissions..."
ls -la /app/config/ 2>/dev/null || echo "Config directory not found"

# Fix socket permissions if they exist
fix_socket_permissions "/var/run/wolf/wolf.sock" "Wolf socket"
fix_socket_permissions "/var/run/docker.sock" "Docker socket"

echo "=== Starting WolfManager Application ==="
echo "Running as user: $(whoami) ($(id))"
echo "Current working directory: $(pwd)"

# Start the Next.js application
exec "$@"