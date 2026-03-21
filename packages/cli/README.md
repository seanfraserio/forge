# @openforge-ai/cli

Command-line tool for managing AI agent infrastructure as code. The Terraform for AI agents.

## Install

**npm** (requires Node.js 20+):
```bash
npm install -g @openforge-ai/cli
```

**npx** (no install, one-off execution):
```bash
npx @openforge-ai/cli validate -c forge.yaml
```

**Homebrew** (macOS/Linux):
```bash
brew tap seanfraserio/tap
brew install forgeai
```

## Quickstart

Create a `forge.yaml` in your project root:

```yaml
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

Then run:

```bash
forgeai validate          # Check config syntax and model compatibility
forgeai diff              # Preview changes against deployed state
forgeai deploy --env dev  # Deploy the agent
```

## Commands

### `forgeai validate`

Validates a `forge.yaml` file: schema structure, model name compatibility with the declared provider, and environment override correctness.

| Flag | Default | Description |
|---|---|---|
| `-c, --config <path>` | `forge.yaml` | Path to config file |

### `forgeai diff`

Compares local config against the last deployed state in `.forge/state.json`. Outputs a colored diff of what would change on deploy.

| Flag | Default | Description |
|---|---|---|
| `-c, --config <path>` | `forge.yaml` | Path to config file |
| `-e, --env <environment>` | `dev` | Target environment |

### `forgeai deploy`

Resolves environment overrides, generates a plan, and applies changes. Writes state to `.forge/state.json` on success. Supports pre/post deploy hooks declared in `forge.yaml`.

| Flag | Default | Description |
|---|---|---|
| `-c, --config <path>` | `forge.yaml` | Path to config file |
| `-e, --env <environment>` | `dev` | Target environment |
| `--auto-approve` | `false` | Skip confirmation prompt |
| `--dry-run` | `false` | Show plan without applying |
| `--allow-hooks` | `false` | Allow pre_deploy/post_deploy hook execution |

### `forgeai rollback`

Displays current deployment state. Rollback to a specific state hash is planned but not yet implemented.

| Flag | Default | Description |
|---|---|---|
| `--target <hash>` | — | Target state hash to roll back to |

## Configuration

See the [root README](../../README.md) for full `forge.yaml` schema documentation, environment overrides, MCP server configuration, and hook definitions.

## Packages

| Package | Description |
|---|---|
| `@openforge-ai/sdk` | TypeScript types and programmatic API |
| `@openforge-ai/adapters` | LLM provider and runtime adapters |

## Links

- [GitHub](https://github.com/seanfraserio/forge)
- [Architecture](../../ARCHITECTURE.md)
- Enterprise features — contact for access

## License

MIT. Enterprise features are licensed under BUSL-1.1.
