import type { ModelConfig } from "@openforge-ai/sdk";
import { BaseLLMAdapter, type DeployResult } from "./base.js";

export interface OllamaDeployOptions {
  host?: string;
  port?: number;
}

/**
 * Adapter for deploying agents to a local Ollama instance.
 */
export class OllamaAdapter extends BaseLLMAdapter {
  protected host: string;
  protected port: number;

  constructor(options: OllamaDeployOptions = {}) {
    const host = options.host ?? "localhost";
    const port = options.port ?? 11434;
    super({ baseUrl: `http://${host}:${port}` });
    this.host = host;
    this.port = port;
  }

  validateModel(_model: ModelConfig): boolean {
    // Ollama supports any model that's been pulled
    return true;
  }

  async deploy(_model: ModelConfig): Promise<DeployResult> {
    return { success: true, endpoint: this.baseUrl };
  }
}
