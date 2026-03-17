# How-to: Manage Environments

Environments let you deploy the same agent with different settings for each stage of your workflow -- development, staging, and production. Each environment overrides specific fields from the root configuration, so you declare shared settings once and vary only what needs to change.

## Define environments

Add an `environments` section to your `forge.yaml`. Each key is an environment name, and its value contains the fields to override:

```yaml
version: "1"

agent:
  name: my-agent
  description: "A production-grade assistant"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.5
  max_tokens: 4096

system_prompt:
  file: ./prompts/system.md

environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
      temperature: 0.7
      max_tokens: 1024
  staging:
    model:
      temperature: 0.3
  production:
    model:
      temperature: 0.1
      max_tokens: 8192
```

When you deploy to an environment, Forge merges its overrides on top of the root config. Fields not listed in the environment block keep their root values. In the example above, deploying to `staging` uses the root model name (`claude-sonnet-4-5-20251001`) with a temperature of `0.3`.

If you deploy without specifying an environment, Forge defaults to `dev`. If no `dev` environment is defined, the root config is used as-is.

## Deploy to a specific environment

Use the `--env` flag (or its short form `-e`) to target an environment:

```bash
forge deploy --env production
```

Forge resolves the environment overrides and displays the effective configuration:

```
→ Agent: my-agent | Environment: production | Model: anthropic/claude-sonnet-4-5-20251001
```

Each environment maintains its own state. Deploying to `dev` and `production` creates (or updates) separate `.forge/state.json` entries, so changes to one environment never affect another.

## Override model settings per environment

The most common use of environments is varying model settings. Use a cheaper, faster model for development and a more capable model with stricter parameters for production:

```yaml
environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
      temperature: 0.7
      max_tokens: 1024
  production:
    model:
      name: claude-sonnet-4-5-20251001
      temperature: 0.1
      max_tokens: 8192
```

You can override any combination of model fields: `provider`, `name`, `temperature`, and `max_tokens`. Only the fields you specify are overridden; the rest inherit from the root `model` section.

To use a different provider entirely in an environment (for example, testing with a local model):

```yaml
environments:
  local:
    model:
      provider: ollama
      name: llama3
      temperature: 0.7
      max_tokens: 2048
```

## Override tools per environment

To give your agent different tools in different environments, override the `tools` section. Note that tool overrides replace the entire `tools` block rather than merging with it:

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]

environments:
  production:
    tools:
      mcp_servers:
        - name: filesystem
          command: npx
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/var/data"]
        - name: database
          command: npx
          args: ["-y", "@modelcontextprotocol/server-postgres"]
          env:
            DATABASE_URL: "${PROD_DATABASE_URL}"
```

In this example, the `dev` environment uses the root tools config (filesystem with `./data`). The `production` environment replaces it entirely with a different filesystem path and adds a database server.

## Override memory per environment

To configure different memory strategies per environment, override the `memory` section:

```yaml
memory:
  type: in-context

environments:
  production:
    memory:
      type: vector
      provider: chroma
      collection: prod-memory
```

This keeps development simple (in-context memory, no external dependencies) while production uses persistent vector storage.

## View environment-specific diff

To preview what would change in a specific environment without deploying, use `forge diff` with the `--env` flag:

```bash
forge diff --env production
```

This compares your current `forge.yaml` (with production overrides resolved) against the last state deployed to the `production` environment. If production has never been deployed, every resource appears as a CREATE.

Use this to verify your environment overrides produce the expected configuration before deploying.

## Environment promotion strategy

A common workflow promotes changes through environments in order: `dev` first, then `staging`, then `production`. Forge does not enforce a promotion order, but you can adopt one as a team convention:

1. Make changes to `forge.yaml`.
2. Deploy to dev and test:
   ```bash
   forge deploy --env dev
   ```
3. When satisfied, deploy to staging:
   ```bash
   forge deploy --env staging
   ```
4. After staging validation, deploy to production:
   ```bash
   forge deploy --env production
   ```

Because `forge.yaml` is a single source of truth checked into version control, every environment deployment uses the same base config. Differences between environments come only from the overrides you explicitly define.

To enforce promotion order in a team setting, use branch protection rules in your version control system and require PR reviews before merging changes that will be deployed to production.

## CI/CD per environment

Forge commands are designed to run in CI/CD pipelines. Use `--auto-approve` to skip the confirmation prompt in automated environments:

```bash
forge deploy --env production --auto-approve
```

Use `--dry-run` to validate what would change without applying, suitable for PR checks:

```bash
forge deploy --env production --dry-run
```

A typical pipeline structure:

- **On pull request**: run `forge validate` and `forge deploy --dry-run --env production` to catch config errors and preview changes.
- **On merge to main**: run `forge deploy --env staging --auto-approve`.
- **On release tag**: run `forge deploy --env production --auto-approve`.

For a complete CI/CD setup, see the [Enterprise Integration Guide](../enterprise-integration-guide.md).
