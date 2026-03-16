import { describe, it, expect } from "vitest";
import { OllamaAdapter } from "../ollama.js";
import type { ModelConfig } from "@openforge-ai/sdk";

const llama3Model: ModelConfig = { provider: "ollama", name: "llama3" };
const mistralModel: ModelConfig = { provider: "ollama", name: "mistral" };
const claudeModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };

describe("OllamaAdapter — construction", () => {
  it("uses localhost and 11434 by default", () => {
    const adapter = new OllamaAdapter();
    expect(adapter["host"]).toBe("localhost");
    expect(adapter["port"]).toBe(11434);
  });

  it("uses provided host", () => {
    const adapter = new OllamaAdapter({ host: "192.168.1.100" });
    expect(adapter["host"]).toBe("192.168.1.100");
  });

  it("uses provided port", () => {
    const adapter = new OllamaAdapter({ port: 8080 });
    expect(adapter["port"]).toBe(8080);
  });

  it("computes baseUrl correctly", () => {
    const adapter = new OllamaAdapter({ host: "localhost", port: 11434 });
    expect(adapter.baseUrl).toBe("http://localhost:11434");
  });

  it("computes baseUrl with custom host and port", () => {
    const adapter = new OllamaAdapter({ host: "ollama.internal", port: 9000 });
    expect(adapter.baseUrl).toBe("http://ollama.internal:9000");
  });
});

describe("OllamaAdapter — validateModel", () => {
  it("validates any model (Ollama supports all pulled models)", () => {
    const adapter = new OllamaAdapter();
    expect(adapter.validateModel(llama3Model)).toBe(true);
    expect(adapter.validateModel(mistralModel)).toBe(true);
    expect(adapter.validateModel(claudeModel)).toBe(true);
  });

  it("validates models with unusual names", () => {
    const adapter = new OllamaAdapter();
    const unusual: ModelConfig[] = [
      { provider: "ollama", name: "custom-model:7b" },
      { provider: "ollama", name: "codellama:13b-instruct" },
      { provider: "ollama", name: "" },
    ];
    for (const model of unusual) {
      expect(adapter.validateModel(model)).toBe(true);
    }
  });
});

describe("OllamaAdapter — deploy", () => {
  it("always returns success: true (local instance assumed available)", async () => {
    const adapter = new OllamaAdapter();
    const result = await adapter.deploy(llama3Model);
    expect(result.success).toBe(true);
  });

  it("returns the baseUrl as endpoint", async () => {
    const adapter = new OllamaAdapter({ host: "localhost", port: 11434 });
    const result = await adapter.deploy(llama3Model);
    expect(result.endpoint).toBe("http://localhost:11434");
  });

  it("returns custom endpoint when host/port overridden", async () => {
    const adapter = new OllamaAdapter({ host: "my-ollama", port: 9999 });
    const result = await adapter.deploy(mistralModel);
    expect(result.endpoint).toBe("http://my-ollama:9999");
  });
});
