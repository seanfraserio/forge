import { describe, it, expect, vi, afterEach } from "vitest";
import { GoogleAdapter } from "../google.js";
import type { ModelConfig } from "@openforge-ai/sdk";

afterEach(() => {
  vi.unstubAllEnvs();
});

const geminiModel: ModelConfig = { provider: "google", name: "gemini-1.5-pro" };
const claudeModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };

describe("GoogleAdapter — construction", () => {
  it("uses GOOGLE_API_KEY env var by default", () => {
    vi.stubEnv("GOOGLE_API_KEY", "google-key");
    const adapter = new GoogleAdapter();
    expect(adapter["apiKey"]).toBe("google-key");
  });

  it("uses GOOGLE_CLOUD_PROJECT env var by default", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "my-project");
    const adapter = new GoogleAdapter();
    expect(adapter["projectId"]).toBe("my-project");
  });

  it("uses provided apiKey", () => {
    const adapter = new GoogleAdapter({ apiKey: "explicit-key" });
    expect(adapter["apiKey"]).toBe("explicit-key");
  });

  it("uses default location us-central1", () => {
    const adapter = new GoogleAdapter();
    expect(adapter["location"]).toBe("us-central1");
  });

  it("accepts custom location", () => {
    const adapter = new GoogleAdapter({ location: "europe-west1" });
    expect(adapter["location"]).toBe("europe-west1");
  });
});

describe("GoogleAdapter — validateModel", () => {
  it("validates gemini- models", () => {
    expect(new GoogleAdapter().validateModel(geminiModel)).toBe(true);
  });

  it("validates all gemini- prefixed models", () => {
    const models = [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-ultra",
    ];
    const adapter = new GoogleAdapter();
    for (const name of models) {
      expect(adapter.validateModel({ provider: "google", name })).toBe(true);
    }
  });

  it("rejects claude models", () => {
    expect(new GoogleAdapter().validateModel(claudeModel)).toBe(false);
  });

  it("rejects gpt models", () => {
    const gpt: ModelConfig = { provider: "openai", name: "gpt-4o" };
    expect(new GoogleAdapter().validateModel(gpt)).toBe(false);
  });
});

describe("GoogleAdapter — deploy", () => {
  it("returns success: false with no credentials", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    const adapter = new GoogleAdapter({ apiKey: "", projectId: "" });
    const result = await adapter.deploy(geminiModel);
    expect(result.success).toBe(false);
  });

  it("returns success: true with api key only", async () => {
    const adapter = new GoogleAdapter({ apiKey: "google-key" });
    const result = await adapter.deploy(geminiModel);
    expect(result.success).toBe(true);
  });

  it("returns generativelanguage endpoint when using api key only", async () => {
    const adapter = new GoogleAdapter({ apiKey: "google-key" });
    const result = await adapter.deploy(geminiModel);
    expect(result.endpoint).toContain("generativelanguage.googleapis.com");
  });

  it("returns vertex AI endpoint when projectId provided", async () => {
    const adapter = new GoogleAdapter({ projectId: "my-project" });
    const result = await adapter.deploy(geminiModel);
    expect(result.endpoint).toContain("aiplatform.googleapis.com");
  });

  it("vertex AI endpoint includes location", async () => {
    const adapter = new GoogleAdapter({ projectId: "my-project", location: "europe-west1" });
    const result = await adapter.deploy(geminiModel);
    expect(result.endpoint).toContain("europe-west1");
  });
});
