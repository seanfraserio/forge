# Forge — Agent Infrastructure as Code

Forge lets teams define AI agents, their tools, memory, model bindings, and MCP server connections as versioned code. A single `forge.yaml` describes an agent completely. `forge deploy` applies it idempotently. `forge diff` shows what would change.

## Package Map

- `packages/cli` — `@forge-ai/cli`: CLI binary with deploy, diff, rollback, validate commands. Contains the Zod schema, diff engine, and state manager.
- `packages/sdk` — `@forge-ai/sdk`: TypeScript types and programmatic API for Forge operations.
- `packages/adapters` — `@forge-ai/adapters`: Provider integrations (Anthropic, OpenAI, Ollama).
- `packages/enterprise` — `@forge-ai/enterprise`: BUSL-1.1 licensed enterprise features (audit trail, RBAC, env promotion, secrets).

## Key Architectural Decisions

- **Idempotency model**: Every config is SHA-256 hashed. `forge deploy` compares the desired config hash against `.forge/state.json`. If hashes match, it's a no-op. This guarantees convergent behavior.
- **Plan/Apply cycle**: Borrowed from Terraform. `plan()` computes a diff between desired and actual state. `apply()` executes the plan. `--dry-run` shows the plan without applying.
- **State is local**: `.forge/state.json` is not committed to git. Each deployment target maintains its own state. This avoids state conflicts in team settings.
- **Environment overrides**: Shallow merge on top of root config. This keeps the mental model simple — environments are just patches.
- **Zod for schema validation**: The forge.yaml schema is defined as Zod schemas, providing both runtime validation and TypeScript type inference.

## OSS / Enterprise Boundary

OSS (MIT) includes all core functionality: config parsing, validation, deploy, diff, rollback, multi-environment overrides, MCP server management. Enterprise (BUSL-1.1) adds governance features that large teams need: audit trails, RBAC, gated promotions, and secrets management. The boundary is drawn at features that only matter when multiple people or compliance requirements are involved.

## Contribution Conventions

- New provider adapters go in `packages/adapters/src/<provider>.ts` and are re-exported from `packages/adapters/src/index.ts`.
- New CLI commands go in `packages/cli/src/commands/<command>.ts` and are registered in `packages/cli/src/index.ts`.
- All types shared across packages belong in `packages/sdk/src/types.ts`.
- Tests are co-located as `*.test.ts` next to the file they test.

## Before Committing

```bash
pnpm build && pnpm test && pnpm typecheck
```
