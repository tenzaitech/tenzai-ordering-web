# ESLint Tooling Setup

> **Note**: Lint gate is temporarily optional. Next.js lint tooling is unstable on Windows for this repo. Use `npm run quality:check:full` to include lint, or `npm run lint` standalone.

## Why ESLint Direct (Not `next lint`)

The `next lint` command is broken on Windows in Next.js 16.x, consistently failing with:
```
Invalid project directory provided, no such directory: <repo>\lint
```

This appears to be a CLI parsing issue. To ensure reliable linting across all platforms, we run ESLint directly.

## Configuration

- **`.eslintrc.cjs`** - Minimal config extending `next/core-web-vitals` (same rules as `next lint`)
- **ESLint version**: ^8.57.x (pinned in devDependencies)

## Commands

```bash
# Run linting (used by CI and quality:check)
npm run lint

# Full quality check (typecheck + lint + build)
npm run quality:check

# Legacy next lint (kept for reference, broken on Windows)
npm run lint:next
```

## Linted Directories

The lint script targets:
- `app/` - Next.js App Router pages and API routes
- `lib/` - Shared utilities and helpers
- `components/` - React components
- `scripts/` - Build and verification scripts
- `types/` - TypeScript type definitions

## Ignored Patterns

- `.next/` - Build output
- `out/` - Static export
- `node_modules/` - Dependencies
- `*.config.js`, `*.config.cjs` - Config files
