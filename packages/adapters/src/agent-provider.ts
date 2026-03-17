import type { ModelConfig } from "@openforge-ai/sdk";

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

export interface AgentProviderDeployResult {
  success: boolean;
  agentId?: string;
  endpoint?: string;
  version?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

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
export class AgentProviderAdapter {
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

  async deploy(model: ModelConfig, agent?: AgentDefinition): Promise<AgentProviderDeployResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: `API key not configured for ${this.platformName}. Set AGENT_PROVIDER_API_KEY or pass apiKey in options.`,
      };
    }

    const body: AgentDefinition = agent ?? {
      name: "forge-agent",
      model,
    };

    try {
      const response = await fetch(`${this.endpoint}/agents`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          error: `${this.platformName} returned ${response.status}: ${error}`,
        };
      }

      const result = await response.json() as Record<string, unknown>;

      return {
        success: true,
        agentId: (result.id as string) ?? (result.agent_id as string),
        endpoint: (result.endpoint as string) ?? `${this.endpoint}/agents/${result.id}`,
        version: result.version as string,
        status: (result.status as string) ?? "active",
        metadata: result,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to reach ${this.platformName}: ${(err as Error).message}`,
      };
    }
  }

  // Update an existing agent
  async update(agentId: string, agent: Partial<AgentDefinition>): Promise<AgentProviderDeployResult> {
    if (!this.apiKey) {
      return { success: false, error: "API key not configured" };
    }

    try {
      const response = await fetch(`${this.endpoint}/agents/${agentId}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(agent),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        return { success: false, error: `Update failed (${response.status}): ${error}` };
      }

      const result = await response.json() as Record<string, unknown>;
      return {
        success: true,
        agentId,
        endpoint: (result.endpoint as string) ?? `${this.endpoint}/agents/${agentId}`,
        version: result.version as string,
        status: (result.status as string) ?? "active",
        metadata: result,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // Get agent status
  async status(agentId: string): Promise<{ active: boolean; status?: string; error?: string; metadata?: Record<string, unknown> }> {
    if (!this.apiKey) {
      return { active: false, error: "API key not configured" };
    }

    try {
      const response = await fetch(`${this.endpoint}/agents/${agentId}`, {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return { active: false, status: "unknown", error: `HTTP ${response.status}` };
      }

      const result = await response.json() as Record<string, unknown>;
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

  // Delete/destroy an agent
  async destroy(agentId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: "API key not configured" };
    }

    try {
      const response = await fetch(`${this.endpoint}/agents/${agentId}`, {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      // Drain the response body to release the connection
      await response.text();

      return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // Invoke an agent (send a message)
  async invoke(agentId: string, messages: Array<{ role: string; content: string }>): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }> {
    if (!this.apiKey) {
      return { success: false, error: "API key not configured" };
    }

    try {
      const response = await fetch(`${this.endpoint}/agents/${agentId}/run`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        return { success: false, error: `Invoke failed (${response.status}): ${error}` };
      }

      const result = await response.json();
      return { success: true, response: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
