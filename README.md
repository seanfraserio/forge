# Forge — Agent Infrastructure as Code

Define, deploy, and manage AI agents as versioned code. The Terraform for AI agents.

## The Problem

AI agents today are configured through UIs, scattered scripts, and undocumented tribal knowledge. When something breaks at 2am, nobody knows what changed. Forge fixes this by treating agent configuration as infrastructure: declared in code, validated before deploy, diffed against live state, and rolled back when needed.

## Install

```bash
npm install -g @forge-ai/cli
```

## Quickstart

```yaml
# forge.yaml
version: "1"

agent:
  name: support-triage
  description: "Routes support tickets"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.3
  max_tokens: 2048

system_prompt:
  inline: "You classify support tickets by urgency and route them."

memory:
  type: none
```

```bash
forge validate          # Check config syntax
forge diff              # Preview changes
forge deploy --env dev  # Deploy the agent
```

## Core Concepts

- **Agent as Code** — Every agent property lives in a `forge.yaml` file under version control.
- **Idempotent deploys** — Running `forge deploy` twice with the same config is a no-op.
- **Plan/Apply cycle** — Preview changes with `forge diff`, then apply with `forge deploy`.
- **Environment overrides** — Define dev, staging, and production variants in one file.
- **MCP server management** — Declare MCP tool servers alongside your agent config.

## OSS vs Enterprise

| Feature | OSS (MIT) | Enterprise (BUSL-1.1) |
|---|---|---|
| Config parsing + validation | ✓ | ✓ |
| Deploy / diff / rollback | ✓ | ✓ |
| Multi-environment overrides | ✓ | ✓ |
| MCP server management | ✓ | ✓ |
| Audit trail | — | ✓ |
| RBAC on deployments | — | ✓ |
| Gated environment promotion | — | ✓ |
| Secrets manager integration | — | ✓ |
| SSO / SAML | — | ✓ |

## Self-Hosting

Forge is a CLI tool — no server required. See [docs/getting-started.md](docs/getting-started.md) for setup instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `pnpm build && pnpm test && pnpm typecheck` before submitting a PR
4. Open a pull request against `main`

See [ARCHITECTURE.md](ARCHITECTURE.md) for architecture and conventions.

## License

MIT — see [LICENSE](LICENSE). Enterprise features are licensed under BUSL-1.1.
