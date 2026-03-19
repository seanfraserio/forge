import type { ModelConfig } from "@openforge-ai/sdk";
import type { RuntimeAdapter, DeployResult, DestroyResult, StatusResult } from "./base.js";

export interface AgentProviderDeployOptions {
  // The hosted agent platform's API endpoint
  endpoint: string;

  // Authentication
  apiKey?: string;
  authHeader?: string;
  authScheme?: string;

  // Agent platform metadata
  platformName?: string;

  // Custom headers for platform-specific needs
  headers?: Record<string, string>;

  // Timeout for API calls
  timeoutMs?: number;
}

export interface AgentDefinition {
  name: string;
  description?: string;
  model: ModelConfig;
  systemPrompt?: string;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  memory?: {
    type: string;
    config?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

/** @deprecated Use DeployResult from ./base.js instead */
export type AgentProviderDeployResult = DeployResult;

/**
 * Generic adapter for any hosted agent platform.
 * Communicates via a standard REST API pattern:
 *   POST   /agents           - create agent
 *   GET    /agents/:id       - get agent status
 *   PUT    /agents/:id       - update agent
 *   DELETE /agents/:id       - delete agent
 *   POST   /agents/:id/run   - invoke agent
 *
 * Platforms that don't follow this exact pattern can extend this class
 * and override the relevant methods.
 */
export class AgentProviderAdapter implements RuntimeAdapter {
  private endpoint: string;
  private apiKey: string;
  private platformName: string;
  private headers: Record<string, string>;
  private timeoutMs: number;

  constructor(options: AgentProviderDeployOptions) {
    if (!options.endpoint) {
      throw new Error("AgentProviderAdapter requires an endpoint URL");
    }
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.apiKey = options.apiKey ?? process.env.AGENT_PROVIDER_API_KEY ?? "";
    const authHeader = options.authHeader ?? "Authorization";
    const authScheme = options.authScheme ?? "Bearer";
    this.platformName = options.platformName ?? "Agent Provider";
    this.headers = {
      "Content-Type": "application/json",
      [authHeader]: `${authScheme} ${this.apiKey}`,
      ...(options.headers ?? {}),
    };
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  validateModel(_model: ModelConfig): boolean {
    // Hosted agent platforms typically accept any model they support
    // Validation happens server-side
    return true;
  }

  private assertApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        `API key not configured for ${this.platformName}. Set AGENT_PROVIDER_API_KEY or pass apiKey in options.`
      );
    }
  }

  private async request(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    const url = `${this.endpoint}${path}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`${this.platformName} ${method} ${path} returned ${response.status}: ${error}`);
    }

    if (method === "DELETE") {
      await response.text(); // drain body
      return {};
    }

    return await response.json() as Record<string, unknown>;
  }

  async deploy(model: ModelConfig, agent?: AgentDefinition): Promise<DeployResult> {
    try {
      this.assertApiKey();
      const body: AgentDefinition = agent ?? { name: "forge-agent", model };
      const result = await this.request("POST", "/agents", body);
      return {
        success: true,
        agentId: (result.id as string) ?? (result.agent_id as string),
        endpoint: (result.endpoint as string) ?? `${this.endpoint}/agents/${result.id}`,
        version: result.version as string,
        status: (result.status as string) ?? "active",
        metadata: result,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async update(agentId: string, agent: Partial<AgentDefinition>): Promise<DeployResult> {
    try {
      this.assertApiKey();
      const id = encodeURIComponent(agentId);
      const result = await this.request("PUT", `/agents/${id}`, agent);
      return {
        success: true,
        agentId,
        endpoint: (result.endpoint as string) ?? `${this.endpoint}/agents/${id}`,
        version: result.version as string,
        status: (result.status as string) ?? "active",
        metadata: result,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async status(agentId: string): Promise<StatusResult> {
    try {
      this.assertApiKey();
      const id = encodeURIComponent(agentId);
      const result = await this.request("GET", `/agents/${id}`);
      const status = (result.status as string) ?? "unknown";
      return {
        active: status === "active" || status === "running",
        status,
        metadata: result,
      };
    } catch (err) {
      return { active: false, error: (err as Error).message };
    }
  }

  async destroy(agentId: string): Promise<DestroyResult> {
    try {
      this.assertApiKey();
      const id = encodeURIComponent(agentId);
      await this.request("DELETE", `/agents/${id}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async invoke(agentId: string, messages: Array<{ role: string; content: string }>): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }> {
    try {
      this.assertApiKey();
      const id = encodeURIComponent(agentId);
      const result = await this.request("POST", `/agents/${id}/run`, { messages });
      return { success: true, response: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
