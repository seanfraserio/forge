import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ModelConfig } from "@openforge-ai/sdk";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn: unknown) => fn),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  rm: vi.fn(async () => undefined),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

import { DockerAdapter } from "../docker.js";
import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";

// Since promisify is mocked to return the fn as-is, exec itself is the mock
const mockExecAsync = vi.mocked(exec) as unknown as ReturnType<typeof vi.fn>;

const anthropicModel: ModelConfig = { provider: "anthropic", name: "claude-sonnet-4-5-20251001" };
const openaiModel: ModelConfig = { provider: "openai", name: "gpt-4o" };
const googleModel: ModelConfig = { provider: "google", name: "gemini-1.5-pro" };
const ollamaModel: ModelConfig = { provider: "ollama", name: "llama3" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DockerAdapter — construction", () => {
  it("uses defaults when no options provided", () => {
    const adapter = new DockerAdapter();
    expect(adapter["registry"]).toBe("");
    expect(adapter["runtime"]).toBe("node:20-alpine");
    expect(adapter["push"]).toBe(false);
    expect(adapter["network"]).toBeUndefined();
    expect(adapter["envVars"]).toEqual({});
  });

  it("uses custom options", () => {
    const adapter = new DockerAdapter({
      registry: "us-central1-docker.pkg.dev/project/repo",
      runtime: "node:22-slim",
      push: true,
      network: "my-network",
      envVars: { NODE_ENV: "production" },
    });
    expect(adapter["registry"]).toBe("us-central1-docker.pkg.dev/project/repo");
    expect(adapter["runtime"]).toBe("node:22-slim");
    expect(adapter["push"]).toBe(true);
    expect(adapter["network"]).toBe("my-network");
    expect(adapter["envVars"]).toEqual({ NODE_ENV: "production" });
  });
});

describe("DockerAdapter — validateModel", () => {
  it("always returns true (Docker can run any model)", () => {
    const adapter = new DockerAdapter();
    expect(adapter.validateModel(anthropicModel)).toBe(true);
    expect(adapter.validateModel(openaiModel)).toBe(true);
    expect(adapter.validateModel(googleModel)).toBe(true);
    expect(adapter.validateModel(ollamaModel)).toBe(true);
  });

  it("validates models with empty names", () => {
    const adapter = new DockerAdapter();
    const empty: ModelConfig = { provider: "anthropic", name: "" };
    expect(adapter.validateModel(empty)).toBe(true);
  });
});

describe("DockerAdapter — deploy", () => {
  it("builds and runs a container successfully", async () => {
    // Mock docker build, docker rm -f (fail = no existing container), docker run
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("no such container")) // docker rm -f
      .mockResolvedValueOnce({ stdout: "abc123def456ghij\n", stderr: "" }); // docker run

    const adapter = new DockerAdapter();
    const result = await adapter.deploy(anthropicModel, { name: "test-agent", port: 8080 });

    expect(result.success).toBe(true);
    expect(result.containerId).toBe("abc123def456");
    expect(result.endpoint).toBe("http://localhost:8080");
    expect(result.imageTag).toBe("test-agent:" + result.imageTag!.split(":")[1]);
  });

  it("returns error when docker build fails", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("build error: no space left on device"));

    const adapter = new DockerAdapter();
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Docker build failed");
  });

  it("returns error when docker run fails", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("no such container")) // docker rm -f
      .mockRejectedValueOnce(new Error("port already in use")); // docker run

    const adapter = new DockerAdapter();
    const result = await adapter.deploy(openaiModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Docker run failed");
  });

  it("pushes to registry when configured", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker push
      .mockRejectedValueOnce(new Error("no container")) // docker rm -f
      .mockResolvedValueOnce({ stdout: "container123id\n", stderr: "" }); // docker run

    const adapter = new DockerAdapter({
      registry: "my-registry.com/repo",
      push: true,
    });
    const result = await adapter.deploy(anthropicModel, { name: "my-agent" });

    expect(result.success).toBe(true);
    expect(result.imageTag).toContain("my-registry.com/repo/");
  });

  it("returns error when docker push fails", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("auth required")); // docker push

    const adapter = new DockerAdapter({
      registry: "my-registry.com/repo",
      push: true,
    });
    const result = await adapter.deploy(anthropicModel);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Docker push failed");
  });

  it("writes Dockerfile with correct content", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("no container")) // docker rm -f
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" }); // docker run

    const adapter = new DockerAdapter({ runtime: "node:22-slim" });
    await adapter.deploy(anthropicModel, { port: 4000 });

    const mockWriteFile = vi.mocked(writeFile);
    const dockerfileCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("Dockerfile")
    );

    expect(dockerfileCall).toBeDefined();
    const content = dockerfileCall![1] as string;
    expect(content).toContain("FROM node:22-slim");
    expect(content).toContain("EXPOSE 4000");
    expect(content).toContain('CMD ["node", "agent.mjs"]');
  });

  it("writes system prompt file when provided", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("no container")) // docker rm -f
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" }); // docker run

    const adapter = new DockerAdapter();
    await adapter.deploy(anthropicModel, {
      name: "my-agent",
      systemPrompt: "You are a helpful assistant.",
    });

    const mockWriteFile = vi.mocked(writeFile);
    const promptCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("system-prompt.txt")
    );

    expect(promptCall).toBeDefined();
    expect(promptCall![1]).toBe("You are a helpful assistant.");
  });

  it("includes env vars and network in docker run command", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // docker build
      .mockRejectedValueOnce(new Error("no container")) // docker rm -f
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" }); // docker run

    const adapter = new DockerAdapter({
      envVars: { API_KEY: "secret", NODE_ENV: "production" },
      network: "my-net",
    });
    await adapter.deploy(anthropicModel, { name: "my-agent" });

    const runCall = mockExecAsync.mock.calls[2][0] as string;
    expect(runCall).toContain('-e "API_KEY=secret"');
    expect(runCall).toContain('-e "NODE_ENV=production"');
    expect(runCall).toContain("--network my-net");
  });
});

