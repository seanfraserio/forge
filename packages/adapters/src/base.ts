import type { ModelConfig } from "@openforge-ai/sdk";

// ─── Unified result types ───

export interface DeployResult {
  success: boolean;
  endpoint?: string;
  agentId?: string;
  version?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface StatusResult {
  active: boolean;
  status?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DestroyResult {
  success: boolean;
  error?: string;
}

// ─── Adapter interfaces ───

export interface AdapterInterface {
  validateModel(model: ModelConfig): boolean;
  deploy(model: ModelConfig, ...args: unknown[]): Promise<DeployResult>;
}

export interface RuntimeAdapter extends AdapterInterface {
  destroy(identifier: string): Promise<DestroyResult>;
  status(identifier: string): Promise<StatusResult>;
}

// ─── Base class for LLM provider adapters ───

export abstract class BaseLLMAdapter implements AdapterInterface {
  protected apiKey: string;
  protected baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string; envVar?: string; defaultBaseUrl?: string }) {
    this.apiKey = options.apiKey ?? (options.envVar ? process.env[options.envVar] ?? "" : "");
    this.baseUrl = options.baseUrl ?? options.defaultBaseUrl ?? "";
  }

  abstract validateModel(model: ModelConfig): boolean;

  async deploy(_model: ModelConfig): Promise<DeployResult> {
    if (!this.apiKey) {
      return { success: false, error: "API key not configured" };
    }
    return { success: true, endpoint: this.baseUrl };
  }
}

// ─── Utilities ───

export async function catchAsResult<T>(fn: () => Promise<T>): Promise<T | DestroyResult> {
  try {
    return await fn();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
