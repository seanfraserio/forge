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

## Adapters

Adapters are the bridge between Forge's declarative configuration and the runtime platform where an agent actually executes. When you run `forge deploy`, Forge reads `forge.yaml`, computes the plan, and then hands the resolved config to an adapter that knows how to turn it into a running agent.

Forge ships with two deployment adapters:

**DockerAdapter** -- Builds a Docker image containing a generated HTTP server that wraps the model provider SDK. The agent runs as a container on any Docker host. You control the infrastructure: the image, the network, the registry, the orchestrator. This adapter is the right choice when you need full control over where and how your agents run, when you have existing container infrastructure, or when you want to run agents in air-gapped environments.

**AgentProviderAdapter** -- A generic REST client for hosted agent platforms. Instead of managing containers yourself, you push the agent definition to a platform that handles hosting, scaling, and lifecycle management. The adapter communicates via a standard REST pattern (`POST /agents`, `GET /agents/:id`, etc.) and is designed to work with any platform that follows this convention. As frontier labs like Anthropic, OpenAI, and Google ship hosted agent services, the AgentProviderAdapter provides a generic integration point. Platforms that deviate from the standard pattern can extend the class and override specific methods.

The distinction is architectural: Docker is self-hosted infrastructure, Agent Provider is managed infrastructure. Both produce the same outcome -- a running agent accessible via an endpoint -- but they differ in who manages the runtime.

## State Management

Forge tracks deployed state in `.forge/state.json`. This file records:
- The config hash of the last deployment
- Timestamp of the last deployment
- The environment it was deployed to
- The full resolved config (with secrets redacted)

### What is in .forge/state.json

The state file is a JSON object with four top-level fields:

- **`configHash`** -- A SHA-256 hex digest of the normalized config. Forge computes this by recursively sorting all object keys and hashing the resulting JSON string. This ensures the hash is stable regardless of property insertion order in the YAML file.
- **`lastDeployed`** -- An ISO 8601 timestamp recording when the last deployment completed.
- **`environment`** -- The environment name passed to `--env` (e.g., `dev`, `production`).
- **`config`** -- The full resolved config snapshot after environment overrides have been applied. MCP server `env` values are redacted to `"[REDACTED]"` unless they use `${VAR}` template syntax, which is preserved for accurate diffing.

### How config hashing ensures idempotency

Every `forge deploy` computes the hash of the desired config and compares it against the `configHash` stored in state. If the hashes match, Forge reports "no changes" and exits without side effects. This makes deployments safe to retry and safe to run on every CI push -- duplicate deploys are no-ops.

The hashing is deterministic: rearranging keys in `forge.yaml` without changing values produces the same hash. Changing any value -- even whitespace in a system prompt -- produces a different hash and triggers a redeployment.

### How environments interact with state

Environment overrides are applied before hashing. When you run `forge deploy --env production`, Forge merges the `production` overrides onto the base config, hashes the merged result, and stores that merged config in state. This means the state file always reflects the fully resolved config for the last-deployed environment.

Because state is a single file, deploying to different environments from the same directory overwrites the previous state. In CI this is not a problem because each job runs in an isolated workspace. For local development, be aware that switching between `--env dev` and `--env production` replaces the state each time.

### What rollback actually does

`forge rollback` reads the previous config from `.forge/state.json`, re-runs the plan/apply cycle with that config as the desired state, and writes the result back to state. It does not maintain a history of past deployments -- it restores the single previous snapshot. If you need deeper rollback history, use the enterprise `AuditTrail` module, which maintains an append-only log of every deployment in `.forge/audit.jsonl`.

Add `.forge/` to `.gitignore` -- state is local to each deployment target.

## Environments

Environments let you override config per deployment target (dev, staging, production). Overrides merge on top of the root config using a shallow merge strategy.

## Hooks

Pre-deploy and post-deploy hooks run shell commands. Use them for:
- Running tests before deployment
- Sending notifications after deployment
- Triggering downstream pipelines

## The Trilogy: Forge, Bastion, and Lantern

Forge is one piece of a three-project system designed for production AI agent infrastructure.

**Forge** defines and deploys agents. It is the control plane: you declare what an agent is (model, tools, memory, prompt) and Forge makes it real. Think of it as Terraform for AI agents.

**Bastion** is an API proxy that sits between your agents and the LLM providers. Every API call from every agent flows through Bastion, giving you a single choke point for authentication, rate limiting, cost tracking, and request/response logging. Instead of distributing API keys to each agent, you configure a single key in Bastion and point your agents at it via `ANTHROPIC_BASE_URL` or `OPENAI_BASE_URL`. This is particularly powerful when combined with Forge's Docker adapter, where you can place all agent containers on the same Docker network as Bastion and route traffic internally.

**Lantern** is the observability layer. It consumes the request logs produced by Bastion and provides dashboards for token usage, latency, cost per agent, error rates, and traffic patterns across all your deployed agents.

Together they form a complete lifecycle: Forge deploys agents, Bastion mediates their API access, and Lantern gives you visibility into what they are doing. Each project works independently, but they are designed to complement each other. A typical production setup looks like:

1. Define agents in `forge.yaml` and deploy with `forge deploy`
2. Route all agent traffic through Bastion for centralized auth and logging
3. Monitor agent behavior and costs in Lantern

This separation of concerns means you can adopt them incrementally. Start with Forge alone for agent-as-code. Add Bastion when you need centralized API management. Add Lantern when you need observability.
