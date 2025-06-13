# Quick Start: Automatic Secret Generation

WolfManager automatically generates secure secrets on first startup. This guide covers the essentials for getting started quickly.

## TL;DR - Just Run It

```bash
# Docker Compose (recommended)
docker-compose up -d

# Or Docker run
docker run -d -p 3000:3000 -v wolfmanager_config:/app/config wolfmanager:latest

# Or local development
npm run dev
```

**That's it!** WolfManager will automatically generate secure secrets and be ready to use.

## What Gets Auto-Generated

| Secret | Purpose | Length | Security |
|--------|---------|--------|----------|
| `NEXTAUTH_SECRET` | NextAuth.js session encryption | 64 chars | 256 bits entropy |
| `ENCRYPTION_KEY` | Sensitive data encryption | 32 chars | 128 bits entropy |

## Quick Verification

Check that secrets were generated:

```bash
# Docker
docker logs wolfmanager | grep "Generated secure keys"

# Local development
cat .env.local | grep -E "(NEXTAUTH_SECRET|ENCRYPTION_KEY)"
```

Expected output:
```
[ENV] Generated secure keys: NEXTAUTH_SECRET, ENCRYPTION_KEY
```

## Common Scenarios

### First Time Setup
```bash
# Clean installation - secrets auto-generated
docker run -d -p 3000:3000 wolfmanager:latest
# ✅ Secrets automatically created
```

### With Persistence
```bash
# Recommended: persist secrets across container restarts
docker run -d -p 3000:3000 -v wolfmanager_config:/app/config wolfmanager:latest
# ✅ Secrets generated once, reused on restart
```

### Manual Secrets (Optional)
```bash
# If you prefer to provide your own secrets
docker run -d -p 3000:3000 \
  -e NEXTAUTH_SECRET="your-64-character-secret-here" \
  -e ENCRYPTION_KEY="your-32-character-key-here" \
  wolfmanager:latest
# ✅ Your secrets used, no auto-generation
```

### Development
```bash
# Local development with auto-generation
npm run dev
# ✅ Secrets generated in .env.local file
```

## Troubleshooting

### Secrets Not Generated
```bash
# Check container logs
docker logs wolfmanager

# Look for these messages:
# ✅ "[ENV] Generated secure keys: NEXTAUTH_SECRET, ENCRYPTION_KEY"
# ✅ "[ENV] Secure keys already available in environment"
```

### Force Regeneration
```bash
# Remove existing secrets and restart
docker exec wolfmanager rm -f /app/.env.local
docker restart wolfmanager

# Or for local development
rm .env.local
npm run dev
```

### Permission Issues
```bash
# Ensure proper volume mounts
docker run -v wolfmanager_config:/app/config wolfmanager:latest

# Check volume permissions
docker exec wolfmanager ls -la /app/.env.local
```

## Security Notes

- **Cryptographically Secure**: Uses Node.js `crypto.randomBytes()`
- **Unique Per Deployment**: Each installation gets unique secrets
- **No Default Values**: Eliminates shared secret vulnerabilities
- **Backward Compatible**: Existing configurations continue to work

## When to Use Manual Secrets

Consider providing your own secrets when:
- Using external secret management (HashiCorp Vault, AWS Secrets Manager)
- Enterprise compliance requires specific key generation procedures
- Migrating from existing installations with established secrets
- Multi-environment deployments requiring coordinated secret management

## Next Steps

1. **Access WolfManager**: Navigate to `http://localhost:3000`
2. **Complete Setup**: Follow the first-time setup wizard
3. **Add Users**: Create accounts for game streaming users
4. **Configure Wolf**: Connect to your Wolf game streaming instance

## More Information

- [Complete Documentation](README.md)
- [Security Details](security-auto-generation.md)
- [Development Guide](development.md)
- [Docker Setup](../build/README.md)