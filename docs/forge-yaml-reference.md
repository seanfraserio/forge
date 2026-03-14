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
