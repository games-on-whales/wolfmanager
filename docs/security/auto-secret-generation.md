# Security: Automatic Secret Generation

This document provides comprehensive information about WolfManager's automatic secret generation feature, addressing security considerations, implementation details, and best practices.

## Overview

WolfManager automatically generates cryptographically secure secrets on first startup to eliminate common security vulnerabilities associated with:

- Default or weak secrets in production deployments
- Manual secret generation using insecure methods
- Forgotten secret configuration leading to application failures

## Security Architecture

### Cryptographic Foundation

**Random Number Generation:**

- Uses Node.js `crypto.randomBytes()` for cryptographically secure random number generation
- Leverages the operating system's entropy pool for maximum randomness
- No predictable patterns or weak pseudo-random generators

**Key Specifications:**

- **NEXTAUTH_SECRET**: 64 hexadecimal characters (256 bits of entropy)
- **ENCRYPTION_KEY**: 32 hexadecimal characters (128 bits of entropy, used as 256-bit key)

### Implementation Security

**Process Isolation:**

```typescript
// Auto-generation happens during application startup
// Before any user requests are processed
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSecureKeys } = await import("./lib/env");
    ensureSecureKeys(); // Secure key generation

    // Continue with application initialization
    const { getInitializationPromise } = await import("./lib/startup");
    await getInitializationPromise();
  }
}
```

**File System Security:**

- Generated secrets are written to `.env.local` with appropriate file permissions
- No secrets are logged or exposed in error messages
- Temporary variables are cleared after use

**Memory Management:**

- Secrets are loaded into environment variables for application use
- No persistent storage of secrets in application memory beyond environment variables
- Garbage collection handles cleanup of temporary secret generation variables

## Threat Model & Mitigations

### Threats Addressed

1. **Weak Default Secrets**

   - **Risk**: Applications deployed with default or example secrets
   - **Mitigation**: Auto-generation ensures unique, strong secrets for every deployment

2. **Manual Secret Generation Errors**

   - **Risk**: Developers using weak methods like `Math.random()` or predictable patterns
   - **Mitigation**: Cryptographically secure generation using OS entropy

3. **Secret Reuse Across Deployments**

   - **Risk**: Same secrets used across multiple environments or installations
   - **Mitigation**: Each deployment generates its own unique secrets

4. **Configuration Oversight**
   - **Risk**: Forgotten secret configuration causing application failures
   - **Mitigation**: Automatic generation ensures application always has required secrets

### Security Boundaries

**What Auto-Generation Protects:**

- Ensures cryptographically strong secrets
- Eliminates default/weak secret vulnerabilities
- Provides unique secrets per deployment
- Maintains backward compatibility with existing configurations

**What Auto-Generation Does NOT Protect:**

- Secrets exposed through environment variable leaks
- Compromise of the host system or container
- Network-based attacks on the application
- Social engineering or credential theft

## Deployment Security

### Container Environments

**Docker Security Model:**

```yaml
services:
  wolfmanager:
    image: wolfmanager:latest
    volumes:
      - wolfmanager_config:/app/config # Persist auto-generated secrets
    environment:
      - NODE_ENV=production
      # Secrets auto-generated on first startup
```

**Security Benefits:**

- Secrets are generated inside the container, not in the build process
- No secrets baked into Docker images
- .env.local is symlinked into /app/config and this directory is mounted to host
- Each container deployment gets unique secrets

## Security Validation

### Verification Procedures

**Secret Strength Validation:**

```bash
# Check generated secret entropy
cat .env.local | grep NEXTAUTH_SECRET | cut -d'=' -f2 | wc -c  # Should be 64
cat .env.local | grep ENCRYPTION_KEY | cut -d'=' -f2 | wc -c   # Should be 32

# Verify hexadecimal format
cat .env.local | grep -E "^(NEXTAUTH_SECRET|ENCRYPTION_KEY)=[a-f0-9]+$"
```

**Automated Testing:**

```bash
# Run validation scripts from tests directory
node tests/validation/test-auto-generation.js      # Comprehensive test suite
node tests/validation/validate-auto-generation.js  # Manual validation
node tests/validation/test-env-generation.js       # Direct function testing
```

**Uniqueness Testing:**

```bash
# Generate multiple secrets to verify uniqueness
for i in {1..5}; do
  rm -f .env.local
  npm run dev --silent &
  sleep 2
  kill $!
  grep NEXTAUTH_SECRET .env.local
done
```

## Validation Scripts

WolfManager includes comprehensive validation scripts located in [`tests/validation/`](../../tests/validation/) that can be used to verify the auto-generation implementation:

### Available Scripts

1. **[`test-auto-generation.js`](../../tests/validation/test-auto-generation.js)**

   - Comprehensive test suite covering all auto-generation scenarios
   - Tests fresh installation, existing secrets, partial configuration
   - Validates cryptographic strength and uniqueness
   - Generates detailed test results in JSON format

2. **[`validate-auto-generation.js`](../../tests/validation/validate-auto-generation.js)**

   - Manual validation for current implementation
   - Checks secret formats, randomness, and security practices
   - Validates Docker configuration and instrumentation integration
   - Reviews logging security to prevent secret exposure

3. **[`test-env-generation.js`](../../tests/validation/test-env-generation.js)**

   - Direct testing of the `ensureSecureKeys()` function
   - TypeScript compilation and execution validation
   - Environment variable precedence testing

4. **[`validate-toml.js`](../../tests/validation/validate-toml.js)**
   - TOML configuration file validation
   - Syntax checking and structure validation

### Running Validation

```bash
# Run all validation scripts
cd tests/validation

# Comprehensive test suite
node test-auto-generation.js

# Manual validation of current setup
node validate-auto-generation.js

# Direct function testing
node test-env-generation.js

# TOML validation
node validate-toml.js
```

See [`tests/validation/README.md`](../../tests/validation/README.md) for detailed documentation.

## References

- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST SP 800-90A: Random Number Generation](https://csrc.nist.gov/publications/detail/sp/800-90a/rev-1/final)
- [NextAuth.js Security Considerations](https://next-auth.js.org/configuration/options#secret)
- [Auto-Generation Implementation](../../src/lib/env.ts)
- [Validation Scripts Documentation](../../tests/validation/README.md)
