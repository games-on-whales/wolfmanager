#!/bin/bash

# Utility functions for WolfManager container initialization

wolf_log() {
    echo "$(date +"[%Y-%m-%d %H:%M:%S]") [WolfManager] $*"
}

# Join array elements by delimiter
join_by() { 
    local IFS="$1"
    shift
    echo "$*"
}

# Check if a user exists
user_exists() {
    id "$1" &>/dev/null
}

# Check if a group exists
group_exists() {
    getent group "$1" &>/dev/null
}

# Get the group name for a given GID
get_group_name() {
    local gid="$1"
    getent group "$gid" | cut -d: -f1 2>/dev/null || echo "UNKNOWN"
}

# Get the group ID for a given file/device
get_file_gid() {
    local file="$1"
    stat -c "%g" "$file" 2>/dev/null || echo ""
}

# Check if a file/device is readable and writable by a user
is_accessible() {
    local user="$1"
    local file="$2"
    gosu "$user" test -r "$file" && gosu "$user" test -w "$file" 2>/dev/null
}