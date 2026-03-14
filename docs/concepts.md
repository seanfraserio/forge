# Core Concepts

## Agent as Code

Forge treats AI agent configuration as infrastructure. Like Terraform manages cloud resources, Forge manages agent definitions. Every property of an agent — its model, tools, memory, and prompt — is declared in a version-controlled `forge.yaml` file.

## Idempotency

Every `forge deploy` is idempotent. Running it twice with the same config produces the same result. Forge achieves this by:

1. Hashing the normalized config (SHA-256)
2. Comparing the hash against `.forge/state.json`
3. Only applying changes when the hash differs

## Plan / Apply Cycle

Inspired by Terraform:

1. **Plan** — Forge reads `forge.yaml`, loads current state, and computes a diff
2. **Review** — The diff is shown to the user for confirmation
3. **Apply** — Changes are applied and state is written

Use `forge diff` to preview changes without applying. Use `--dry-run` with `forge deploy` for the same effect.

## State Management

Forge tracks deployed state in `.forge/state.json`. This file records:
- The config hash of the last deployment
- Timestamp of the last deployment
- The environment it was deployed to
- The full resolved config

Add `.forge/` to `.gitignore` — state is local to each deployment target.

## Environments

Environments let you override config per deployment target (dev, staging, production). Overrides merge on top of the root config using a shallow merge strategy.

## Hooks

Pre-deploy and post-deploy hooks run shell commands. Use them for:
- Running tests before deployment
- Sending notifications after deployment
- Triggering downstream pipelines
