import type { ModelConfig } from "@openforge-ai/sdk";
import { BaseLLMAdapter, type DeployResult } from "./base.js";

export interface GoogleDeployOptions {
  apiKey?: string;
  projectId?: string;
  location?: string;
}

/**
 * Adapter for deploying agents to Google Gemini / Vertex AI.
 * Validates model names and translates Forge config to Google AI SDK params.
 */
export class GoogleAdapter extends BaseLLMAdapter {
  protected projectId: string;
  protected location: string;

  constructor(options: GoogleDeployOptions = {}) {
    super({
      apiKey: options.apiKey,
      envVar: "GOOGLE_API_KEY",
    });
    this.projectId = options.projectId ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
    this.location = options.location ?? "us-central1";
  }

  validateModel(model: ModelConfig): boolean {
    return model.name.startsWith("gemini-");
  }

  async deploy(_model: ModelConfig): Promise<DeployResult> {
    if (!this.apiKey && !this.projectId) {
      return { success: false, error: "API key or project ID not configured" };
    }
    const endpoint = this.projectId
      ? `https://${this.location}-aiplatform.googleapis.com`
      : "https://generativelanguage.googleapis.com";
    return { success: true, endpoint };
  }
}
