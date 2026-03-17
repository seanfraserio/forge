import type { ModelConfig } from "@openforge-ai/sdk";
import { BaseLLMAdapter } from "./base.js";

export interface AnthropicDeployOptions {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Adapter for deploying agents to the Anthropic API.
 * Validates model names and translates Forge config to Anthropic SDK params.
 */
export class AnthropicAdapter extends BaseLLMAdapter {
  constructor(options: AnthropicDeployOptions = {}) {
    super({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      envVar: "ANTHROPIC_API_KEY",
      defaultBaseUrl: "https://api.anthropic.com",
    });
  }

  validateModel(model: ModelConfig): boolean {
    return model.name.startsWith("claude-");
  }
}
