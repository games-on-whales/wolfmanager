# WolfManager Documentation

## Overview

This directory contains comprehensive documentation for the WolfManager project.

## Directory Structure

```
docs/
├── README.md                           # This file
├── quick-start-auto-generation.md     # Quick start guide for automatic secret generation
├── features/                          # Feature-specific documentation (for future features)
├── guides/                            # Developer and user guides
│   └── development.md                 # Development workflow and environment setup
├── images/                            # Documentation images and screenshots
│   ├── clients.png
│   ├── settings.png
│   ├── systemlogs.png
│   └── user_management.png
├── security/                          # Security documentation
│   └── auto-secret-generation.md     # Comprehensive security guide for auto-generation
└── technical/                        # Technical documentation
    ├── authentication-architecture.md      # Authentication & session management
    ├── authentication-quick-reference.md   # Authentication quick reference
    ├── database-architecture.md            # Database design and multi-backend support
    ├── database-quick-reference.md         # Database operations quick reference
    └── pairing-functions-consolidation-plan.md  # Technical planning document
```

## Documentation Types

### Quick Start

- **`quick-start-auto-generation.md`** - Quick start guide for automatic secret generation

### Features

Reserved for future feature-specific documentation. Each feature document will include:

- Feature overview
- Implementation details
- Usage examples
- Configuration options

### Technical

Technical documentation covering system architecture, internal components, and development standards:

- **`authentication-architecture.md`** - Comprehensive guide to NextAuth.js implementation, session management, middleware protection, and cross-host cookie configuration
- **`authentication-quick-reference.md`** - Quick reference for common authentication patterns, troubleshooting, and configuration
- **`database-architecture.md`** - Database design, multi-backend support, schema relationships, and migration system
- **`database-quick-reference.md`** - Practical examples for database operations, helper functions, and troubleshooting
- **`pairing-functions-consolidation-plan.md`** - Technical planning document for device pairing functionality

### Security

Security-focused documentation covering cryptographic implementations and security best practices:

- **`security/auto-secret-generation.md`** - Comprehensive security documentation for the auto-generation feature, including threat model, cryptographic implementation, deployment security, and compliance considerations

### Guides

Step-by-step guides for common tasks:

- **`guides/development.md`** - Development workflow and environment setup
- Deployment procedures (planned)
- Troubleshooting guides (planned)
- Best practices (planned)

### Images

Screenshots and diagrams supporting the documentation:

- Application interface screenshots
- Architecture diagrams
- User workflow examples

## Contributing

When adding new documentation:

1. Place it in the appropriate directory based on content type
2. Update this README if adding new sections
3. Follow the documentation standards
4. Include practical examples where applicable

## Standards

All documentation should:

1. Be written in Markdown
2. Include a clear title and description
3. Use appropriate headings and sections
4. Include code examples where relevant
5. Be kept up to date with code changes
