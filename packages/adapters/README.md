# @openforge-ai/adapters

LLM provider adapters for Forge agent infrastructure.

## Install

```bash
npm install @openforge-ai/adapters
```

## Adapters

### LLM Provider Adapters

These extend `BaseLLMAdapter` and handle model name validation and API key resolution. Their `deploy()` methods return the provider's base URL — they validate configuration, not manage infrastructure.

| Adapter | Provider | Model Validation | Env Var |
|---|---|---|---|
| `AnthropicAdapter` | `anthropic` | `claude-*` | `ANTHROPIC_API_KEY` |
| `OpenAIAdapter` | `openai` | `gpt-*` or `o[0-9]*` | `OPENAI_API_KEY` |
| `GoogleAdapter` | `google` | `gemini-*` | `GOOGLE_API_KEY` |
| `OllamaAdapter` | `ollama` | any (local) | — |

### Runtime Adapters

These implement `RuntimeAdapter` with full lifecycle management: deploy, status, and destroy.

**`DockerAdapter`** — Builds a Docker image from Forge config, runs it as a container with a health endpoint. Supports registry push, custom networks, and environment variables. Generates provider-specific runner scripts for Anthropic and OpenAI models.

**`AgentProviderAdapter`** — Generic REST adapter for hosted agent platforms. Communicates via a standard API pattern (`POST /agents`, `GET /agents/:id`, `PUT /agents/:id`, `DELETE /agents/:id`, `POST /agents/:id/run`). Works with any platform that follows this convention.

## Usage

```typescript
import { AnthropicAdapter, DockerAdapter, AgentProviderAdapter } from "@openforge-ai/adapters";
import type { ModelConfig } from "@openforge-ai/sdk";

const model: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };

// Validate a model name against its provider
const adapter = new AnthropicAdapter();
adapter.validateModel(model); // true

// Deploy as a Docker container
const docker = new DockerAdapter({ runtime: "node:20-alpine" });
const result = await docker.deploy(model, { name: "my-agent", port: 3000 });

// Deploy to a hosted agent platform
const hosted = new AgentProviderAdapter({
  endpoint: "https://agents.example.com",
  apiKey: "...",
});
const agent = await hosted.deploy(model, { name: "my-agent", model });
```

## Interfaces

- **`AdapterInterface`** — Base: `validateModel()` and `deploy()`
- **`RuntimeAdapter`** — Extends with `destroy()` and `status()`
- **`DeployResult`** / **`StatusResult`** / **`DestroyResult`** — Standardized return types

## Links

- [GitHub](https://github.com/seanfraserio/forge)
- [@openforge-ai/cli](https://www.npmjs.com/package/@openforge-ai/cli) — CLI tool
- [@openforge-ai/sdk](https://www.npmjs.com/package/@openforge-ai/sdk) — Types and SDK

## License

MIT
