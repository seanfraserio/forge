import type { ModelConfig } from "@openforge-ai/sdk";
import {
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  OllamaAdapter,
  DockerAdapter,
  AgentProviderAdapter,
} from "@openforge-ai/adapters";
import type { AdapterInterface, DockerDeployOptions } from "@openforge-ai/adapters";

interface DeployConfig extends DockerDeployOptions {
  adapter?: "docker" | "agent-provider";
  endpoint?: string;
  api_key?: string;
  platform_name?: string;
  auth_header?: string;
  auth_scheme?: string;
  timeout_ms?: number;
}

export function resolveAdapter(config: { model: ModelConfig; deploy?: DeployConfig }): AdapterInterface {
  // If deploy config specifies an adapter, use that
  if (config.deploy?.adapter === "docker") {
    return new DockerAdapter(config.deploy);
  }
  if (config.deploy?.adapter === "agent-provider") {
    if (!config.deploy.endpoint) {
      throw new Error("agent-provider adapter requires an endpoint URL");
    }
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
