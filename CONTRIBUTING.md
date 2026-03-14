# Contributing to Forge

Thank you for your interest in contributing to Forge! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Git

### Getting Started

```bash
git clone https://github.com/your-org/forge.git
cd forge
pnpm install
pnpm build
pnpm test
```

### Monorepo Structure

| Package | Path | Description |
|---|---|---|
| `@forge-ai/cli` | `packages/cli` | CLI binary — deploy, diff, rollback, validate commands |
| `@forge-ai/sdk` | `packages/sdk` | TypeScript types and programmatic API |
| `@forge-ai/adapters` | `packages/adapters` | Provider integrations (Anthropic, OpenAI, Ollama) |
| `@forge-ai/enterprise` | `packages/enterprise` | Enterprise features (BUSL-1.1 licensed) |

## Making Changes

### Before You Start

1. Check existing [issues](https://github.com/your-org/forge/issues) to avoid duplicate work.
2. For significant changes, open an issue first to discuss the approach.
3. Fork the repository and create a feature branch from `main`.

### Where to Put Things

- **New provider adapters** go in `packages/adapters/src/<provider>.ts` and are re-exported from `packages/adapters/src/index.ts`.
- **New CLI commands** go in `packages/cli/src/commands/<command>.ts` and are registered in `packages/cli/src/index.ts`.
- **Shared types** belong in `packages/sdk/src/types.ts`.
- **Tests** are co-located as `*.test.ts` next to the file they test.

### Code Style

- TypeScript strict mode — no `any` shortcuts.
- ESLint and Prettier are configured. Run `pnpm lint` to check.
- Keep functions small and focused. Prefer clarity over cleverness.

### Before Submitting

Run the full check suite:

```bash
pnpm build && pnpm test && pnpm typecheck
```

All three must pass before submitting a PR.

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add bedrock adapter`
- `fix: handle empty forge.yaml gracefully`
- `docs: add rollback examples`
- `test: add planner diff edge cases`

### Pull Requests

1. Keep PRs focused — one feature or fix per PR.
2. Include a clear description of what changed and why.
3. Add tests for new functionality.
4. Update documentation if the public API changes.
5. Ensure CI passes before requesting review.

## OSS vs Enterprise Boundary

The open-source core (MIT) includes all functionality that individual developers and small teams need. Enterprise features (BUSL-1.1) cover governance, compliance, and team management needs.

**Enterprise features** (`packages/enterprise/`) are licensed under BUSL-1.1. If you're unsure whether a contribution belongs in OSS or enterprise, open an issue to discuss.

Contributions to enterprise features are welcome but will be licensed under BUSL-1.1.

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests.
- Include reproduction steps, expected behavior, and actual behavior.
- For security vulnerabilities, please email security@forge-ai.dev instead of opening a public issue.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this standard.

## License

By contributing to Forge, you agree that your contributions will be licensed under the MIT License (for core packages) or BUSL-1.1 (for enterprise packages), matching the license of the package you're contributing to.
