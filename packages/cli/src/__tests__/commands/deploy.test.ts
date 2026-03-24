import { describe, it, expect, vi, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { plan } from "../../engine/planner.js";
import { createState, hashConfig, readState } from "../../engine/state.js";
import { apply } from "../../engine/applier.js";
import type { ForgeConfig } from "@openforge-ai/sdk";

// Mock the adapter resolver so tests don't require real API keys
vi.mock("../../engine/adapter-resolver.js", () => ({
  resolveAdapter: vi.fn(() => ({
    validateModel: () => true,
    deploy: async () => ({
      success: true,
      endpoint: "https://api.anthropic.com",
    }),
  })),
}));

const baseConfig: ForgeConfig = {
  version: "1",
  agent: { name: "deploy-agent" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001", temperature: 0.5 },
};

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.map(d => rm(d, { recursive: true, force: true }).catch(() => {})));
  tmpDirs.length = 0;
});

describe("deploy — plan generation", () => {
  it("generates creates for fresh deploy (no state)", () => {
    const result = plan(baseConfig, null);
    expect(result.hasChanges).toBe(true);
    expect(result.toCreate.length).toBeGreaterThan(0);
  });

  it("is idempotent — same hash means no changes", () => {
    const state = createState(baseConfig, "dev");
    const result = plan(baseConfig, state);
    expect(result.hasChanges).toBe(false);
  });
});

describe("deploy — apply", () => {
  it("writes state file on successful apply", async () => {
    const tmpDir = `/tmp/forge-deploy-test-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);
    const result = await apply(planResult, baseConfig, {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });
    expect(result.success).toBe(true);

    const loaded = await readState(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.agentName).toBe("deploy-agent");
  });

  it("dry run does not write state", async () => {
    const tmpDir = `/tmp/forge-dryrun-test-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);
    const result = await apply(planResult, baseConfig, {
      dryRun: true,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });
    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);

    const loaded = await readState(tmpDir);
    expect(loaded).toBeNull();
  });

  it("no-op apply when nothing changed", async () => {
    const tmpDir = `/tmp/forge-noop-test-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const state = createState(baseConfig, "dev");
    const planResult = plan(baseConfig, state);

    const result = await apply(planResult, baseConfig, {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });
    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it("apply includes correct config hash in state", async () => {
    const tmpDir = `/tmp/forge-hash-test-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);
    await apply(planResult, baseConfig, {
      dryRun: false,
      environment: "production",
      autoApprove: true,
      stateDir: tmpDir,
    });

    const loaded = await readState(tmpDir);
    expect(loaded!.configHash).toBe(hashConfig(baseConfig));
    expect(loaded!.environment).toBe("production");
  });

  it("second deploy with same config is idempotent", async () => {
    const tmpDir = `/tmp/forge-idempotent-${Date.now()}`;
    tmpDirs.push(tmpDir);

    // First deploy
    await apply(plan(baseConfig, null), baseConfig, {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });

    const state1 = await readState(tmpDir);
    const hash1 = state1!.configHash;

    // Second deploy — same config
    const state1Loaded = await readState(tmpDir);
    const planResult = plan(baseConfig, state1Loaded);
    expect(planResult.hasChanges).toBe(false);

    // Hash should remain the same
    await apply(planResult, baseConfig, {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });

    const state2 = await readState(tmpDir);
    expect(state2!.configHash).toBe(hash1);
  });

  it("includes endpoint from adapter in state", async () => {
    const tmpDir = `/tmp/forge-endpoint-test-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);
    const result = await apply(planResult, baseConfig, {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
      stateDir: tmpDir,
    });
    expect(result.success).toBe(true);
    expect(result.state.endpoint).toBe("https://api.anthropic.com");
  });

  it("throws when model validation fails", async () => {
    const { resolveAdapter } = await import("../../engine/adapter-resolver.js");
    vi.mocked(resolveAdapter).mockReturnValueOnce({
      validateModel: () => false,
      deploy: async () => ({ success: true, endpoint: "" }),
    } as any);

    const tmpDir = `/tmp/forge-validate-fail-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);

    await expect(
      apply(planResult, baseConfig, {
        dryRun: false,
        environment: "dev",
        autoApprove: true,
        stateDir: tmpDir,
      })
    ).rejects.toThrow("not supported");
  });

  it("throws when adapter deploy fails", async () => {
    const { resolveAdapter } = await import("../../engine/adapter-resolver.js");
    vi.mocked(resolveAdapter).mockReturnValueOnce({
      validateModel: () => true,
      deploy: async () => ({ success: false, error: "connection refused" }),
    } as any);

    const tmpDir = `/tmp/forge-deploy-fail-${Date.now()}`;
    tmpDirs.push(tmpDir);
    const planResult = plan(baseConfig, null);

    await expect(
      apply(planResult, baseConfig, {
        dryRun: false,
        environment: "dev",
        autoApprove: true,
        stateDir: tmpDir,
      })
    ).rejects.toThrow("Adapter deploy failed");
  });
});
