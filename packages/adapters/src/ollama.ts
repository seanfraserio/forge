import type { ModelConfig } from "@forge-ai/sdk";

export interface OllamaDeployOptions {
  host?: string;
  port?: number;
}

/**
 * Adapter for deploying agents to a local Ollama instance.
 */
export class OllamaAdapter {
  private host: string;
  private port: number;

  constructor(options: OllamaDeployOptions = {}) {
    this.host = options.host ?? "localhost";
    this.port = options.port ?? 11434;
  }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  validateModel(_model: ModelConfig): boolean {
    // Ollama supports any model that's been pulled
    return true;
  }

  // TODO: Implement full deployment to Ollama
  async deploy(_model: ModelConfig): Promise<{ success: boolean; endpoint?: string }> {
    return { success: true, endpoint: this.baseUrl };
  }
}
