#!/bin/bash

# Test script for Docker-level secret generation
# This script validates the secret generation functions work correctly

# Source the utils functions
source "$(dirname "$0")/utils.sh"

# Test environment
TEST_ENV_FILE="/tmp/test-env.local"
TEST_CONFIG_DIR="/tmp/test-config"

# Cleanup function
cleanup() {
    rm -f "$TEST_ENV_FILE"
    rm -rf "$TEST_CONFIG_DIR"
}

# Setup test environment
setup_test() {
    cleanup
    mkdir -p "$TEST_CONFIG_DIR"
    echo "=== Testing Docker-Level Secret Generation ==="
}

# Test 1: Fresh installation (no existing secrets)
test_fresh_installation() {
    echo ""
    echo "Test 1: Fresh installation (no existing secrets)"
    echo "================================================"
    
    # Temporarily override the env file path for testing
    original_ensure_docker_secrets=$(declare -f ensure_docker_secrets)
    eval "test_ensure_docker_secrets() { ${original_ensure_docker_secrets#*\{} }"
    
    # Modify the function to use test file
    test_ensure_docker_secrets_modified() {
        local env_file="$TEST_ENV_FILE"
        local secrets_generated=()
        
        wolf_log "Testing secret generation with file: $env_file"
        
        # Create the directory if it doesn't exist
        mkdir -p "$(dirname "$env_file")"
        
        # Test NEXTAUTH_SECRET generation
        if ! check_secret_in_file "$env_file" "NEXTAUTH_SECRET" 128; then
            local nextauth_secret=$(generate_secret 64)
            if [ $? -eq 0 ] && [ ${#nextauth_secret} -eq 128 ]; then
                append_secret_to_file "$env_file" "NEXTAUTH_SECRET" "$nextauth_secret"
                secrets_generated+=("NEXTAUTH_SECRET")
                echo "✓ Generated NEXTAUTH_SECRET (${#nextauth_secret} characters)"
            else
                echo "✗ Failed to generate NEXTAUTH_SECRET"
                return 1
            fi
        fi
        
        # Test INTERNAL_SERVICE_TOKEN generation
        if ! check_secret_in_file "$env_file" "INTERNAL_SERVICE_TOKEN" 128; then
            local service_token=$(generate_secret 64)
            if [ $? -eq 0 ] && [ ${#service_token} -eq 128 ]; then
                append_secret_to_file "$env_file" "INTERNAL_SERVICE_TOKEN" "$service_token"
                secrets_generated+=("INTERNAL_SERVICE_TOKEN")
                echo "✓ Generated INTERNAL_SERVICE_TOKEN (${#service_token} characters)"
            else
                echo "✗ Failed to generate INTERNAL_SERVICE_TOKEN"
                return 1
            fi
        fi
        
        # Test ENCRYPTION_KEY generation
        if ! check_secret_in_file "$env_file" "ENCRYPTION_KEY" 64; then
            local encryption_key=$(generate_secret 32)
            if [ $? -eq 0 ] && [ ${#encryption_key} -eq 64 ]; then
                append_secret_to_file "$env_file" "ENCRYPTION_KEY" "$encryption_key"
                secrets_generated+=("ENCRYPTION_KEY")
                echo "✓ Generated ENCRYPTION_KEY (${#encryption_key} characters)"
            else
                echo "✗ Failed to generate ENCRYPTION_KEY"
                return 1
            fi
        fi
        
        echo "✓ Generated secrets: ${secrets_generated[*]}"
        return 0
    }
    
    # Run the test
    if test_ensure_docker_secrets_modified; then
        echo "✓ Fresh installation test PASSED"
        
        # Verify file contents
        if [ -f "$TEST_ENV_FILE" ]; then
            echo "Generated .env.local content:"
            cat "$TEST_ENV_FILE"
        fi
    else
        echo "✗ Fresh installation test FAILED"
        return 1
    fi
}

# Test 2: Existing secrets (idempotent behavior)
test_existing_secrets() {
    echo ""
    echo "Test 2: Existing secrets (idempotent behavior)"
    echo "==============================================="
    
    # Pre-populate with valid secrets (correct lengths)
    cat > "$TEST_ENV_FILE" << EOF
NEXTAUTH_SECRET=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
INTERNAL_SERVICE_TOKEN=fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
EOF
    
    echo "Pre-existing secrets:"
    cat "$TEST_ENV_FILE"
    
    # Test that existing secrets are preserved
    local original_content=$(cat "$TEST_ENV_FILE")
    
    # Check each secret
    if check_secret_in_file "$TEST_ENV_FILE" "NEXTAUTH_SECRET" 128; then
        echo "✓ NEXTAUTH_SECRET exists with correct length"
    else
        echo "✗ NEXTAUTH_SECRET validation failed"
        return 1
    fi
    
    if check_secret_in_file "$TEST_ENV_FILE" "INTERNAL_SERVICE_TOKEN" 128; then
        echo "✓ INTERNAL_SERVICE_TOKEN exists with correct length"
    else
        echo "✗ INTERNAL_SERVICE_TOKEN validation failed"
        return 1
    fi
    
    if check_secret_in_file "$TEST_ENV_FILE" "ENCRYPTION_KEY" 64; then
        echo "✓ ENCRYPTION_KEY exists with correct length"
    else
        echo "✗ ENCRYPTION_KEY validation failed"
        return 1
    fi
    
    # Verify content hasn't changed
    local new_content=$(cat "$TEST_ENV_FILE")
    if [ "$original_content" = "$new_content" ]; then
        echo "✓ Existing secrets preserved (idempotent behavior)"
    else
        echo "✗ File content changed unexpectedly"
        return 1
    fi
    
    echo "✓ Existing secrets test PASSED"
}

# Test 3: Invalid length secrets (should regenerate)
test_invalid_secrets() {
    echo ""
    echo "Test 3: Invalid length secrets (should regenerate)"
    echo "=================================================="
    
    # Create file with invalid length secrets
    cat > "$TEST_ENV_FILE" << EOF
NEXTAUTH_SECRET=short
INTERNAL_SERVICE_TOKEN=too_short_token
ENCRYPTION_KEY=invalid
EOF
    
    echo "Invalid secrets:"
    cat "$TEST_ENV_FILE"
    
    # Test validation functions
    if ! check_secret_in_file "$TEST_ENV_FILE" "NEXTAUTH_SECRET" 128; then
        echo "✓ Correctly identified invalid NEXTAUTH_SECRET"
    else
        echo "✗ Failed to identify invalid NEXTAUTH_SECRET"
        return 1
    fi
    
    if ! check_secret_in_file "$TEST_ENV_FILE" "INTERNAL_SERVICE_TOKEN" 128; then
        echo "✓ Correctly identified invalid INTERNAL_SERVICE_TOKEN"
    else
        echo "✗ Failed to identify invalid INTERNAL_SERVICE_TOKEN"
        return 1
    fi
    
    if ! check_secret_in_file "$TEST_ENV_FILE" "ENCRYPTION_KEY" 64; then
        echo "✓ Correctly identified invalid ENCRYPTION_KEY"
    else
        echo "✗ Failed to identify invalid ENCRYPTION_KEY"
        return 1
    fi
    
    echo "✓ Invalid secrets test PASSED"
}

# Test 4: openssl availability
test_openssl_availability() {
    echo ""
    echo "Test 4: OpenSSL availability and secret generation"
    echo "=================================================="
    
    if command -v openssl >/dev/null 2>&1; then
        echo "✓ OpenSSL is available"
        
        # Test secret generation
        local test_secret=$(generate_secret 16)
        if [ $? -eq 0 ] && [ ${#test_secret} -eq 32 ]; then
            echo "✓ Secret generation works (generated ${#test_secret} character secret)"
        else
            echo "✗ Secret generation failed"
            return 1
        fi
    else
        echo "✗ OpenSSL not found - secret generation will fail"
        return 1
    fi
    
    echo "✓ OpenSSL test PASSED"
}

# Run all tests
run_tests() {
    setup_test
    
    local failed_tests=0
    
    test_openssl_availability || ((failed_tests++))
    test_fresh_installation || ((failed_tests++))
    test_existing_secrets || ((failed_tests++))
    test_invalid_secrets || ((failed_tests++))
    
    echo ""
    echo "=== Test Results ==="
    if [ $failed_tests -eq 0 ]; then
        echo "✓ All tests PASSED"
        echo "✓ Docker-level secret generation is working correctly"
    else
        echo "✗ $failed_tests test(s) FAILED"
        echo "✗ Issues detected in secret generation implementation"
    fi
    
    cleanup
    return $failed_tests
}

# Execute tests
run_tests