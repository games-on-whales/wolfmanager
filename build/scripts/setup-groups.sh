#!/bin/bash
set -euo pipefail

source /opt/wolf/scripts/utils.sh

wolf_log "**** Configure device and socket groups ****"

# Get environment variables with defaults
UNAME="${UNAME:-node}"

# Define critical sockets that WolfManager needs access to
WOLF_REQUIRED_DEVICES=(
    "/var/run/wolf/wolf.sock"
    "/var/run/docker.sock"
)

# Allow override via environment variable
if [ -n "${WOLF_REQUIRED_DEVICES_OVERRIDE:-}" ]; then
    # Split comma-separated override into array
    IFS=',' read -ra WOLF_REQUIRED_DEVICES <<< "$WOLF_REQUIRED_DEVICES_OVERRIDE"
fi

declare -A group_map

wolf_log "Checking access to required devices and sockets..."

for device_pattern in "${WOLF_REQUIRED_DEVICES[@]}"; do
    # Expand glob patterns
    for device in $device_pattern; do
        if [ -e "$device" ]; then
            wolf_log "Processing device: $device"
            
            # Get the group info for this device
            device_gid=$(get_file_gid "$device")
            device_group=$(get_group_name "$device_gid")
            
            wolf_log "Device $device has GID $device_gid (group: $device_group)"
            
            if [ "$device_group" = "UNKNOWN" ] || [ -z "$device_group" ]; then
                # Create a named group for this GID to avoid confusion
                new_group_name="wolf-gid-$device_gid"
                wolf_log "Creating group '$new_group_name' for GID $device_gid"
                groupadd -g "$device_gid" "$new_group_name" 2>/dev/null || true
                group_map[$new_group_name]=1
            else
                # Use the existing group name
                group_map[$device_group]=1
            fi
            
            # Ensure the device has group read/write permissions
            current_perms=$(stat -c "%a" "$device" 2>/dev/null || echo "000")
            group_perms=$(echo "$current_perms" | cut -c2)
            
            if [ "$group_perms" -lt 6 ]; then
                wolf_log "Setting group read/write permissions on $device"
                chmod g+rw "$device" 2>/dev/null || wolf_log "WARNING: Could not set permissions on $device"
            fi
            
        else
            wolf_log "Device/socket not found: $device (this may be normal if not mounted/created yet)"
        fi
    done
done

# Add user to all discovered groups
if [ ${#group_map[@]} -gt 0 ]; then
    groups_to_add=$(join_by "," "${!group_map[@]}")
    wolf_log "Adding user '$UNAME' to groups: $groups_to_add"
    
    # Get current supplementary groups
    current_groups=$(id -Gn "$UNAME" 2>/dev/null | tr ' ' ',' || echo "")
    
    # Combine current groups with new groups
    if [ -n "$current_groups" ]; then
        all_groups="${current_groups},${groups_to_add}"
    else
        all_groups="$groups_to_add"
    fi
    
    # Set supplementary groups (preserve existing ones)
    usermod -a -G "$groups_to_add" "$UNAME" 2>/dev/null || {
        wolf_log "WARNING: Could not add user to some groups. This may cause permission issues."
    }
    
    wolf_log "User '$UNAME' now belongs to groups: $(id -Gn "$UNAME" 2>/dev/null || echo 'unknown')"
else
    wolf_log "No additional groups needed for user '$UNAME'"
fi

# Verify access to critical sockets
wolf_log "Verifying socket access..."
for device_pattern in "${WOLF_REQUIRED_DEVICES[@]}"; do
    for device in $device_pattern; do
        if [ -e "$device" ] && [[ "$device" == *.sock ]]; then
            if is_accessible "$UNAME" "$device"; then
                wolf_log "✓ User '$UNAME' can access $device"
            else
                wolf_log "⚠ WARNING: User '$UNAME' may not have access to $device"
            fi
        fi
    done
done

wolf_log "Device and socket group setup complete"