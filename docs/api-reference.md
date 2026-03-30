# Forge API Reference

> Complete reference for all Forge packages: CLI commands, SDK types, enterprise modules, and provider adapters.

---

## Table of Contents

- [CLI (`@openforge-ai/cli`)](#cli-openforge-aicli)
  - [Commands](#commands)
    - [`forgeai validate`](#forgeai-validate)
    - [`forgeai diff`](#forgeai-diff)
    - [`forgeai deploy`](#forgeai-deploy)
    - [`forgeai rollback`](#forgeai-rollback)
  - [Configuration: `forge.yaml`](#configuration-forgeyaml)
    - [Top-Level Fields](#top-level-fields)
    - [`agent`](#agent)
    - [`model`](#model)
    - [`system_prompt`](#system_prompt)
    - [`tools`](#tools)
    - [`memory`](#memory)
    - [`environments`](#environments)
    - [`hooks`](#hooks)
- [SDK (`@openforge-ai/sdk`)](#sdk-openforge-aisdk)
  - [Types](#types)
    - [`ForgeConfig`](#forgeconfig)
    - [`AgentConfig`](#agentconfig)
    - [`ModelConfig`](#modelconfig)
    - [`ProviderName`](#providername)
    - [`SystemPromptConfig`](#systempromptconfig)
    - [`ToolsConfig`](#toolsconfig)
    - [`McpServerConfig`](#mcpserverconfig)
    - [`MemoryConfig`](#memoryconfig)
    - [`MemoryType`](#memorytype)
    - [`MemoryProvider`](#memoryprovider)
    - [`EnvironmentOverride`](#environmentoverride)
    - [`HooksConfig`](#hooksconfig)
    - [`HookStep`](#hookstep)
  - [Engine Types](#engine-types)
    - [`AgentState`](#agentstate)
    - [`PlanResult`](#planresult)
    - [`PlanItem`](#planitem)
    - [`ApplyOptions`](#applyoptions)
    - [`ApplyResult`](#applyresult)
  - [`ForgeClient`](#forgeclient)
    - [`ForgeClientOptions`](#forgeclientoptions)
    - [Constructor](#forgeclient-constructor)
    - [Methods](#forgeclient-methods)
- [Enterprise (`@openforge-ai/enterprise`)](#enterprise-openforge-aienterprise)
  - [`AuditTrail`](#audittrail)
  - [`RbacManager`](#rbacmanager)
  - [`PromotionManager`](#promotionmanager)
  - [`SecretsManager`](#secretsmanager)
- [Adapters (`@openforge-ai/adapters`)](#adapters-openforge-aiadapters)
  - [`AnthropicAdapter`](#anthropicadapter)
  - [`OpenAIAdapter`](#openaiadapter)
  - [`GoogleAdapter`](#googleadapter)
  - [`OllamaAdapter`](#ollamaadapter)
- [State Files](#state-files)
  - [`.forge/state.json`](#forgestatejson)
  - [`.forge/audit.jsonl`](#forgeauditjsonl)
  - [`.forge/rbac-assignments.json`](#forgerbac-assignmentsjson)
  - [`.forge/promotion-requests.json`](#forgepromotion-requestsjson)

---

## CLI (`@openforge-ai/cli`)

Package: `@openforge-ai/cli` v0.1.0

```bash
npm install -g @openforge-ai/cli
```

### Commands

---

#### `forgeai validate`

Validate a `forge.yaml` configuration file against the schema.

```bash
forgeai validate [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c, --config <path>` | `string` | `"forge.yaml"` | Path to the forge.yaml file |

**Behavior**

- Reads the file at the given path
- Parses YAML and validates against the Zod schema (`forgeConfigSchema`)
- On success: prints agent name, model, and available environments
- On failure: prints each validation error as a bullet point

**Exit Codes**

| Code | Meaning |
|------|---------|
| `0` | Configuration is valid |
| `1` | File not found or validation failed |

**Example**

```bash
# Validate the default forge.yaml in current directory
forgeai validate

# Validate a specific config file
forgeai validate --config ./agents/researcher/forge.yaml
```

---

#### `forgeai diff`

Show what would change between the configuration file and the currently deployed state.

```bash
forgeai diff [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c, --config <path>` | `string` | `"forge.yaml"` | Path to the forge.yaml file |
| `-e, --env <environment>` | `string` | `"dev"` | Target environment for override resolution |

**Behavior**

- Loads and validates the config file
- Resolves environment overrides for the specified environment
- Reads current state from `.forge/state.json`
- Computes a plan and outputs a colored diff:
  - `+` (green) for resources to create
  - `~` (yellow) for resources to update (shows old and new values)
  - `-` (red) for resources to delete
- If no changes: prints "No changes. Infrastructure matches configuration."

**Exit Codes**

| Code | Meaning |
|------|---------|
| `0` | Diff computed successfully (whether or not changes exist) |
| `1` | Config file not found or validation failed |

**Example**

```bash
# Diff against dev environment
forgeai diff

# Diff against production
forgeai diff --env production

# Diff a specific config
forgeai diff --config agents/writer.yaml --env staging
```

---

#### `forgeai deploy`

Deploy an agent from a `forge.yaml` configuration.

```bash
forgeai deploy [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c, --config <path>` | `string` | `"forge.yaml"` | Path to the forge.yaml file |
| `-e, --env <environment>` | `string` | `"dev"` | Target environment |
| `--auto-approve` | `boolean` | `false` | Skip the confirmation prompt |
| `--dry-run` | `boolean` | `false` | Show the plan without applying changes |
| `--allow-hooks` | `boolean` | `false` | Allow execution of `pre_deploy` and `post_deploy` hooks |

**Behavior**

1. Reads and validates the config file
2. Resolves environment overrides
3. Loads current state from `.forge/state.json`
4. Generates a plan (create/update/delete)
5. Prints the plan summary
6. If `--dry-run`: stops here, prints "Dry run -- no changes applied."
7. If hooks are detected but `--allow-hooks` is not set: warns that hooks will not run
8. If `--auto-approve` is not set: prompts for confirmation
9. Applies the plan, writes new state to `.forge/state.json`
10. Prints success with config hash, or exits with error

**Exit Codes**

| Code | Meaning |
|------|---------|
| `0` | Deployment succeeded (or dry run completed, or no changes needed) |
| `1` | Config file not found, validation failed, or apply failed |

**Example**

```bash
# Interactive deploy to dev
forgeai deploy

# Deploy to production with auto-approve
forgeai deploy --env production --auto-approve

# Preview what would happen
forgeai deploy --dry-run

# Deploy with hooks enabled
forgeai deploy --auto-approve --allow-hooks
```

---

#### `forgeai rollback`

Roll back to a previous deployment state.

> **Not yet implemented.** Currently displays current state and reports that state history tracking is not available.

```bash
forgeai rollback [options]
```

**Options**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--target <hash>` | `string` | `undefined` | Target state hash to roll back to |

**Behavior**

- Reads current state from `.forge/state.json`
- Displays current agent name, environment, deploy timestamp, and config hash
- If `--target` is provided: prints "Rollback to {hash} is not yet implemented"
- If `--target` is omitted: prints usage hint

**Exit Codes**

| Code | Meaning |
|------|---------|
| `0` | State displayed successfully |
| `1` | No state file found |

**Example**

```bash
# Show current state
forgeai rollback

# Attempt rollback (not yet implemented)
forgeai rollback --target a1b2c3d4e5f6
```

---

### Configuration: `forge.yaml`

The complete schema for the `forge.yaml` configuration file. Validation is performed by Zod schemas in `@openforge-ai/cli`.

#### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | `"1"` (literal) | Yes | -- | Schema version. Must be exactly `"1"`. |
| `agent` | [`AgentConfig`](#agentconfig) | Yes | -- | Agent identity and metadata. |
| `model` | [`ModelConfig`](#modelconfig) | Yes | -- | Model provider and parameters. |
| `system_prompt` | [`SystemPromptConfig`](#systempromptconfig) | No | -- | System prompt from file or inline string. |
| `tools` | [`ToolsConfig`](#toolsconfig) | No | -- | Tool and MCP server configuration. |
| `memory` | [`MemoryConfig`](#memoryconfig) | No | -- | Memory backend configuration. |
| `environments` | `Record<string, EnvironmentOverride>` | No | -- | Per-environment overrides. |
| `hooks` | [`HooksConfig`](#hooksconfig) | No | -- | Lifecycle hooks for deploy. |

#### `agent`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Min 1 char. Must match `/^[a-z0-9-]+$/`. | Lowercase alphanumeric name with hyphens. Used as the agent identifier. |
| `description` | `string` | No | -- | Human-readable description of the agent. |

```yaml
agent:
  name: my-research-agent
  description: "An agent that searches and summarizes documents"
```

#### `model`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `provider` | [`ProviderName`](#providername) | Yes | One of: `anthropic`, `openai`, `google`, `ollama`, `bedrock`, `mistral`, `cohere` | The model provider. |
| `name` | `string` | Yes | Min 1 char. | The model identifier (e.g., `claude-sonnet-4-5-20251001`, `gpt-4o`). |
| `temperature` | `number` | No | `>= 0`, `<= 2` | Sampling temperature. |
| `max_tokens` | `number` | No | Positive integer. | Maximum tokens in the response. |

```yaml
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.7
  max_tokens: 4096
```

#### `system_prompt`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `file` | `string` | No* | -- | Path to a file containing the system prompt. |
| `inline` | `string` | No* | -- | Inline system prompt text. |

*At least one of `file` or `inline` must be provided. Enforced by a Zod refinement.

```yaml
# File-based
system_prompt:
  file: ./prompts/system.md

# Inline
system_prompt:
  inline: "You are a helpful research assistant."
```

#### `tools`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mcp_servers` | [`McpServerConfig[]`](#mcpserverconfig) | No | List of MCP server definitions. |

**`McpServerConfig`**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | `string` | Yes | Min 1 char. | Unique name for the MCP server. |
| `command` | `string` | Yes | Min 1 char. | Command to start the server. |
| `args` | `string[]` | No | -- | Command-line arguments. |
| `env` | `Record<string, string>` | No | -- | Environment variables. Supports `${VAR}` syntax for injection. |

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
      env:
        API_KEY: "${API_KEY}"
```

#### `memory`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `type` | [`MemoryType`](#memorytype) | Yes | One of: `none`, `in-context`, `vector` | The memory strategy. |
| `provider` | [`MemoryProvider`](#memoryprovider) | No* | One of: `chroma`, `pinecone`, `weaviate` | The vector store provider. |
| `collection` | `string` | No | -- | Collection or namespace name. |

*`provider` is required when `type` is `"vector"`. Enforced by a Zod refinement.

```yaml
memory:
  type: vector
  provider: chroma
  collection: agent-memory
```

#### `environments`

A map of environment names to partial overrides. Each override can replace `model` (partially), `tools`, or `memory`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `Partial<ModelConfig>` | No | Partial model overrides (merged with base model config). |
| `tools` | [`ToolsConfig`](#toolsconfig) | No | Full replacement of tools config. |
| `memory` | [`MemoryConfig`](#memoryconfig) | No | Full replacement of memory config. |

**Override resolution**: `model` fields are shallow-merged (`{ ...base.model, ...override.model }`). `tools` and `memory` are full replacements.

```yaml
environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
  staging:
    model:
      temperature: 0.3
  production:
    model:
      temperature: 0.1
      max_tokens: 8192
    memory:
      type: vector
      provider: pinecone
      collection: prod-memory
```

#### `hooks`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pre_deploy` | [`HookStep[]`](#hookstep) | No | Commands to run before deployment. |
| `post_deploy` | [`HookStep[]`](#hookstep) | No | Commands to run after deployment. |

**`HookStep`**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `run` | `string` | Yes | Min 1 char. | Shell command to execute. |

Hooks require `--allow-hooks` flag to actually execute. Without it, they are detected and warned about but not run.

```yaml
hooks:
  pre_deploy:
    - run: "pnpm test"
    - run: "pnpm lint"
  post_deploy:
    - run: "echo 'Deployed successfully'"
```

---

## SDK (`@openforge-ai/sdk`)

Package: `@openforge-ai/sdk`

```bash
npm install @openforge-ai/sdk
```

All types and the `ForgeClient` class are exported from the package root.

```typescript
import { ForgeClient } from "@openforge-ai/sdk";
import type { ForgeConfig, AgentState, PlanResult } from "@openforge-ai/sdk";
```

### Types

---

#### `ForgeConfig`

The root configuration type representing a parsed `forge.yaml`.

```typescript
interface ForgeConfig {
  version: "1";
  agent: AgentConfig;
  model: ModelConfig;
  system_prompt?: SystemPromptConfig;
  tools?: ToolsConfig;
  memory?: MemoryConfig;
  environments?: Record<string, EnvironmentOverride>;
  hooks?: HooksConfig;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"1"` | Yes | Schema version literal. |
| `agent` | `AgentConfig` | Yes | Agent identity. |
| `model` | `ModelConfig` | Yes | Model configuration. |
| `system_prompt` | `SystemPromptConfig` | No | System prompt source. |
| `tools` | `ToolsConfig` | No | Tool/MCP server configuration. |
| `memory` | `MemoryConfig` | No | Memory backend. |
| `environments` | `Record<string, EnvironmentOverride>` | No | Per-environment overrides. |
| `hooks` | `HooksConfig` | No | Deploy lifecycle hooks. |

---

#### `AgentConfig`

```typescript
interface AgentConfig {
  name: string;
  description?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Agent identifier. Lowercase alphanumeric with hyphens (`/^[a-z0-9-]+$/`). |
| `description` | `string` | No | Human-readable description. |

---

#### `ModelConfig`

```typescript
interface ModelConfig {
  provider: ProviderName;
  name: string;
  temperature?: number;
  max_tokens?: number;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `ProviderName` | Yes | Model provider identifier. |
| `name` | `string` | Yes | Model name (e.g., `claude-sonnet-4-5-20251001`). |
| `temperature` | `number` | No | Sampling temperature (`0`--`2`). |
| `max_tokens` | `number` | No | Maximum response tokens (positive integer). |

---

#### `ProviderName`

```typescript
type ProviderName = "anthropic" | "openai" | "google" | "ollama" | "bedrock" | "mistral" | "cohere";
```

---

#### `SystemPromptConfig`

```typescript
interface SystemPromptConfig {
  file?: string;
  inline?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `string` | No* | Path to a file containing the system prompt. |
| `inline` | `string` | No* | Inline system prompt text. |

*At least one of `file` or `inline` must be provided.

---

#### `ToolsConfig`

```typescript
interface ToolsConfig {
  mcp_servers?: McpServerConfig[];
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mcp_servers` | `McpServerConfig[]` | No | List of MCP server definitions. |

---

#### `McpServerConfig`

```typescript
interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique server identifier. |
| `command` | `string` | Yes | Command to start the MCP server process. |
| `args` | `string[]` | No | Command-line arguments. |
| `env` | `Record<string, string>` | No | Environment variables. Supports `${VAR}` template syntax. |

---

#### `MemoryConfig`

```typescript
interface MemoryConfig {
  type: MemoryType;
  provider?: MemoryProvider;
  collection?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `MemoryType` | Yes | Memory strategy. |
| `provider` | `MemoryProvider` | No* | Vector store provider. |
| `collection` | `string` | No | Collection or namespace name. |

*Required when `type` is `"vector"`.

---

#### `MemoryType`

```typescript
type MemoryType = "none" | "in-context" | "vector";
```

| Value | Description |
|-------|-------------|
| `"none"` | No memory. |
| `"in-context"` | In-context memory (conversation history in the prompt). |
| `"vector"` | Vector store-backed memory. Requires a `provider`. |

---

#### `MemoryProvider`

```typescript
type MemoryProvider = "chroma" | "pinecone" | "weaviate";
```

---

#### `EnvironmentOverride`

```typescript
interface EnvironmentOverride {
  model?: Partial<ModelConfig>;
  tools?: ToolsConfig;
  memory?: MemoryConfig;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `Partial<ModelConfig>` | No | Partial model overrides. Shallow-merged with the base `model`. |
| `tools` | `ToolsConfig` | No | Full replacement of tools config for this environment. |
| `memory` | `MemoryConfig` | No | Full replacement of memory config for this environment. |

---

#### `HooksConfig`

```typescript
interface HooksConfig {
  pre_deploy?: HookStep[];
  post_deploy?: HookStep[];
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pre_deploy` | `HookStep[]` | No | Commands executed before deploy. |
| `post_deploy` | `HookStep[]` | No | Commands executed after deploy. |

---

#### `HookStep`

```typescript
interface HookStep {
  run: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run` | `string` | Yes | Shell command to execute. |

---

### Engine Types

---

#### `AgentState`

Represents the deployed state of an agent, persisted to `.forge/state.json`.

```typescript
interface AgentState {
  configHash: string;
  lastDeployed: string;
  environment: string;
  agentName: string;
  agentVersion?: string;
  config: ForgeConfig;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `configHash` | `string` | Yes | SHA-256 hash of the normalized config. Used for drift detection. |
| `lastDeployed` | `string` | Yes | ISO 8601 timestamp of the last deployment. |
| `environment` | `string` | Yes | The environment this state was deployed to. |
| `agentName` | `string` | Yes | The agent name from the config. |
| `agentVersion` | `string` | No | Agent version (reserved for future use). |
| `config` | `ForgeConfig` | Yes | The full config at time of deploy. MCP server env values are redacted (except `${VAR}` template references). |

---

#### `PlanResult`

The output of the planning engine, describing what changes are needed.

```typescript
interface PlanResult {
  toCreate: PlanItem[];
  toUpdate: PlanItem[];
  toDelete: PlanItem[];
  noChange: PlanItem[];
  hasChanges: boolean;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `toCreate` | `PlanItem[]` | Resources that will be created. |
| `toUpdate` | `PlanItem[]` | Resources that will be modified. |
| `toDelete` | `PlanItem[]` | Resources that will be removed. |
| `noChange` | `PlanItem[]` | Resources that are already up to date. |
| `hasChanges` | `boolean` | `true` if any creates, updates, or deletes exist. |

---

#### `PlanItem`

A single change within a plan.

```typescript
interface PlanItem {
  resource: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  summary: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resource` | `string` | Yes | Resource type: `"agent"`, `"model"`, `"system_prompt"`, `"mcp_server"`, `"memory"`. |
| `field` | `string` | No | Specific field within the resource (e.g., `"name"`, `"temperature"`, or MCP server name). |
| `oldValue` | `unknown` | No | The previous value (present on updates and deletes). |
| `newValue` | `unknown` | No | The desired value (present on creates and updates). |
| `summary` | `string` | Yes | Human-readable description of the change. |

---

#### `ApplyOptions`

Options passed to the apply engine.

```typescript
interface ApplyOptions {
  dryRun: boolean;
  environment: string;
  autoApprove: boolean;
  stateDir?: string;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `dryRun` | `boolean` | Yes | -- | If `true`, compute results without writing state. |
| `environment` | `string` | Yes | -- | Target environment name. |
| `autoApprove` | `boolean` | Yes | -- | If `true`, skip confirmation. |
| `stateDir` | `string` | No | `".forge"` | Directory for state files. |

---

#### `ApplyResult`

The result of applying a plan.

```typescript
interface ApplyResult {
  success: boolean;
  applied: PlanItem[];
  skipped: PlanItem[];
  error?: string;
  state: AgentState;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the apply succeeded. |
| `applied` | `PlanItem[]` | Yes | Items that were applied. |
| `skipped` | `PlanItem[]` | Yes | Items that were skipped (no-change or dry-run). |
| `error` | `string` | No | Error message if `success` is `false`. |
| `state` | `AgentState` | Yes | The resulting agent state after apply. |

---

### `ForgeClient`

Programmatic API for Forge operations. Wraps core engine functionality for use outside the CLI.

#### `ForgeClientOptions`

```typescript
interface ForgeClientOptions {
  configPath?: string;
  stateDir?: string;
  environment?: string;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `configPath` | `string` | No | `"forge.yaml"` | Path to the forge.yaml file. |
| `stateDir` | `string` | No | `".forge"` | Directory for state files. |
| `environment` | `string` | No | `"dev"` | Target environment. |

#### ForgeClient Constructor

```typescript
constructor(options?: ForgeClientOptions)
```

```typescript
const client = new ForgeClient({
  configPath: "./agents/researcher/forge.yaml",
  environment: "production",
});
```

#### ForgeClient Methods

---

##### `loadConfig()`

> **Not yet implemented.** Throws `Error("Not implemented -- use @openforge-ai/cli for full functionality")`.

```typescript
async loadConfig(): Promise<ForgeConfig>
```

Loads and parses the forge.yaml file at `configPath`.

---

##### `plan(config)`

> **Not yet implemented.** Throws `Error("Not implemented -- use @openforge-ai/cli for full functionality")`.

```typescript
async plan(config: ForgeConfig): Promise<PlanResult>
```

Compares the given config against the current deployed state and returns a plan.

---

##### `apply(plan, opts?)`

> **Not yet implemented.** Throws `Error("Not implemented -- use @openforge-ai/cli for full functionality")`.

```typescript
async apply(plan: PlanResult, opts?: Partial<ApplyOptions>): Promise<ApplyResult>
```

Applies a plan to make deployed state match the desired config.

---

##### `getState()`

> **Not yet implemented.** Throws `Error("Not implemented -- use @openforge-ai/cli for full functionality")`.

```typescript
async getState(): Promise<AgentState | null>
```

Loads the current agent state from the state directory. Returns `null` if no state exists.

---

##### `getConfigPath()`

```typescript
getConfigPath(): string
```

Returns the config file path.

```typescript
client.getConfigPath(); // "forge.yaml"
```

---

##### `getStateDir()`

```typescript
getStateDir(): string
```

Returns the state directory path.

```typescript
client.getStateDir(); // ".forge"
```

---

##### `getEnvironment()`

```typescript
getEnvironment(): string
```

Returns the target environment.

```typescript
client.getEnvironment(); // "dev"
```

---

## Enterprise (`@openforge-ai/enterprise`)

Package: `@openforge-ai/enterprise`

```bash
npm install @openforge-ai/enterprise
```

```typescript
import {
  AuditTrail,
  RbacManager,
  PromotionManager,
  SecretsManager,
} from "@openforge-ai/enterprise";
```

---

### `AuditTrail`

Append-only audit log stored as JSONL in `.forge/audit.jsonl`.

#### `AuditEntry`

```typescript
interface AuditEntry {
  id: string;
  timestamp: string;
  action: "deploy" | "rollback" | "delete";
  actor: string;
  environment: string;
  agentName: string;
  configHash: string;
  previousHash?: string;
  metadata?: Record<string, unknown>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4. Auto-generated if not provided. |
| `timestamp` | `string` | Yes | ISO 8601 timestamp. Auto-generated if not provided. |
| `action` | `"deploy" \| "rollback" \| "delete"` | Yes | The action that was performed. |
| `actor` | `string` | Yes | Identifier of the user or system that performed the action. |
| `environment` | `string` | Yes | Target environment. |
| `agentName` | `string` | Yes | Name of the agent. |
| `configHash` | `string` | Yes | SHA-256 config hash at time of action. |
| `previousHash` | `string` | No | Config hash before the action (for rollbacks). |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata. |

#### `AuditEntryInput`

```typescript
type AuditEntryInput = Omit<AuditEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};
```

Same as `AuditEntry` but `id` and `timestamp` are optional (auto-generated when omitted).

#### `IAuditTrail` Interface

```typescript
interface IAuditTrail {
  record(entry: AuditEntryInput): Promise<AuditEntry>;
  query(filter: Partial<AuditEntry>): Promise<AuditEntry[]>;
  getHistory(agentName: string): Promise<AuditEntry[]>;
}
```

#### AuditTrail Constructor

```typescript
constructor(options?: AuditTrailOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stateDir` | `string` | `".forge"` | Directory where `audit.jsonl` is stored. |

```typescript
const audit = new AuditTrail({ stateDir: ".forge" });
```

#### AuditTrail Methods

---

##### `record(entry)`

```typescript
async record(entry: AuditEntryInput): Promise<AuditEntry>
```

Records an audit entry. Auto-generates `id` (UUID v4) and `timestamp` (ISO 8601) if not provided. Appends a single JSON line to `.forge/audit.jsonl`. Creates the state directory with mode `0o700` if it doesn't exist. File is written with mode `0o600`.

**Throws**: `Error` if any required field (`action`, `actor`, `environment`, `agentName`, `configHash`) is missing or if `action` is not one of `deploy`, `rollback`, `delete`.

```typescript
const entry = await audit.record({
  action: "deploy",
  actor: "ci-bot",
  environment: "production",
  agentName: "my-agent",
  configHash: "abc123...",
});
```

---

##### `query(filter)`

```typescript
async query(filter: Partial<AuditEntry>): Promise<AuditEntry[]>
```

Returns all audit entries matching the given filter. Filters on string fields only: `id`, `action`, `actor`, `environment`, `agentName`, `configHash`, `previousHash`. The `metadata` field is not filterable. Returns `[]` if the audit file does not exist. Skips malformed JSONL lines with a warning.

```typescript
const deploys = await audit.query({ action: "deploy", environment: "production" });
```

---

##### `getHistory(agentName)`

```typescript
async getHistory(agentName: string): Promise<AuditEntry[]>
```

Returns all audit entries for the given agent. Convenience wrapper around `query({ agentName })`.

```typescript
const history = await audit.getHistory("my-agent");
```

---

### `RbacManager`

Role-based access control with file-backed assignments.

#### `Permission`

```typescript
type Permission = "deploy" | "rollback" | "read" | "admin";
```

| Value | Description |
|-------|-------------|
| `"deploy"` | Can deploy agents. |
| `"rollback"` | Can roll back deployments. |
| `"read"` | Can view state and run diff/validate. |
| `"admin"` | Full access. Bypasses environment restrictions. |

#### `Role`

```typescript
interface Role {
  name: string;
  permissions: Permission[];
  environments?: string[];
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Role identifier. |
| `permissions` | `Permission[]` | Yes | Permissions granted by this role. |
| `environments` | `string[]` | No | If set, restricts the role to these environments only. Omit for all environments. |

#### `Policy`

```typescript
interface Policy {
  roles: Role[];
  defaultRole?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roles` | `Role[]` | Yes | Available role definitions. |
| `defaultRole` | `string` | No | Role assigned to users without an explicit assignment. |

#### `RbacManagerOptions`

```typescript
interface RbacManagerOptions {
  policy: Policy;
  stateDir?: string;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `policy` | `Policy` | Yes | -- | The RBAC policy (roles and default role). |
| `stateDir` | `string` | No | `".forge"` | Directory for `rbac-assignments.json`. |

#### `IRbacManager` Interface

```typescript
interface IRbacManager {
  checkPermission(userId: string, permission: Permission, environment: string): Promise<boolean>;
  assignRole(userId: string, roleName: string): Promise<void>;
  listRoles(): Promise<Role[]>;
}
```

#### RbacManager Constructor

```typescript
constructor(options: RbacManagerOptions)
```

```typescript
const rbac = new RbacManager({
  policy: {
    roles: [
      { name: "admin", permissions: ["admin"] },
      { name: "deployer", permissions: ["deploy", "rollback", "read"], environments: ["dev", "staging"] },
      { name: "viewer", permissions: ["read"] },
    ],
    defaultRole: "viewer",
  },
});
```

#### RbacManager Methods

---

##### `checkPermission(userId, permission, environment)`

```typescript
async checkPermission(userId: string, permission: Permission, environment: string): Promise<boolean>
```

**Permission evaluation algorithm:**

1. Look up the user's assigned role from `.forge/rbac-assignments.json`
2. If no assignment exists, fall back to `policy.defaultRole`
3. If no default role is configured, return `false`
4. Resolve the role definition from `policy.roles`
5. If the role is not found in the policy, return `false`
6. If the role has `"admin"` permission, return `true` (bypasses environment check)
7. Check that the role includes the requested `permission` AND the `environment` is allowed (or `environments` is not set on the role)

```typescript
const canDeploy = await rbac.checkPermission("user-123", "deploy", "production");
```

---

##### `assignRole(userId, roleName)`

```typescript
async assignRole(userId: string, roleName: string): Promise<void>
```

Assigns a role to a user. Persists to `.forge/rbac-assignments.json`. Creates the state directory with mode `0o700` if needed. File written with mode `0o600`.

**Throws**: `Error` if `userId` is empty or if `roleName` does not exist in the policy.

```typescript
await rbac.assignRole("user-123", "deployer");
```

---

##### `listRoles()`

```typescript
async listRoles(): Promise<Role[]>
```

Returns all role definitions from the policy.

```typescript
const roles = await rbac.listRoles();
```

---

### `PromotionManager`

Manages environment promotion workflows (e.g., dev -> staging -> production).

#### `PromotionRule`

```typescript
interface PromotionRule {
  from: string;
  to: string;
  requireApproval: boolean;
  approvers?: string[];
  requireTests: boolean;
  requireAudit: boolean;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `string` | Yes | Source environment. |
| `to` | `string` | Yes | Target environment. |
| `requireApproval` | `boolean` | Yes | Whether manual approval is needed. |
| `approvers` | `string[]` | No | List of user IDs authorized to approve. If set, only these users can approve. |
| `requireTests` | `boolean` | Yes | Whether tests must pass before promotion. |
| `requireAudit` | `boolean` | Yes | Whether an audit entry is required. |

#### `PromotionRequest`

```typescript
interface PromotionRequest {
  id: string;
  agentName: string;
  fromEnv: string;
  toEnv: string;
  configHash: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected" | "applied";
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4. Auto-generated on creation. |
| `agentName` | `string` | Yes | Name of the agent being promoted. |
| `fromEnv` | `string` | Yes | Source environment. |
| `toEnv` | `string` | Yes | Target environment. |
| `configHash` | `string` | Yes | Config hash of the deployment being promoted. |
| `requestedBy` | `string` | Yes | User who requested the promotion. |
| `status` | `string` | Yes | Current lifecycle state. |

**Request lifecycle states:**

| Status | Description |
|--------|-------------|
| `"pending"` | Request created, awaiting approval. |
| `"approved"` | Approved by an authorized approver. |
| `"rejected"` | Rejected (not yet implemented in current code). |
| `"applied"` | Promotion has been applied (not yet implemented in current code). |

#### `PromotionRequestInput`

```typescript
type PromotionRequestInput = {
  agentName: string;
  fromEnv: string;
  toEnv: string;
  configHash: string;
  requestedBy: string;
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentName` | `string` | Yes | Agent name. |
| `fromEnv` | `string` | Yes | Source environment. |
| `toEnv` | `string` | Yes | Target environment. |
| `configHash` | `string` | Yes | Config hash to promote. |
| `requestedBy` | `string` | Yes | Requesting user ID. |

#### `PromotionManagerOptions`

```typescript
interface PromotionManagerOptions {
  rules?: PromotionRule[];
  stateDir?: string;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `rules` | `PromotionRule[]` | No | `[]` | Initial promotion rules. |
| `stateDir` | `string` | No | `".forge"` | Directory for `promotion-requests.json`. |

#### `IPromotionManager` Interface

```typescript
interface IPromotionManager {
  createRule(rule: PromotionRule): Promise<void>;
  requestPromotion(input: PromotionRequestInput): Promise<PromotionRequest>;
  approvePromotion(requestId: string, approverId: string): Promise<void>;
  getRequests(agentName?: string): Promise<PromotionRequest[]>;
}
```

#### PromotionManager Constructor

```typescript
constructor(options?: PromotionManagerOptions)
```

```typescript
const promotions = new PromotionManager({
  rules: [
    { from: "dev", to: "staging", requireApproval: false, requireTests: true, requireAudit: true },
    { from: "staging", to: "production", requireApproval: true, approvers: ["lead-1"], requireTests: true, requireAudit: true },
  ],
});
```

#### PromotionManager Methods

---

##### `createRule(rule)`

```typescript
async createRule(rule: PromotionRule): Promise<void>
```

Adds a new promotion rule. Rules are stored in memory (not persisted to disk).

**Throws**: `Error` if a rule for the same `from` -> `to` pair already exists.

```typescript
await promotions.createRule({
  from: "dev",
  to: "staging",
  requireApproval: false,
  requireTests: true,
  requireAudit: true,
});
```

---

##### `requestPromotion(input)`

```typescript
async requestPromotion(input: PromotionRequestInput): Promise<PromotionRequest>
```

Creates a promotion request. Validates that a matching rule exists. Assigns UUID v4 `id` and sets `status` to `"pending"`. Persists to `.forge/promotion-requests.json`.

**Throws**: `Error` if no promotion rule exists for the `fromEnv` -> `toEnv` pair.

```typescript
const request = await promotions.requestPromotion({
  agentName: "my-agent",
  fromEnv: "dev",
  toEnv: "staging",
  configHash: "abc123...",
  requestedBy: "user-1",
});
```

---

##### `approvePromotion(requestId, approverId)`

```typescript
async approvePromotion(requestId: string, approverId: string): Promise<void>
```

Approves a pending promotion request. Sets `status` from `"pending"` to `"approved"`.

**Throws**:
- `Error` if the request is not found
- `Error` if the request status is not `"pending"`
- `Error` if `approvers` is set on the rule and `approverId` is not in the list

```typescript
await promotions.approvePromotion(request.id, "lead-1");
```

---

##### `getRequests(agentName?)`

```typescript
async getRequests(agentName?: string): Promise<PromotionRequest[]>
```

Returns all promotion requests, optionally filtered by agent name.

```typescript
// All requests
const all = await promotions.getRequests();

// Filtered by agent
const agentRequests = await promotions.getRequests("my-agent");
```

---

### `SecretsManager`

Resolves secret values from environment variables. Designed as an abstraction layer over external secret providers.

#### `SecretsProvider`

```typescript
type SecretsProvider = "vault" | "aws-ssm" | "gcp-secrets" | "azure-keyvault";
```

| Value | Description |
|-------|-------------|
| `"vault"` | HashiCorp Vault. |
| `"aws-ssm"` | AWS Systems Manager Parameter Store. |
| `"gcp-secrets"` | Google Cloud Secret Manager. |
| `"azure-keyvault"` | Azure Key Vault. |

> **Current implementation**: All providers resolve secrets from `process.env`. Provider-specific SDK integration is not yet implemented.

#### `SecretsConfig`

```typescript
interface SecretsConfig {
  provider: SecretsProvider;
  path?: string;
  region?: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `SecretsProvider` | Yes | The secrets backend provider. |
| `path` | `string` | No | Base path or prefix for secret keys. |
| `region` | `string` | No | Cloud region (for AWS SSM, GCP, Azure). |

#### `ISecretsManager` Interface

```typescript
interface ISecretsManager {
  resolve(key: string): Promise<string>;
  resolveAll(keys: string[]): Promise<Record<string, string>>;
}
```

#### SecretsManager Constructor

```typescript
constructor(config: SecretsConfig)
```

```typescript
const secrets = new SecretsManager({
  provider: "vault",
  path: "secret/forge",
});
```

#### SecretsManager Methods

---

##### `resolve(key)`

```typescript
async resolve(key: string): Promise<string>
```

Resolves a single secret by key from `process.env`.

**Throws**:
- `Error` if `key` is empty or whitespace-only
- `Error` if the key is not found in `process.env` (message includes the configured provider name)

```typescript
const apiKey = await secrets.resolve("ANTHROPIC_API_KEY");
```

---

##### `resolveAll(keys)`

```typescript
async resolveAll(keys: string[]): Promise<Record<string, string>>
```

Resolves multiple secrets. Calls `resolve()` for each key sequentially. Fails on the first missing key.

```typescript
const resolved = await secrets.resolveAll(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
// { ANTHROPIC_API_KEY: "sk-...", OPENAI_API_KEY: "sk-..." }
```

---

## Adapters (`@openforge-ai/adapters`)

Package: `@openforge-ai/adapters`

```bash
npm install @openforge-ai/adapters
```

All adapters share the same method signatures:

```typescript
validateModel(model: ModelConfig): boolean
async deploy(model: ModelConfig): Promise<{ success: boolean; endpoint?: string }>
```

> **Note**: The `deploy()` method on all adapters is a stub. Actual provider deployment is not yet implemented. Currently returns `{ success: true, endpoint }` if credentials are present.

---

### `AnthropicAdapter`

Adapter for deploying agents to the Anthropic API.

#### `AnthropicDeployOptions`

```typescript
interface AnthropicDeployOptions {
  apiKey?: string;
  baseUrl?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | `process.env.ANTHROPIC_API_KEY` or `""` | Anthropic API key. |
| `baseUrl` | `string` | `"https://api.anthropic.com"` | API base URL. |

#### Constructor

```typescript
constructor(options?: AnthropicDeployOptions)
```

```typescript
const adapter = new AnthropicAdapter({ apiKey: "sk-ant-..." });
```

#### Methods

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Returns `true` if `model.name` starts with `"claude-"`.

**Supported model name pattern**: `claude-*` (e.g., `claude-sonnet-4-5-20251001`, `claude-haiku-4-5-20251001`)

##### `deploy(model)` (stub)

```typescript
async deploy(model: ModelConfig): Promise<{ success: boolean; endpoint?: string }>
```

Returns `{ success: false }` if no API key is set. Otherwise returns `{ success: true, endpoint: baseUrl }`.

---

### `OpenAIAdapter`

Adapter for deploying agents to the OpenAI API.

#### `OpenAIDeployOptions`

```typescript
interface OpenAIDeployOptions {
  apiKey?: string;
  baseUrl?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | `process.env.OPENAI_API_KEY` or `""` | OpenAI API key. |
| `baseUrl` | `string` | `"https://api.openai.com"` | API base URL. |

#### Constructor

```typescript
constructor(options?: OpenAIDeployOptions)
```

```typescript
const adapter = new OpenAIAdapter({ apiKey: "sk-..." });
```

#### Methods

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Returns `true` if `model.name` starts with `"gpt-"` or matches `/^o\d/` (e.g., `o1`, `o3`).

**Supported model name patterns**: `gpt-*` (e.g., `gpt-4o`, `gpt-4-turbo`), `o*` (e.g., `o1`, `o3-mini`)

##### `deploy(model)` (stub)

```typescript
async deploy(model: ModelConfig): Promise<{ success: boolean; endpoint?: string }>
```

Returns `{ success: false }` if no API key is set. Otherwise returns `{ success: true, endpoint: baseUrl }`.

---

### `GoogleAdapter`

Adapter for deploying agents to Google Gemini / Vertex AI.

#### `GoogleDeployOptions`

```typescript
interface GoogleDeployOptions {
  apiKey?: string;
  projectId?: string;
  location?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | `process.env.GOOGLE_API_KEY` or `""` | Google API key (for Gemini API). |
| `projectId` | `string` | `process.env.GOOGLE_CLOUD_PROJECT` or `""` | GCP project ID (for Vertex AI). |
| `location` | `string` | `"us-central1"` | GCP region for Vertex AI. |

#### Constructor

```typescript
constructor(options?: GoogleDeployOptions)
```

```typescript
// Gemini API
const adapter = new GoogleAdapter({ apiKey: "AIza..." });

// Vertex AI
const adapter = new GoogleAdapter({ projectId: "my-project", location: "us-east1" });
```

#### Methods

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Returns `true` if `model.name` starts with `"gemini-"`.

**Supported model name pattern**: `gemini-*` (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`)

##### `deploy(model)` (stub)

```typescript
async deploy(model: ModelConfig): Promise<{ success: boolean; endpoint?: string }>
```

Returns `{ success: false }` if neither `apiKey` nor `projectId` is set. If `projectId` is set, returns `{ success: true, endpoint: "https://{location}-aiplatform.googleapis.com" }`. Otherwise returns `{ success: true, endpoint: "https://generativelanguage.googleapis.com" }`.

---

### `OllamaAdapter`

Adapter for deploying agents to a local Ollama instance.

#### `OllamaDeployOptions`

```typescript
interface OllamaDeployOptions {
  host?: string;
  port?: number;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | `string` | `"localhost"` | Ollama server hostname. |
| `port` | `number` | `11434` | Ollama server port. |

#### Constructor

```typescript
constructor(options?: OllamaDeployOptions)
```

```typescript
const adapter = new OllamaAdapter({ host: "192.168.1.100", port: 11434 });
```

#### Properties

##### `baseUrl`

```typescript
get baseUrl(): string
```

Returns `http://{host}:{port}`.

#### Methods

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Always returns `true`. Ollama supports any model that has been pulled locally.

##### `deploy(model)` (stub)

```typescript
async deploy(model: ModelConfig): Promise<{ success: boolean; endpoint?: string }>
```

Always returns `{ success: true, endpoint: baseUrl }`. No credentials required.

---

## State Files

All state files are stored in the `.forge/` directory (configurable via `stateDir` options). The directory is created with mode `0o700` (owner-only access). Files are written with mode `0o600`.

---

### `.forge/state.json`

Stores the current deployed agent state. Written after every successful `forgeai deploy`. Read by `forgeai deploy`, `forgeai diff`, and `forgeai rollback`.

**Schema:**

```json
{
  "configHash": "a1b2c3d4e5f6...",
  "lastDeployed": "2026-03-15T10:30:00.000Z",
  "environment": "production",
  "agentName": "my-agent",
  "config": {
    "version": "1",
    "agent": { "name": "my-agent" },
    "model": { "provider": "anthropic", "name": "claude-sonnet-4-5-20251001" },
    "tools": {
      "mcp_servers": [
        {
          "name": "filesystem",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem"],
          "env": { "API_KEY": "[REDACTED]" }
        }
      ]
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `configHash` | `string` | SHA-256 hex digest of the normalized (deep-sorted keys) config JSON. |
| `lastDeployed` | `string` | ISO 8601 timestamp. |
| `environment` | `string` | Environment name. |
| `agentName` | `string` | Agent name from config. |
| `config` | `ForgeConfig` | Full config snapshot. MCP server `env` values are redacted to `"[REDACTED]"` unless they are `${VAR}` template references (which are preserved for accurate diffing). |

**When written:** After every successful `forgeai deploy` (not on dry-run).

**When read:** At the start of `forgeai deploy`, `forgeai diff`, and `forgeai rollback` to determine current state.

---

### `.forge/audit.jsonl`

Append-only audit log. One JSON object per line. Written by `AuditTrail.record()`.

**Format:**

```
{"id":"uuid-1","timestamp":"2026-03-15T10:30:00.000Z","action":"deploy","actor":"ci-bot","environment":"production","agentName":"my-agent","configHash":"abc123..."}
{"id":"uuid-2","timestamp":"2026-03-15T11:00:00.000Z","action":"rollback","actor":"admin","environment":"production","agentName":"my-agent","configHash":"def456...","previousHash":"abc123..."}
```

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `id` | `string` | Yes | UUID v4. |
| `timestamp` | `string` | Yes | ISO 8601 timestamp. |
| `action` | `string` | Yes | `"deploy"`, `"rollback"`, or `"delete"`. |
| `actor` | `string` | Yes | Who performed the action. |
| `environment` | `string` | Yes | Target environment. |
| `agentName` | `string` | Yes | Agent name. |
| `configHash` | `string` | Yes | Config hash. |
| `previousHash` | `string` | No | Previous config hash (for rollbacks). |
| `metadata` | `object` | No | Arbitrary metadata. |

---

### `.forge/rbac-assignments.json`

Maps user IDs to role names. Written by `RbacManager.assignRole()`.

**Format:**

```json
{
  "user-123": "deployer",
  "user-456": "admin",
  "ci-bot": "deployer"
}
```

Structure: `Record<string, string>` where keys are user IDs and values are role names from the policy.

---

### `.forge/promotion-requests.json`

Array of promotion requests. Written by `PromotionManager.requestPromotion()` and `PromotionManager.approvePromotion()`.

**Format:**

```json
[
  {
    "id": "uuid-1",
    "agentName": "my-agent",
    "fromEnv": "dev",
    "toEnv": "staging",
    "configHash": "abc123...",
    "requestedBy": "user-1",
    "status": "approved"
  },
  {
    "id": "uuid-2",
    "agentName": "my-agent",
    "fromEnv": "staging",
    "toEnv": "production",
    "configHash": "abc123...",
    "requestedBy": "user-1",
    "status": "pending"
  }
]
```

Structure: `PromotionRequest[]` -- array of request objects with `status` tracking the lifecycle.

---

### Internal Engine Functions

These functions are not exported from the SDK but are used internally by the CLI. Documented here for completeness.

#### `hashConfig(config)`

```typescript
function hashConfig(config: ForgeConfig): string
```

Computes a deterministic SHA-256 hex digest of a `ForgeConfig`. Object keys are recursively sorted before serialization to ensure stable hashing regardless of property insertion order.

#### `readState(stateDir)`

```typescript
async function readState(stateDir: string): Promise<AgentState | null>
```

Reads `.forge/state.json`. Returns `null` if the file doesn't exist or has an invalid structure. Validates that `configHash` and `agentName` are present strings.

#### `writeState(stateDir, state)`

```typescript
async function writeState(stateDir: string, state: AgentState): Promise<void>
```

Writes state to `.forge/state.json`. Creates the directory with mode `0o700` if needed. File written with mode `0o600`.

#### `createState(config, environment)`

```typescript
function createState(config: ForgeConfig, environment: string): AgentState
```

Creates an `AgentState` snapshot from a config. Hashes the config, sets the current timestamp, and redacts sensitive MCP server env values.

#### `plan(desired, actual)`

```typescript
function plan(desired: ForgeConfig, actual: AgentState | null): PlanResult
```

Compares desired config against deployed state. If `actual` is `null`, all resources are marked as creates. If config hashes match, returns no changes. Otherwise performs field-level diffing on: agent name/description, model provider/name/temperature/max_tokens, MCP servers (by name), memory, and system prompt.

#### `formatPlan(planResult)`

```typescript
function formatPlan(planResult: PlanResult): string
```

Formats a `PlanResult` as a human-readable multi-line string with `+` (create), `~` (update), `-` (delete) prefixes and a summary line.

#### `apply(plan, config, opts)`

```typescript
async function apply(plan: PlanResult, config: ForgeConfig, opts: ApplyOptions): Promise<ApplyResult>
```

Applies a plan. Idempotent: applying an already-applied plan is a no-op. On dry-run, returns all items as skipped without writing state. Otherwise writes the new state to `.forge/state.json`.

#### `loadConfig(configPath)`

```typescript
async function loadConfig(configPath: string): Promise<ForgeConfig>
```

Reads a YAML file, validates it against the Zod schema, and returns the parsed `ForgeConfig`. Exits the process with code `1` if the file can't be read or validation fails.

#### `parseForgeYaml(raw)`

```typescript
function parseForgeYaml(raw: string): ValidationResult
```

Parses a raw YAML string and validates against `forgeConfigSchema`. Returns `{ success: true, config }` or `{ success: false, errors }`.

```typescript
interface ValidationResult {
  success: boolean;
  config?: ForgeConfig;
  errors?: string[];
}
```

#### `resolveEnvironment(config, env)`

```typescript
function resolveEnvironment(config: ForgeConfig, env: string): ForgeConfig
```

Applies environment overrides to a base config. `model` fields are shallow-merged. `tools` and `memory` are fully replaced. Returns the base config unchanged if the specified environment doesn't exist in `config.environments`.

---

### `DockerAdapter`

Adapter for deploying agents as Docker containers. Generates a Dockerfile, builds an image, and runs a container with an HTTP endpoint.

Package: `@openforge-ai/adapters`

#### `DockerDeployOptions`

```typescript
interface DockerDeployOptions {
  registry?: string;
  runtime?: string;
  push?: boolean;
  network?: string;
  envVars?: Record<string, string>;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `registry` | `string` | No | `""` | Docker registry URL. If empty, images are built locally only. |
| `runtime` | `string` | No | `"node:20-alpine"` | Base Docker image for the container. |
| `push` | `boolean` | No | `false` | Push built image to the registry. Requires `registry`. |
| `network` | `string` | No | -- | Docker network to attach the container to. |
| `envVars` | `Record<string, string>` | No | `{}` | Environment variables injected into the container at runtime. |

#### `DockerDeployResult`

```typescript
interface DockerDeployResult {
  success: boolean;
  endpoint?: string;
  containerId?: string;
  imageTag?: string;
  error?: string;
}
```

| Field | Type | Present | Description |
|-------|------|---------|-------------|
| `success` | `boolean` | Always | Whether the deployment succeeded. |
| `endpoint` | `string` | On success | URL of the running agent (e.g., `http://localhost:3000`). |
| `containerId` | `string` | On success | First 12 characters of the Docker container ID. |
| `imageTag` | `string` | On success | Full image reference including registry and tag. |
| `error` | `string` | On failure | Error message. |

#### DockerAdapter Constructor

```typescript
constructor(options?: DockerDeployOptions)
```

```typescript
const adapter = new DockerAdapter({
  registry: "us-central1-docker.pkg.dev/project/repo",
  push: true,
  envVars: { ANTHROPIC_BASE_URL: "http://bastion:4000" },
});
```

#### DockerAdapter Methods

---

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Always returns `true`. Docker can run any model; validation is provider-dependent, not Docker-dependent.

---

##### `deploy(model, agentConfig?)`

```typescript
async deploy(model: ModelConfig, agentConfig?: {
  name?: string;
  systemPrompt?: string;
  port?: number;
}): Promise<DockerDeployResult>
```

Generates a build context (Dockerfile, runner script, package.json), builds the Docker image, optionally pushes to the registry, stops any existing container with the same name, and starts a new container.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `ModelConfig` | -- | Model configuration passed to the generated runner script. |
| `agentConfig.name` | `string` | `"forge-agent"` | Container and image name. |
| `agentConfig.systemPrompt` | `string` | -- | System prompt written to `system-prompt.txt` in the container. |
| `agentConfig.port` | `number` | `3000` | Port for the HTTP server. |

**Build timeout:** 300,000 ms (5 minutes). **Push timeout:** 120,000 ms (2 minutes). **Run timeout:** 30,000 ms.

---

##### `destroy(agentName)`

```typescript
async destroy(agentName: string): Promise<{ success: boolean; error?: string }>
```

Stops and removes the Docker container with the given name. Returns `{ success: false, error }` if the container does not exist or cannot be stopped.

---

##### `status(agentName)`

```typescript
async status(agentName: string): Promise<{ running: boolean; containerId?: string; uptime?: string }>
```

Inspects the Docker container. Returns `running: true` with the container ID (first 12 chars) and the `StartedAt` timestamp if the container is running. Returns `{ running: false }` if the container does not exist.

---

##### `logs(agentName, tail?)`

```typescript
async logs(agentName: string, tail?: number): Promise<string>
```

Returns the last `tail` lines (default: 50) of container logs. Returns an empty string if the container does not exist.

---

### `AgentProviderAdapter`

Generic adapter for any hosted agent platform that follows a standard REST API pattern. Communicates via:

- `POST /agents` -- create agent
- `GET /agents/:id` -- get agent status
- `PUT /agents/:id` -- update agent
- `DELETE /agents/:id` -- delete agent
- `POST /agents/:id/run` -- invoke agent

Platforms that do not follow this exact pattern can extend this class and override the relevant methods.

Package: `@openforge-ai/adapters`

#### `AgentProviderDeployOptions`

```typescript
interface AgentProviderDeployOptions {
  endpoint: string;
  apiKey?: string;
  authHeader?: string;
  authScheme?: string;
  platformName?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `endpoint` | `string` | Yes | -- | The hosted agent platform's API base URL. Trailing slashes are stripped. |
| `apiKey` | `string` | No | `process.env.AGENT_PROVIDER_API_KEY` or `""` | API key for authentication. |
| `authHeader` | `string` | No | `"Authorization"` | HTTP header name used for authentication. |
| `authScheme` | `string` | No | `"Bearer"` | Authentication scheme prepended to the API key. |
| `platformName` | `string` | No | `"Agent Provider"` | Human-readable platform name used in error messages. |
| `headers` | `Record<string, string>` | No | `{}` | Additional HTTP headers sent with every request. |
| `timeoutMs` | `number` | No | `30000` | Timeout in milliseconds for API calls. Uses `AbortSignal.timeout()`. |

#### `AgentDefinition`

```typescript
interface AgentDefinition {
  name: string;
  description?: string;
  model: ModelConfig;
  systemPrompt?: string;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  memory?: {
    type: string;
    config?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Agent name. |
| `description` | `string` | No | Human-readable description. |
| `model` | `ModelConfig` | Yes | Model configuration. |
| `systemPrompt` | `string` | No | System prompt text. |
| `tools` | `Array<{ name, description?, inputSchema? }>` | No | Tool definitions. |
| `memory` | `{ type, config? }` | No | Memory configuration. |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata passed to the platform. |

#### `AgentProviderDeployResult`

```typescript
interface AgentProviderDeployResult {
  success: boolean;
  agentId?: string;
  endpoint?: string;
  version?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

| Field | Type | Present | Description |
|-------|------|---------|-------------|
| `success` | `boolean` | Always | Whether the operation succeeded. |
| `agentId` | `string` | On success | Agent ID returned by the platform (from `id` or `agent_id` in response). |
| `endpoint` | `string` | On success | Agent endpoint URL. |
| `version` | `string` | On success | Agent version string from the platform. |
| `status` | `string` | On success | Agent status (defaults to `"active"`). |
| `error` | `string` | On failure | Error message including HTTP status and platform name. |
| `metadata` | `Record<string, unknown>` | On success | Full response body from the platform. |

#### AgentProviderAdapter Constructor

```typescript
constructor(options: AgentProviderDeployOptions)
```

**Throws:** `Error` if `options.endpoint` is not provided.

```typescript
const adapter = new AgentProviderAdapter({
  endpoint: "https://api.openclaw.dev",
  apiKey: "sk-...",
  platformName: "OpenClaw",
});
```

#### AgentProviderAdapter Methods

---

##### `validateModel(model)`

```typescript
validateModel(model: ModelConfig): boolean
```

Always returns `true`. Hosted agent platforms accept any model they support; validation happens server-side.

---

##### `deploy(model, agent?)`

```typescript
async deploy(model: ModelConfig, agent?: AgentDefinition): Promise<AgentProviderDeployResult>
```

Creates an agent on the hosted platform via `POST /agents`. If `agent` is not provided, a default `AgentDefinition` is constructed with `name: "forge-agent"` and the given model.

Returns `{ success: false, error }` if no API key is configured.

---

##### `update(agentId, agent)`

```typescript
async update(agentId: string, agent: Partial<AgentDefinition>): Promise<AgentProviderDeployResult>
```

Updates an existing agent via `PUT /agents/:id`. Accepts a partial agent definition. Only the provided fields are sent to the platform.

---

##### `status(agentId)`

```typescript
async status(agentId: string): Promise<{ active: boolean; status?: string; error?: string; metadata?: Record<string, unknown> }>
```

Retrieves agent status via `GET /agents/:id`. Returns `active: true` if the platform reports status `"active"` or `"running"`.

---

##### `destroy(agentId)`

```typescript
async destroy(agentId: string): Promise<{ success: boolean; error?: string }>
```

Deletes an agent via `DELETE /agents/:id`.

---

##### `invoke(agentId, messages)`

```typescript
async invoke(agentId: string, messages: Array<{ role: string; content: string }>): Promise<{
  success: boolean;
  response?: unknown;
  error?: string;
}>
```

Sends messages to an agent via `POST /agents/:id/run`. The request body is `{ messages }`. The response body is returned as `response`.
