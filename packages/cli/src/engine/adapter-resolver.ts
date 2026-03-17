import type { ModelConfig } from "@openforge-ai/sdk";
import {
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  OllamaAdapter,
  DockerAdapter,
  AgentProviderAdapter,
} from "@openforge-ai/adapters";
import type { AdapterInterface } from "@openforge-ai/adapters";

export function resolveAdapter(config: { model: ModelConfig; deploy?: any }): AdapterInterface {
  // If deploy config specifies an adapter, use that
  if (config.deploy?.adapter === "docker") {
    return new DockerAdapter(config.deploy);
  }
  if (config.deploy?.adapter === "agent-provider") {
    return new AgentProviderAdapter({
      endpoint: config.deploy.endpoint,
      apiKey: config.deploy.api_key,
      platformName: config.deploy.platform_name,
      authHeader: config.deploy.auth_header,
      authScheme: config.deploy.auth_scheme,
      timeoutMs: config.deploy.timeout_ms,
    });
  }

  // Default: resolve by model provider
  switch (config.model.provider) {
    case "anthropic":
      return new AnthropicAdapter();
    case "openai":
      return new OpenAIAdapter();
    case "google":
      return new GoogleAdapter();
    case "ollama":
      return new OllamaAdapter();
    default:
      throw new Error(`Unknown provider: ${config.model.provider}`);
  }
}
