import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIAdapter } from "../openai.js";
import type { ModelConfig } from "@openforge-ai/sdk";

afterEach(() => {
  vi.unstubAllEnvs();
});

const gpt4Model: ModelConfig = { provider: "openai", name: "gpt-4o" };
const claudeModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };

describe("OpenAIAdapter — construction", () => {
  it("uses env var OPENAI_API_KEY by default", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env-key");
    const adapter = new OpenAIAdapter();
    expect(adapter["apiKey"]).toBe("sk-env-key");
  });

  it("uses provided apiKey over env var", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    const adapter = new OpenAIAdapter({ apiKey: "sk-explicit" });
    expect(adapter["apiKey"]).toBe("sk-explicit");
  });

  it("uses default base URL", () => {
    const adapter = new OpenAIAdapter();
    expect(adapter["baseUrl"]).toBe("https://api.openai.com");
  });

  it("accepts custom baseUrl", () => {
    const adapter = new OpenAIAdapter({ baseUrl: "https://my-proxy.example.com" });
    expect(adapter["baseUrl"]).toBe("https://my-proxy.example.com");
  });
});

describe("OpenAIAdapter — validateModel", () => {
  it("validates gpt- models", () => {
    expect(new OpenAIAdapter().validateModel(gpt4Model)).toBe(true);
  });

  it("validates all gpt- prefixed models", () => {
    const models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
    const adapter = new OpenAIAdapter();
    for (const name of models) {
      expect(adapter.validateModel({ provider: "openai", name })).toBe(true);
    }
  });

  it("validates o-series models (o1, o3, etc.)", () => {
    const models = ["o1", "o1-mini", "o3", "o3-mini"];
    const adapter = new OpenAIAdapter();
    for (const name of models) {
      expect(adapter.validateModel({ provider: "openai", name })).toBe(true);
    }
  });

  it("rejects claude models", () => {
    expect(new OpenAIAdapter().validateModel(claudeModel)).toBe(false);
  });

  it("rejects gemini models", () => {
    const gemini: ModelConfig = { provider: "google", name: "gemini-1.5-pro" };
    expect(new OpenAIAdapter().validateModel(gemini)).toBe(false);
  });
});

describe("OpenAIAdapter — deploy", () => {
  it("returns success: false with no api key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const adapter = new OpenAIAdapter({ apiKey: "" });
    const result = await adapter.deploy(gpt4Model);
    expect(result.success).toBe(false);
  });

  it("returns success: true with api key", async () => {
    const adapter = new OpenAIAdapter({ apiKey: "sk-test-key" });
    const result = await adapter.deploy(gpt4Model);
    expect(result.success).toBe(true);
  });

  it("returns endpoint url on success", async () => {
    const adapter = new OpenAIAdapter({ apiKey: "key", baseUrl: "https://api.openai.com" });
    const result = await adapter.deploy(gpt4Model);
    expect(result.endpoint).toBe("https://api.openai.com");
  });
});
