import { describe, it, expect, vi, afterEach } from "vitest";
import { AnthropicAdapter } from "../anthropic.js";
import type { ModelConfig } from "@openforge-ai/sdk";

afterEach(() => {
  vi.unstubAllEnvs();
});

const claudeModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };
const nonClaudeModel: ModelConfig = { provider: "openai", name: "gpt-4o" };

describe("AnthropicAdapter — construction", () => {
  it("uses env var ANTHROPIC_API_KEY by default", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "env-key");
    const adapter = new AnthropicAdapter();
    expect(adapter["apiKey"]).toBe("env-key");
  });

  it("uses provided apiKey over env var", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "env-key");
    const adapter = new AnthropicAdapter({ apiKey: "explicit-key" });
    expect(adapter["apiKey"]).toBe("explicit-key");
  });

  it("uses default base URL", () => {
    const adapter = new AnthropicAdapter();
    expect(adapter["baseUrl"]).toBe("https://api.anthropic.com");
  });

  it("accepts custom baseUrl", () => {
    const adapter = new AnthropicAdapter({ baseUrl: "https://custom.example.com" });
    expect(adapter["baseUrl"]).toBe("https://custom.example.com");
  });
});

describe("AnthropicAdapter — validateModel", () => {
  it("validates claude- models", () => {
    expect(new AnthropicAdapter().validateModel(claudeModel)).toBe(true);
  });

  it("validates any claude- prefixed model name", () => {
    const models = [
      "claude-sonnet-4-5-20251001",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-5-20251001",
      "claude-3-5-sonnet-20241022",
    ];
    const adapter = new AnthropicAdapter();
    for (const name of models) {
      expect(adapter.validateModel({ provider: "anthropic", name })).toBe(true);
    }
  });

  it("rejects non-claude models", () => {
    expect(new AnthropicAdapter().validateModel(nonClaudeModel)).toBe(false);
  });

  it("rejects gemini models", () => {
    const gemini: ModelConfig = { provider: "google", name: "gemini-1.5-pro" };
    expect(new AnthropicAdapter().validateModel(gemini)).toBe(false);
  });
});

describe("AnthropicAdapter — deploy", () => {
  it("returns success: false when no api key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const adapter = new AnthropicAdapter({ apiKey: "" });
    const result = await adapter.deploy(claudeModel);
    expect(result.success).toBe(false);
  });

  it("returns success: true with api key", async () => {
    const adapter = new AnthropicAdapter({ apiKey: "test-key" });
    const result = await adapter.deploy(claudeModel);
    expect(result.success).toBe(true);
  });

  it("returns endpoint url on success", async () => {
    const adapter = new AnthropicAdapter({ apiKey: "key", baseUrl: "https://api.anthropic.com" });
    const result = await adapter.deploy(claudeModel);
    expect(result.endpoint).toBe("https://api.anthropic.com");
  });
});
