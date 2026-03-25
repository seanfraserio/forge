# forge.yaml Reference

Complete reference for the Forge configuration file.

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"1"` | Yes | Schema version |
| `agent` | object | Yes | Agent identity |
| `model` | object | Yes | Model configuration |
| `system_prompt` | object | No | System prompt (file or inline) |
| `tools` | object | No | Tool and MCP server config |
| `memory` | object | No | Memory configuration |
| `environments` | map | No | Per-environment overrides |
| `hooks` | object | No | Pre/post deploy hooks |
| `deploy` | object | No | Deployment adapter configuration |

## agent

```yaml
agent:
  name: my-agent          # Required. Lowercase, alphanumeric, hyphens only.
  description: "..."      # Optional.
```

## model

```yaml
model:
  provider: anthropic     # anthropic | openai | ollama | bedrock
  name: claude-sonnet-4-5-20251001
  temperature: 0.7        # 0.0 – 2.0
  max_tokens: 4096        # Positive integer
```

## system_prompt

Provide either `file` (path to .md file) or `inline` (string), not both.

```yaml
system_prompt:
  file: ./prompts/system.md
```

## tools.mcp_servers

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
      env:
        API_KEY: "${API_KEY}"   # Environment variable injection
```

## memory

```yaml
memory:
  type: vector              # none | in-context | vector
  provider: chroma          # Required when type is vector
  collection: my-memory
```

## environments

Override any top-level field per environment:

```yaml
environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
  production:
    model:
      temperature: 0.1
```

## hooks

```yaml
hooks:
  pre_deploy:
    - run: "pnpm test"
  post_deploy:
    - run: "echo 'Done'"
```

> **Security: Hook Trust Model**
>
> Hook `run` commands execute arbitrary shell commands via `/bin/sh -c`. The **forge.yaml author is the trust boundary** — anyone who can modify `forge.yaml` can execute arbitrary code on the deployer's machine. Forge requires the `--allow-hooks` flag as an opt-in gate before executing any hooks. Without this flag, hooks are displayed but skipped. Always review `forge.yaml` from untrusted sources before running `forge deploy --allow-hooks`.

## deploy

Configures which deployment adapter Forge uses and how it connects to the target platform.

```yaml
deploy:
  adapter: docker
  registry: "us-central1-docker.pkg.dev/my-project/agents"
  runtime: "node:20-alpine"
  push: true
  port: 3000
  network: "my-network"
  env_vars:
    ANTHROPIC_BASE_URL: "http://bastion:4000"
```

```yaml
deploy:
  adapter: agent-provider
  endpoint: "https://api.openclaw.dev"
  api_key: "${AGENT_PROVIDER_API_KEY}"
  platform_name: "OpenClaw"
  auth_header: "Authorization"
  auth_scheme: "Bearer"
  timeout_ms: 30000
```

### Common fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `adapter` | `"docker"` \| `"agent-provider"` | Yes | -- | Which deployment adapter to use. |

### Docker adapter fields

These fields apply when `adapter` is `docker`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `registry` | `string` | No | `""` | Docker registry URL (e.g., `docker.io/myorg`, `us-central1-docker.pkg.dev/project/repo`). If empty, images are built locally only. |
| `runtime` | `string` | No | `"node:20-alpine"` | Base Docker image for the agent container. |
| `push` | `boolean` | No | `false` | Whether to push the built image to the registry after building. Requires `registry` to be set. |
| `port` | `integer` | No | `3000` | Port the agent HTTP server listens on inside the container. Exposed via `docker run -p`. |
| `network` | `string` | No | -- | Docker network to attach the container to. Useful when running alongside other containers (e.g., Bastion). |
| `env_vars` | `map<string, string>` | No | `{}` | Environment variables injected into the container at runtime via `-e` flags. Supports `${VAR}` syntax for referencing shell environment variables. |

### Agent Provider adapter fields

These fields apply when `adapter` is `agent-provider`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `endpoint` | `string` | Yes | -- | The hosted agent platform's REST API base URL. Trailing slashes are stripped. |
| `api_key` | `string` | No | `${AGENT_PROVIDER_API_KEY}` | API key for authentication. Falls back to the `AGENT_PROVIDER_API_KEY` environment variable if not set. |
| `platform_name` | `string` | No | `"Agent Provider"` | Human-readable name of the platform. Used in error messages. |
| `auth_header` | `string` | No | `"Authorization"` | HTTP header name used for authentication. |
| `auth_scheme` | `string` | No | `"Bearer"` | Authentication scheme prepended to the API key in the auth header (e.g., `Bearer sk-...`). |
| `timeout_ms` | `integer` | No | `30000` | Timeout in milliseconds for API calls to the agent platform. |
