import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentProviderAdapter } from "../agent-provider.js";
import type { ModelConfig } from "@openforge-ai/sdk";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const anthropicModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AgentProviderAdapter — construction", () => {
  it("throws when no endpoint provided", () => {
    expect(() => new AgentProviderAdapter({ endpoint: "" })).toThrow(
      "AgentProviderAdapter requires an endpoint URL"
    );
  });

  it("strips trailing slash from endpoint", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com/",
      apiKey: "key",
    });
    expect(adapter["endpoint"]).toBe("https://api.example.com");
  });

  it("uses env var AGENT_PROVIDER_API_KEY by default", () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "env-key");
    const adapter = new AgentProviderAdapter({ endpoint: "https://api.example.com" });
    expect(adapter["apiKey"]).toBe("env-key");
  });

  it("uses provided apiKey over env var", () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "env-key");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "explicit-key",
    });
    expect(adapter["apiKey"]).toBe("explicit-key");
  });

  it("uses default auth header and scheme", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    expect(adapter["headers"]["Authorization"]).toBe("Bearer key");
  });

  it("uses custom auth header and scheme", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
      authHeader: "x-api-key",
      authScheme: "ApiKey",
    });
    expect(adapter["headers"]["x-api-key"]).toBe("ApiKey key");
    expect(adapter["headers"]["Authorization"]).toBeUndefined();
  });

  it("uses default platform name", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
    });
    expect(adapter["platformName"]).toBe("Agent Provider");
  });

  it("uses custom platform name", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      platformName: "OpenClaw",
    });
    expect(adapter["platformName"]).toBe("OpenClaw");
  });
});

describe("AgentProviderAdapter — validateModel", () => {
  it("always returns true", () => {
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    expect(adapter.validateModel(anthropicModel)).toBe(true);
    expect(adapter.validateModel({ provider: "openai", name: "gpt-4o" })).toBe(true);
    expect(adapter.validateModel({ provider: "ollama", name: "llama3" })).toBe(true);
  });
});

describe("AgentProviderAdapter — deploy", () => {
  it("returns error when no API key configured", async () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "",
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("API key not configured");
  });

  it("sends POST to /agents with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent-1", status: "active" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "test-key",
    });
    await adapter.deploy(anthropicModel);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/agents");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["Authorization"]).toBe("Bearer test-key");
  });

  it("uses custom auth header and scheme in requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent-1" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "my-key",
      authHeader: "x-api-key",
      authScheme: "Token",
    });
    await adapter.deploy(anthropicModel);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["x-api-key"]).toBe("Token my-key");
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("includes custom headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent-1" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
      headers: { "X-Custom": "value" },
    });
    await adapter.deploy(anthropicModel);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Custom"]).toBe("value");
  });

  it("returns agentId and endpoint on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "agent-42",
        endpoint: "https://agents.example.com/agent-42",
        version: "v1",
        status: "active",
      }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(true);
    expect(result.agentId).toBe("agent-42");
    expect(result.endpoint).toBe("https://agents.example.com/agent-42");
    expect(result.version).toBe("v1");
    expect(result.status).toBe("active");
  });

  it("falls back to constructed endpoint when not in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent-99" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.endpoint).toBe("https://api.example.com/agents/agent-99");
  });

  it("returns error on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "Invalid model configuration",
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
      platformName: "OpenClaw",
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("OpenClaw");
    expect(result.error).toContain("422");
    expect(result.error).toContain("Invalid model configuration");
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
      platformName: "Hermes",
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("uses custom agent definition when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent-1" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });

    const agent = {
      name: "my-custom-agent",
      description: "A custom agent",
      model: anthropicModel,
      systemPrompt: "You are helpful.",
    };
    await adapter.deploy(anthropicModel, agent);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.name).toBe("my-custom-agent");
    expect(body.description).toBe("A custom agent");
    expect(body.systemPrompt).toBe("You are helpful.");
  });
});

describe("AgentProviderAdapter — update", () => {
  it("sends PUT to /agents/:id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "v2", status: "active" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.update("agent-42", { name: "updated-agent" });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe("agent-42");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/agents/agent-42");
    expect(options.method).toBe("PUT");
  });

  it("returns error when no API key", async () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "",
    });
    const result = await adapter.update("agent-42", { name: "updated" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("API key not configured");
  });
});

describe("AgentProviderAdapter — status", () => {
  it("sends GET to /agents/:id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "active" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.status("agent-42");

    expect(result.active).toBe(true);
    expect(result.status).toBe("active");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/agents/agent-42");
    expect(options.method).toBe("GET");
  });

  it("returns active: true for running status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "running" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.status("agent-42");

    expect(result.active).toBe(true);
    expect(result.status).toBe("running");
  });

  it("returns active: false for non-active status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "stopped" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.status("agent-42");

    expect(result.active).toBe(false);
    expect(result.status).toBe("stopped");
  });

  it("returns active: false on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.status("nonexistent");

    expect(result.active).toBe(false);
    expect(result.error).toContain("404");
  });

  it("returns error when no API key", async () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "",
    });
    const result = await adapter.status("agent-42");

    expect(result.active).toBe(false);
    expect(result.error).toContain("API key not configured");
  });
});

describe("AgentProviderAdapter — destroy", () => {
  it("sends DELETE to /agents/:id", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.destroy("agent-42");

    expect(result.success).toBe(true);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/agents/agent-42");
    expect(options.method).toBe("DELETE");
  });

  it("returns error on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.destroy("agent-42");

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });

  it("returns error when no API key", async () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "",
    });
    const result = await adapter.destroy("agent-42");

    expect(result.success).toBe(false);
    expect(result.error).toContain("API key not configured");
  });
});

describe("AgentProviderAdapter — invoke", () => {
  it("sends POST to /agents/:id/run", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "Hello!" }),
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const messages = [{ role: "user", content: "Hi" }];
    const result = await adapter.invoke("agent-42", messages);

    expect(result.success).toBe(true);
    expect(result.response).toEqual({ reply: "Hello!" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/agents/agent-42/run");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.messages).toEqual(messages);
  });

  it("returns error on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    });

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.invoke("agent-42", [{ role: "user", content: "Hi" }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("429");
    expect(result.error).toContain("Rate limit exceeded");
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection timeout"));

    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "key",
    });
    const result = await adapter.invoke("agent-42", [{ role: "user", content: "Hi" }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Connection timeout");
  });

  it("returns error when no API key", async () => {
    vi.stubEnv("AGENT_PROVIDER_API_KEY", "");
    const adapter = new AgentProviderAdapter({
      endpoint: "https://api.example.com",
      apiKey: "",
    });
    const result = await adapter.invoke("agent-42", [{ role: "user", content: "Hi" }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("API key not configured");
  });
});
