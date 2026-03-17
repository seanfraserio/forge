import type { ModelConfig } from "@openforge-ai/sdk";
import { BaseLLMAdapter } from "./base.js";

export interface OpenAIDeployOptions {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Adapter for deploying agents to the OpenAI API.
 */
export class OpenAIAdapter extends BaseLLMAdapter {
  constructor(options: OpenAIDeployOptions = {}) {
    super({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      envVar: "OPENAI_API_KEY",
      defaultBaseUrl: "https://api.openai.com",
    });
  }

  validateModel(model: ModelConfig): boolean {
    return model.name.startsWith("gpt-") || /^o\d/.test(model.name);
  }
}
