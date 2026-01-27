# Cold Caller App - Agent Guidelines

This directory contains documentation to help AI agents understand and work with this codebase effectively.

## Quick Start

```bash
# Development
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Documentation Index

- [PROJECT.md](./PROJECT.md) - Project overview, architecture, and technologies
- [CONVENTIONS.md](./CONVENTIONS.md) - Coding conventions and patterns
- [CODEFLOWS.md](./CODEFLOWS.md) - Key data flows and business logic
- [API.md](./API.md) - API endpoints reference
- [FEATURES.md](./FEATURES.md) - Custom features (virtual regions, preferred callers, implants)
- [RULES.md](./RULES.md) - **IMPORTANT**: Rules for agents to follow

## Key Principles

1. **Language**: The UI has Bulgarian and English translations. Most user-facing text uses the translation system (`useTranslation` hook).
2. **Database**: SQLite with `better-sqlite3`. Migrations are handled in `src/lib/db.ts`.
3. **Authentication**: JWT-based via HTTP-only cookies. See `src/lib/auth.ts`.
4. **Styling**: Tailwind CSS v4 with a dark theme (slate color palette).
5. **Documentation**: Always update this `.agent/` directory when making significant changes.
