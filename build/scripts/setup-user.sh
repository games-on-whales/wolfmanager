#!/bin/bash
set -e

source /opt/wolf/scripts/utils.sh

wolf_log "**** Configure WolfManager user ****"

# Get environment variables with defaults
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UNAME="${UNAME:-node}"
UMASK="${UMASK:-022}"

wolf_log "Setting up user uid=${PUID}(${UNAME}) gid=${PGID}(${UNAME})"

# Handle existing user with same UID
if user_exists "$PUID"; then
    existing_user=$(id -nu "$PUID" 2>/dev/null)
    if [ "$existing_user" != "$UNAME" ]; then
        wolf_log "Removing existing user '$existing_user' with UID $PUID"
        userdel -r "$existing_user" 2>/dev/null || true
    fi
fi

# Handle existing group with same GID
if group_exists "$PGID"; then
    existing_group=$(getent group "$PGID" | cut -d: -f1)
    if [ "$existing_group" != "$UNAME" ]; then
        wolf_log "Using existing group '$existing_group' with GID $PGID"
    fi
else
    wolf_log "Creating group '$UNAME' with GID $PGID"
    groupadd -g "$PGID" "$UNAME"
fi

# Create or update user
if user_exists "$UNAME"; then
    wolf_log "Updating existing user '$UNAME'"
    usermod -u "$PUID" -g "$PGID" -d "/home/$UNAME" "$UNAME" 2>/dev/null || true
else
    wolf_log "Creating user '$UNAME'"
    useradd -m -d "/home/$UNAME" -u "$PUID" -g "$PGID" -s /bin/bash "$UNAME"
fi

# Set umask
wolf_log "Setting umask to ${UMASK}"
umask "$UMASK"

# Ensure home directory ownership
wolf_log "Setting ownership of home directory"
chown -R "$PUID:$PGID" "/home/$UNAME" 2>/dev/null || true

# Create and set ownership of XDG_RUNTIME_DIR if it exists
if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ -d "$XDG_RUNTIME_DIR" ]; then
    wolf_log "Setting ownership of XDG_RUNTIME_DIR"
    chown -R "$PUID:$PGID" "$XDG_RUNTIME_DIR" 2>/dev/null || true
fi

wolf_log "User setup complete"