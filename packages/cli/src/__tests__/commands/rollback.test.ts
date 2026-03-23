import { describe, it, expect } from "vitest";
import type { ForgeConfig } from "@openforge-ai/sdk";
import { readState, writeState } from "../../engine/state.js";
import { hashConfig, createState } from "../../engine/state.js";

const minimalConfig: ForgeConfig = {
  version: "1",
  agent: { name: "rollback-bot" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
};

describe("rollback — state inspection", () => {
  it("readState returns null when no state exists", async () => {
    const result = await readState("/tmp/no-state-dir-rollback-12345");
    expect(result).toBeNull();
  });

  it("state is readable after write", async () => {
    const tmpDir = `/tmp/forge-rollback-test-${Date.now()}`;
    const state = createState(minimalConfig, "production");
    await writeState(tmpDir, state);
    const loaded = await readState(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.agentName).toBe("rollback-bot");
    expect(loaded!.environment).toBe("production");
    expect(loaded!.configHash).toBe(hashConfig(minimalConfig));
  });

  it("state preserves lastDeployed as ISO string", async () => {
    const tmpDir = `/tmp/forge-rollback-test-ts-${Date.now()}`;
    const state = createState(minimalConfig, "dev");
    await writeState(tmpDir, state);
    const loaded = await readState(tmpDir);
    expect(() => new Date(loaded!.lastDeployed)).not.toThrow();
  });

  it("state contains config snapshot", async () => {
    const tmpDir = `/tmp/forge-rollback-config-${Date.now()}`;
    const state = createState(minimalConfig, "staging");
    await writeState(tmpDir, state);
    const loaded = await readState(tmpDir);
    expect(loaded!.config.agent.name).toBe("rollback-bot");
    expect(loaded!.config.model.provider).toBe("anthropic");
  });
});
