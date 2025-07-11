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

# =============================================================================
# Secret Generation Functions for Docker-Level Secret Management
# =============================================================================

# Generate cryptographically secure secrets using openssl
generate_secret() {
    local length="$1"
    if ! command -v openssl >/dev/null 2>&1; then
        wolf_log "ERROR: openssl not found. Cannot generate secure secrets."
        return 1
    fi
    openssl rand -hex "$length"
}

# Check if a secret exists in .env.local file with correct length
check_secret_in_file() {
    local file="$1"
    local secret_name="$2"
    local expected_length="$3"
    
    if [ -f "$file" ]; then
        local value=$(grep "^${secret_name}=" "$file" 2>/dev/null | cut -d'=' -f2-)
        if [ -n "$value" ] && [ ${#value} -eq "$expected_length" ]; then
            return 0  # Secret exists and has correct length
        fi
    fi
    return 1  # Secret missing or wrong length
}

# Append a secret to .env.local file safely
append_secret_to_file() {
    local file="$1"
    local secret_name="$2"
    local secret_value="$3"
    
    # Create file if it doesn't exist
    touch "$file"
    
    # Remove any existing line with this secret name to avoid duplicates
    if [ -f "$file" ]; then
        grep -v "^${secret_name}=" "$file" > "${file}.tmp" 2>/dev/null || true
        mv "${file}.tmp" "$file"
    fi
    
    # Append the new secret
    echo "${secret_name}=${secret_value}" >> "$file"
}

# Get existing secret value from .env.local file
get_secret_from_file() {
    local file="$1"
    local secret_name="$2"
    
    if [ -f "$file" ]; then
        grep "^${secret_name}=" "$file" 2>/dev/null | cut -d'=' -f2-
    fi
}

# Generate all required secrets before Node.js starts
ensure_docker_secrets() {
    local env_file="/app/.env.local"
    local secrets_generated=()
    
    wolf_log "=== Docker-Level Secret Generation ==="
    wolf_log "Ensuring required secrets exist before Node.js startup"
    
    # Create the directory if it doesn't exist
    mkdir -p "$(dirname "$env_file")"
    
    # Ensure NEXTAUTH_SECRET (128 chars)
    if ! check_secret_in_file "$env_file" "NEXTAUTH_SECRET" 128; then
        wolf_log "Generating NEXTAUTH_SECRET..."
        local nextauth_secret=$(generate_secret 64)  # 64 bytes = 128 hex chars
        if [ $? -eq 0 ] && [ ${#nextauth_secret} -eq 128 ]; then
            append_secret_to_file "$env_file" "NEXTAUTH_SECRET" "$nextauth_secret"
            export NEXTAUTH_SECRET="$nextauth_secret"
            secrets_generated+=("NEXTAUTH_SECRET")
            wolf_log "✓ Generated NEXTAUTH_SECRET (128 characters)"
        else
            wolf_log "ERROR: Failed to generate NEXTAUTH_SECRET"
            return 1
        fi
    else
        # Export existing secret
        local existing_secret=$(get_secret_from_file "$env_file" "NEXTAUTH_SECRET")
        export NEXTAUTH_SECRET="$existing_secret"
        wolf_log "✓ Using existing NEXTAUTH_SECRET (128 characters)"
    fi
    
    # Ensure INTERNAL_SERVICE_TOKEN (128 chars)
    if ! check_secret_in_file "$env_file" "INTERNAL_SERVICE_TOKEN" 128; then
        wolf_log "Generating INTERNAL_SERVICE_TOKEN..."
        local service_token=$(generate_secret 64)  # 64 bytes = 128 hex chars
        if [ $? -eq 0 ] && [ ${#service_token} -eq 128 ]; then
            append_secret_to_file "$env_file" "INTERNAL_SERVICE_TOKEN" "$service_token"
            export INTERNAL_SERVICE_TOKEN="$service_token"
            secrets_generated+=("INTERNAL_SERVICE_TOKEN")
            wolf_log "✓ Generated INTERNAL_SERVICE_TOKEN (128 characters)"
        else
            wolf_log "ERROR: Failed to generate INTERNAL_SERVICE_TOKEN"
            return 1
        fi
    else
        # Export existing token
        local existing_token=$(get_secret_from_file "$env_file" "INTERNAL_SERVICE_TOKEN")
        export INTERNAL_SERVICE_TOKEN="$existing_token"
        wolf_log "✓ Using existing INTERNAL_SERVICE_TOKEN (128 characters)"
    fi
    
    # Ensure ENCRYPTION_KEY (64 chars)
    if ! check_secret_in_file "$env_file" "ENCRYPTION_KEY" 64; then
        wolf_log "Generating ENCRYPTION_KEY..."
        local encryption_key=$(generate_secret 32)  # 32 bytes = 64 hex chars
        if [ $? -eq 0 ] && [ ${#encryption_key} -eq 64 ]; then
            append_secret_to_file "$env_file" "ENCRYPTION_KEY" "$encryption_key"
            export ENCRYPTION_KEY="$encryption_key"
            secrets_generated+=("ENCRYPTION_KEY")
            wolf_log "✓ Generated ENCRYPTION_KEY (64 characters)"
        else
            wolf_log "ERROR: Failed to generate ENCRYPTION_KEY"
            return 1
        fi
    else
        # Export existing key
        local existing_key=$(get_secret_from_file "$env_file" "ENCRYPTION_KEY")
        export ENCRYPTION_KEY="$existing_key"
        wolf_log "✓ Using existing ENCRYPTION_KEY (64 characters)"
    fi
    
    # Report results
    if [ ${#secrets_generated[@]} -gt 0 ]; then
        wolf_log "Generated new secrets: ${secrets_generated[*]}"
        wolf_log "Secrets written to $env_file"
        wolf_log "All secrets will persist via symlink to /app/config/.env.local"
    else
        wolf_log "All required secrets already exist with correct lengths"
    fi
    
    # Verify all secrets are now available as environment variables
    if [ -z "$NEXTAUTH_SECRET" ] || [ -z "$INTERNAL_SERVICE_TOKEN" ] || [ -z "$ENCRYPTION_KEY" ]; then
        wolf_log "ERROR: Not all secrets are available as environment variables"
        return 1
    fi
    
    wolf_log "✓ All secrets successfully generated and exported to environment"
    wolf_log "✓ Secrets available before Node.js application startup"
    
    return 0
}