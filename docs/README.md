# WolfManager Documentation

## Overview

This directory contains comprehensive documentation for the WolfManager project.

## Directory Structure

```
docs/
├── README.md               # This file
├── features/              # Feature-specific documentation
│   ├── first-time-setup.md
│   └── user-management.md
├── technical/            # Technical documentation
│   ├── authentication-architecture.md     # Authentication & session management
│   ├── authentication-quick-reference.md  # Authentication quick reference
│   ├── logging/
│   │   ├── index.md     # Overview of logging system
│   │   ├── setup.md     # Logger setup and configuration
│   │   └── standards.md # Logging standards and best practices
│   └── architecture.md
└── guides/              # Developer and user guides
    ├── development.md
    └── deployment.md
```

## Documentation Types

### Features

Detailed documentation for specific features and functionality. Each feature document includes:

- Feature overview
- Implementation details
- Usage examples
- Configuration options

### Technical

Technical documentation covering system architecture, internal components, and development standards:

- **Authentication Architecture** - Comprehensive guide to NextAuth.js implementation, session management, middleware protection, and cross-host cookie configuration
- **Authentication Quick Reference** - Quick reference for common authentication patterns, troubleshooting, and configuration
- Architecture overview
- Component documentation
- Standards and best practices
- Configuration details

### Guides

Step-by-step guides for common tasks:

- Development setup
- Deployment procedures
- Troubleshooting guides
- Best practices

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
