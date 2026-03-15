import type { ModelConfig } from "@openforge-ai/sdk";

export interface OpenAIDeployOptions {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Adapter for deploying agents to the OpenAI API.
 */
export class OpenAIAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: OpenAIDeployOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? "https://api.openai.com";
  }

  validateModel(model: ModelConfig): boolean {
    return model.name.startsWith("gpt-") || /^o\d/.test(model.name);
  }

  // TODO: Implement full deployment to OpenAI
  async deploy(_model: ModelConfig): Promise<{ success: boolean; endpoint?: string }> {
    if (!this.apiKey) {
      return { success: false };
    }
    return { success: true, endpoint: this.baseUrl };
  }
}
