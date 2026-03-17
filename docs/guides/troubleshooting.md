# Troubleshooting

Solutions for common errors encountered when using Forge.

---

## Validation errors

These errors appear when running `forge validate` or `forge deploy`.

### Missing required fields

**Error:** `Required at "version"` / `Required at "agent.name"` / `Required at "model.provider"`

The `forge.yaml` file is missing a required top-level field. Every config file must include at minimum:

```yaml
version: "1"

agent:
  name: my-agent

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
```

If you see `Required at "agent.name"`, make sure the `agent` block exists and includes a `name` field. The name must be lowercase, alphanumeric, and may contain hyphens.

### Invalid model provider

**Error:** `Invalid enum value. Expected 'anthropic' | 'openai' | 'ollama' | 'bedrock', received '...'`

The `model.provider` field only accepts one of: `anthropic`, `openai`, `ollama`, `bedrock`. Check for typos.

```yaml
# Wrong
model:
  provider: claude

# Correct
model:
  provider: anthropic
```

### Invalid temperature range

**Error:** `Number must be less than or equal to 2` / `Number must be greater than or equal to 0`

The `model.temperature` field must be between `0.0` and `2.0` (inclusive).

```yaml
# Wrong
model:
  temperature: 5.0

# Correct
model:
  temperature: 0.7
```

### Malformed YAML

**Error:** `Failed to parse YAML` or YAML parser errors with line numbers

Check for common YAML syntax issues:
- Tabs instead of spaces (YAML requires spaces for indentation)
- Missing colons after keys
- Unquoted strings that contain special characters (`:`, `#`, `{`, `}`)
- Incorrect indentation nesting

To validate YAML syntax separately from Forge schema validation:

```bash
# Use a YAML linter
npx yaml-lint forge.yaml
```

---

## Deployment errors

### "No changes detected"

**Message:** `No changes to apply`

This is not an error. Forge compares the SHA-256 hash of your current config against the hash stored in `.forge/state.json`. If they match, there is nothing to deploy.

If you want to force a redeployment with the same config, delete the state file:

```bash
rm -rf .forge/
forge deploy --env dev
```

### State file corrupted

**Symptoms:** `forge deploy` or `forge diff` crashes with a JSON parse error, or reports unexpected state.

Delete the `.forge/` directory and redeploy. State is reconstructed on the next deployment:

```bash
rm -rf .forge/
forge deploy --env dev
```

The `.forge/` directory contains only local deployment state. Deleting it does not affect running agents or external systems.

### Environment not found

**Message:** Forge deploys but does not apply the overrides you expected.

If you pass `--env staging` but there is no `staging` key under `environments` in `forge.yaml`, Forge silently uses the base config without overrides. Verify that the environment name matches exactly:

```yaml
environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
  staging:         # Must match --env staging exactly
    model:
      temperature: 0.3
  production:
    model:
      temperature: 0.1
```

---

## MCP server errors

### Command not found

**Error:** `spawn npx ENOENT` or `command not found: npx`

The MCP server `command` field specifies a binary that must be available on `PATH`. Common fixes:

- Install Node.js 20+ (which includes `npx`)
- Use the full path to the binary: `/usr/local/bin/npx`
- Verify the package name is correct in `args`

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
```

If the package does not exist on npm, `npx -y` downloads and fails. Check the package name at [npmjs.com](https://www.npmjs.com/).

### Environment variable not set

**Error:** The MCP server starts but fails to authenticate with an external service.

MCP server `env` values that use `${VAR}` syntax are resolved from the shell environment at deploy time. If the variable is not set, the server receives an empty string.

```yaml
tools:
  mcp_servers:
    - name: github
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"   # Must be set in your shell
```

Verify the variable is set:

```bash
echo $GITHUB_TOKEN
```

If it is empty, export it before running `forge deploy`:

```bash
export GITHUB_TOKEN="ghp_..."
forge deploy --env dev
```

---

## API key errors

### Missing API key

**Error:** `401 Unauthorized` or `Authentication error` from the model provider.

Each provider requires a specific environment variable:

| Provider | Environment Variable |
|----------|---------------------|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_API_KEY` or `GOOGLE_CLOUD_PROJECT` |
| `ollama` | None required |

Set the variable before deploying:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
forge deploy --env dev
```

In CI, add the key as a secret (see [CI/CD Integration](./ci-cd.md)).

### Invalid key format

**Error:** `Invalid API key` or `Malformed authentication credentials`

Anthropic API keys start with `sk-ant-`. OpenAI keys start with `sk-`. Google API keys start with `AIza`. If your key does not match the expected prefix, it may have been copied incorrectly or rotated.

Regenerate the key from your provider's dashboard:
- Anthropic: [console.anthropic.com](https://console.anthropic.com/)
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Google: [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

---

## State management

### Inspecting state

To see the current deployed state, read `.forge/state.json`:

```bash
cat .forge/state.json | jq .
```

The file contains:

| Field | Description |
|-------|-------------|
| `configHash` | SHA-256 hash of the deployed config |
| `lastDeployed` | ISO 8601 timestamp of the last deployment |
| `environment` | The environment that was deployed |
| `agentName` | Name of the deployed agent |
| `config` | Full resolved config snapshot (with secrets redacted) |

### Resetting state

To reset Forge to a clean state, delete the `.forge/` directory:

```bash
rm -rf .forge/
```

The next `forge deploy` treats the deployment as a fresh create. This does not affect running agents or external services.

### State conflicts between environments

Each `forge deploy --env <name>` writes to the same `.forge/state.json` file. If you deploy to `dev` and then immediately deploy to `production`, the state file reflects only the production deployment. A subsequent `forge diff` compares against the production state, not the dev state.

To maintain separate state per environment, run deployments from separate directories or use CI pipelines with isolated workspaces. In CI, each job gets its own working directory, so state files do not conflict.

If you use the enterprise `PromotionManager`, promotion state is tracked separately in `.forge/promotion-requests.json` and maintains awareness of both source and target environments.
