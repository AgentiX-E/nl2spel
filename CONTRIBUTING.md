# Contributing to NL2SpEL

## Branch Strategy

- `master` — Stable branch, target for all PR merges
- `feat/*` — Feature development branches
- `fix/*` — Bug fix branches
- `docs/*` — Documentation update branches

## Development Environment

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type check
pnpm lint

# Format code
pnpm format

# Format check
pnpm format:check
```

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add PatternMatcher with built-in patterns
fix: resolve Chinese number parser overflow
docs: update API documentation
test: add 160+ pattern matching tests
chore: configure CI workflow
refactor: extract ValidationPipeline to separate module
```

## Code Quality Requirements

### Testing
- New features must include tests
- Coverage must not drop (target ≥ 95%)
- All tests must pass on both CI and local (local=CI zero drift)
- Synthetic data or mock-only tests are prohibited

### Pre-commit Gates
```bash
# Install husky hooks
pnpm install

# Automatically runs before commit:
# - lint (type check + ESLint)
# - format:check (format check)
# - test (run tests, only in packages with changed files)
```

### CI Requirements
- Zero warnings, zero errors on CI
- Single ci.yml workflow (combined lint/test/coverage/benchmark)
- Coverage reports auto-published to GitHub Pages
- TypeDoc API docs auto-published to GitHub Pages

## Performance Requirements

- New pattern latency overhead ≤ 0.1ms
- New template latency overhead ≤ 1ms
- New validation check latency overhead ≤ 2ms

## Package Structure

This project uses a pnpm workspace monorepo:

```
packages/
├── nl2spel/            # Core engine (zero external deps)
├── nl2spel-openai/     # LLM API Provider
└── nl2spel-webllm/     # Browser-local LLM Provider
```

## Release Process

1. Update `CHANGELOG.md`
2. Update version numbers (`packages/*/package.json`)
3. Submit PR to `master`
4. Merge after CI passes
5. Manually trigger `npm-publish` workflow to release

## Internal Documentation

Non-user-facing internal agent documentation (e.g., `RULE_VERIFICATION.md`, `AUDIT_REPORT.md`) is gitignored by default and must not be committed to the repository.

## License

MIT © 2025 Agentix-E
