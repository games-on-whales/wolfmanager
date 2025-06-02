#!/bin/bash
set -e

echo "=== WolfManager Container Startup ==="

# CRITICAL: Fix config directory permissions (we're running as root initially)
echo "Fixing config directory permissions..."
mkdir -p /app/config
chown -R 1000:1000 /app/config
echo "Config directory ownership set to node user (1000:1000)"

# Function to safely change socket permissions
fix_socket_permissions() {
    local socket_path="$1"
    local socket_name="$2"
    
    if [ -S "$socket_path" ]; then
        echo "Found $socket_name at $socket_path"
        
        # Check current ownership
        local current_owner=$(stat -c "%u:%g" "$socket_path" 2>/dev/null || echo "unknown")
        echo "$socket_name current ownership: $current_owner"
        
        # Try to make it accessible to node user (1000:1000)
        if chgrp 1000 "$socket_path" 2>/dev/null; then
            echo "Successfully set $socket_name group to node (1000)"
            chmod g+rw "$socket_path" 2>/dev/null || echo "Cannot change $socket_name permissions"
        else
            echo "Cannot change $socket_name group - checking if accessible..."
            # Check if node user can access it
            if su-exec 1000:1000 test -r "$socket_path" && su-exec 1000:1000 test -w "$socket_path" 2>/dev/null; then
                echo "$socket_name is accessible to node user"
            else
                echo "WARNING: $socket_name may not be accessible to node user"
            fi
        fi
    else
        echo "WARNING: $socket_name not found at $socket_path"
    fi
}

# Fix socket permissions if they exist
fix_socket_permissions "/var/run/wolf/wolf.sock" "Wolf socket"
fix_socket_permissions "/var/run/docker.sock" "Docker socket"

echo "=== Starting WolfManager Application as node user ==="
echo "Switching to node user (1000:1000) and starting application..."

# Install gosu if not present (fallback)
if ! command -v gosu &> /dev/null; then
    if command -v su-exec &> /dev/null; then
        # Use su-exec as fallback
        echo "Using su-exec to switch to node user"
        exec su-exec 1000:1000 "$@"
    else
        echo "Neither gosu nor su-exec available, running as root (not recommended)"
        exec "$@"
    fi
else
    # Use gosu to switch to node user and execute the command
    echo "Using gosu to switch to node user"
    exec gosu 1000:1000 "$@"
fi