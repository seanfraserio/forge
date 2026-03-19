# @openforge-ai/sdk

TypeScript types and SDK for Forge agent infrastructure.

## Install

```bash
npm install @openforge-ai/sdk
```

## What's Included

### Configuration Types

Types that map directly to `forge.yaml` structure:

- **`ForgeConfig`** — Root config: agent, model, system prompt, tools, memory, environments, hooks
- **`AgentConfig`** — Agent name and description
- **`ModelConfig`** — Provider, model name, temperature, max tokens
- **`ModelProvider`** — `"anthropic" | "openai" | "google" | "ollama" | "bedrock"`
- **`SystemPromptConfig`** — Inline string or file path reference
- **`ToolsConfig`** / **`McpServerConfig`** — MCP server declarations
- **`MemoryConfig`** — Memory type (`none`, `in-context`, `vector`) and optional provider
- **`EnvironmentOverride`** — Per-environment model, tools, and memory overrides
- **`HooksConfig`** / **`HookStep`** — Pre/post deploy shell commands

### Engine Types

Types used by the CLI engine for plan/apply operations:

- **`AgentState`** — Deployed state: config hash, timestamp, environment, endpoint
- **`PlanResult`** — Diff output: items to create, update, delete, or unchanged
- **`PlanItem`** — Single resource change with old/new values and summary
- **`ApplyOptions`** — Deploy options: dry run, environment, auto-approve, state directory
- **`ApplyResult`** — Deploy outcome: applied/skipped items, final state

### SDK Client

- **`ForgeClient`** — Programmatic API for Forge operations (config loading, plan, apply, state)
- **`ForgeClientOptions`** — Client constructor options: config path, state dir, environment

## Usage

```typescript
import type { ForgeConfig, ModelConfig, AgentState, PlanResult } from "@openforge-ai/sdk";

const config: ForgeConfig = {
  version: "1",
  agent: { name: "my-agent" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
};
```

## ForgeClient

`ForgeClient` provides the interface for programmatic access to Forge operations. Method implementations currently delegate to the CLI — a standalone programmatic API is planned for a future release.

```typescript
import { ForgeClient } from "@openforge-ai/sdk";

const client = new ForgeClient({ configPath: "forge.yaml", environment: "dev" });
```

## Links

- [GitHub](https://github.com/seanfraserio/forge)
- [@openforge-ai/cli](https://www.npmjs.com/package/@openforge-ai/cli) — CLI tool
- [@openforge-ai/adapters](https://www.npmjs.com/package/@openforge-ai/adapters) — Provider adapters

## License

MIT
