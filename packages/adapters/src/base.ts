import type { ModelConfig } from "@openforge-ai/sdk";

// ─── Unified result types ───

export interface BaseResult {
  success: boolean;
  error?: string;
}

export interface DeployResult extends BaseResult {
  endpoint?: string;
  agentId?: string;
  version?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface StatusResult {
  active: boolean;
  status?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type DestroyResult = BaseResult;

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

