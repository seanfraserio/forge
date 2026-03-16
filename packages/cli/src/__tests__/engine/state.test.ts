import { describe, it, expect } from "vitest";
import { hashConfig, readState, writeState, createState } from "../../engine/state.js";
import type { ForgeConfig, AgentState } from "@openforge-ai/sdk";

const baseConfig: ForgeConfig = {
  version: "1",
  agent: { name: "test-agent", description: "A test agent" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001", temperature: 0.7 },
};

describe("hashConfig", () => {
  it("produces a 64-char hex string", () => {
    const hash = hashConfig(baseConfig);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same config", () => {
    expect(hashConfig(baseConfig)).toBe(hashConfig(baseConfig));
  });

  it("changes when model name changes", () => {
    const other: ForgeConfig = {
      ...baseConfig,
      model: { ...baseConfig.model, name: "claude-haiku-4-5-20251001" },
    };
    expect(hashConfig(baseConfig)).not.toBe(hashConfig(other));
  });

  it("is stable regardless of key insertion order", () => {
    // JSON key order should not affect hash
    const cfg1: ForgeConfig = {
      version: "1",
      agent: { name: "bot" },
      model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
    };
    const cfg2: ForgeConfig = {
      model: { name: "claude-sonnet-4-5-20251001", provider: "anthropic" },
      agent: { name: "bot" },
      version: "1",
    };
    expect(hashConfig(cfg1)).toBe(hashConfig(cfg2));
  });

  it("changes when tools are added", () => {
    const withTools: ForgeConfig = {
      ...baseConfig,
      tools: { mcp_servers: [{ name: "search", command: "npx search-server" }] },
    };
    expect(hashConfig(baseConfig)).not.toBe(hashConfig(withTools));
  });
});

describe("readState", () => {
  it("returns null when directory does not exist", async () => {
    const result = await readState("/tmp/no-state-dir-xyz-99999");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const tmpDir = `/tmp/forge-bad-json-${Date.now()}`;
    await mkdir(tmpDir, { recursive: true });
    await writeFile(`${tmpDir}/state.json`, "not-valid-json");
    const result = await readState(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for structurally invalid state", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const tmpDir = `/tmp/forge-invalid-state-${Date.now()}`;
    await mkdir(tmpDir, { recursive: true });
    await writeFile(`${tmpDir}/state.json`, JSON.stringify({ foo: "bar" }));
    const result = await readState(tmpDir);
    expect(result).toBeNull();
  });
});

describe("writeState and readState roundtrip", () => {
  it("persists and loads state correctly", async () => {
    const tmpDir = `/tmp/forge-state-test-${Date.now()}`;
    const state = createState(baseConfig, "production");
    await writeState(tmpDir, state);
    const loaded = await readState(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.configHash).toBe(hashConfig(baseConfig));
    expect(loaded!.agentName).toBe("test-agent");
    expect(loaded!.environment).toBe("production");
  });

  it("creates directory if missing", async () => {
    const tmpDir = `/tmp/forge-mkdir-test-${Date.now()}/nested/dir`;
    const state = createState(baseConfig, "dev");
    await expect(writeState(tmpDir, state)).resolves.not.toThrow();
    const loaded = await readState(tmpDir);
    expect(loaded).not.toBeNull();
  });

  it("overwrites existing state on re-write", async () => {
    const tmpDir = `/tmp/forge-overwrite-${Date.now()}`;
    const state1 = createState(baseConfig, "dev");
    await writeState(tmpDir, state1);

    const newConfig: ForgeConfig = {
      ...baseConfig,
      agent: { name: "updated-agent" },
    };
    const state2 = createState(newConfig, "production");
    await writeState(tmpDir, state2);

    const loaded = await readState(tmpDir);
    expect(loaded!.agentName).toBe("updated-agent");
    expect(loaded!.environment).toBe("production");
  });
});

describe("createState", () => {
  it("sets configHash from hashConfig", () => {
    const state = createState(baseConfig, "dev");
    expect(state.configHash).toBe(hashConfig(baseConfig));
  });

  it("sets agentName from config", () => {
    const state = createState(baseConfig, "dev");
    expect(state.agentName).toBe("test-agent");
  });

  it("sets environment", () => {
    const state = createState(baseConfig, "staging");
    expect(state.environment).toBe("staging");
  });

  it("redacts resolved env var secrets", () => {
    const configWithSecret: ForgeConfig = {
      ...baseConfig,
      tools: {
        mcp_servers: [{
          name: "server",
          command: "cmd",
          env: { SECRET_KEY: "actual-secret-value" },
        }],
      },
    };
    const state = createState(configWithSecret, "prod");
    const server = state.config.tools?.mcp_servers?.[0];
    expect(server?.env?.SECRET_KEY).toBe("[REDACTED]");
  });

  it("preserves template references in env", () => {
    const configWithTemplate: ForgeConfig = {
      ...baseConfig,
      tools: {
        mcp_servers: [{
          name: "server",
          command: "cmd",
          env: { KEY: "${MY_SECRET}" },
        }],
      },
    };
    const state = createState(configWithTemplate, "prod");
    const server = state.config.tools?.mcp_servers?.[0];
    expect(server?.env?.KEY).toBe("${MY_SECRET}");
  });
});