describe("DockerAdapter — getDependencies (via deploy)", () => {
  it("includes anthropic SDK for anthropic provider", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("no container"))
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" });

    const adapter = new DockerAdapter();
    await adapter.deploy(anthropicModel);

    const mockWriteFile = vi.mocked(writeFile);
    const pkgCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("package.json")
    );

    expect(pkgCall).toBeDefined();
    const pkg = JSON.parse(pkgCall![1] as string);
    expect(pkg.dependencies).toHaveProperty("@anthropic-ai/sdk");
  });

  it("includes openai SDK for openai provider", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("no container"))
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" });

    const adapter = new DockerAdapter();
    await adapter.deploy(openaiModel);

    const mockWriteFile = vi.mocked(writeFile);
    const pkgCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("package.json")
    );

    const pkg = JSON.parse(pkgCall![1] as string);
    expect(pkg.dependencies).toHaveProperty("openai");
  });

  it("includes google AI SDK for google provider", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("no container"))
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" });

    const adapter = new DockerAdapter();
    await adapter.deploy(googleModel);

    const mockWriteFile = vi.mocked(writeFile);
    const pkgCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("package.json")
    );

    const pkg = JSON.parse(pkgCall![1] as string);
    expect(pkg.dependencies).toHaveProperty("@google/generative-ai");
  });

  it("returns empty dependencies for unknown providers", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(new Error("no container"))
      .mockResolvedValueOnce({ stdout: "container123\n", stderr: "" });

    const adapter = new DockerAdapter();
    await adapter.deploy(ollamaModel);

    const mockWriteFile = vi.mocked(writeFile);
    const pkgCall = mockWriteFile.mock.calls.find(
      (call) => String(call[0]).endsWith("package.json")
    );

    const pkg = JSON.parse(pkgCall![1] as string);
    expect(pkg.dependencies).toEqual({});
  });
});

describe("DockerAdapter — destroy", () => {
  it("calls docker rm -f", async () => {
    mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    const adapter = new DockerAdapter();
    const result = await adapter.destroy("my-agent");

    expect(result.success).toBe(true);
    expect(mockExecAsync).toHaveBeenCalledWith(
      "docker rm -f my-agent",
    );
  });

  it("returns error when container does not exist", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("No such container: my-agent"));

    const adapter = new DockerAdapter();
    const result = await adapter.destroy("my-agent");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No such container");
  });
});

describe("DockerAdapter — status", () => {
  it("returns running status for an active container", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: "true abc123def456ghij 2025-01-01T00:00:00Z",
      stderr: "",
    });

    const adapter = new DockerAdapter();
    const result = await adapter.status("my-agent");

    expect(result.running).toBe(true);
    expect(result.containerId).toBe("abc123def456");
    expect(result.uptime).toBe("2025-01-01T00:00:00Z");
  });

  it("returns running: false when container does not exist", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("No such container"));

    const adapter = new DockerAdapter();
    const result = await adapter.status("nonexistent");

    expect(result.running).toBe(false);
    expect(result.containerId).toBeUndefined();
  });

  it("returns running: false for a stopped container", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: "false abc123def456ghij 2025-01-01T00:00:00Z",
      stderr: "",
    });

    const adapter = new DockerAdapter();
    const result = await adapter.status("stopped-agent");

    expect(result.running).toBe(false);
  });
});

describe("DockerAdapter — logs", () => {
  it("returns log output from a container", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: "Forge agent running on port 3000\nProcessing request...",
      stderr: "",
    });

    const adapter = new DockerAdapter();
    const result = await adapter.logs("my-agent");

    expect(result).toContain("Forge agent running on port 3000");
  });

  it("returns empty string when container does not exist", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("No such container"));

    const adapter = new DockerAdapter();
    const result = await adapter.logs("nonexistent");

    expect(result).toBe("");
  });

  it("uses custom tail count", async () => {
    mockExecAsync.mockResolvedValueOnce({ stdout: "line1\nline2", stderr: "" });

    const adapter = new DockerAdapter();
    await adapter.logs("my-agent", 100);

    expect(mockExecAsync).toHaveBeenCalledWith(
      "docker logs --tail 100 my-agent",
    );
  });
});
