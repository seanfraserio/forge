import { describe, it, expect } from "vitest";
import { plan } from "../../engine/planner.js";
import { createState } from "../../engine/state.js";
import type { ForgeConfig } from "@openforge-ai/sdk";

const baseConfig: ForgeConfig = {
  version: "1",
  agent: { name: "diff-agent" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
};

describe("diff — detects no changes", () => {
  it("shows no changes when config matches state", () => {
    const state = createState(baseConfig, "dev");
    const result = plan(baseConfig, state);
    expect(result.hasChanges).toBe(false);
    expect(result.toCreate).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });
});

describe("diff — detects additions", () => {
  it("detects added mcp_server", () => {
    const state = createState(baseConfig, "dev");
    const newConfig: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "new-server", command: "cmd" }],
    };
    const result = plan(newConfig, state);
    expect(result.hasChanges).toBe(true);
    expect(result.toCreate.some((i) => i.resource === "mcp_server" && i.field === "new-server")).toBe(true);
  });
});

describe("diff — detects changes", () => {
  it("detects agent name change", () => {
    const state = createState(baseConfig, "dev");
    const newConfig: ForgeConfig = {
      ...baseConfig,
      agent: { name: "renamed-agent" },
    };
    const result = plan(newConfig, state);
    expect(result.hasChanges).toBe(true);
    expect(result.toUpdate.some((i) => i.resource === "agent" && i.field === "name")).toBe(true);
  });

  it("detects model provider change", () => {
    const state = createState(baseConfig, "dev");
    const newConfig: ForgeConfig = {
      ...baseConfig,
      model: { provider: "openai", name: "gpt-4o" },
    };
    const result = plan(newConfig, state);
    expect(result.toUpdate.some((i) => i.resource === "model" && i.field === "provider")).toBe(true);
  });

  it("detects mcp_server update", () => {
    const configV1: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "srv", command: "cmd-v1" }],
    };
    const state = createState(configV1, "dev");
    const configV2: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "srv", command: "cmd-v2" }],
    };
    const result = plan(configV2, state);
    expect(result.toUpdate.some((i) => i.resource === "mcp_server")).toBe(true);
  });
});

describe("diff — detects removals", () => {
  it("detects removed mcp_server", () => {
    const configWithServer: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "old-server", command: "cmd" }],
    };
    const state = createState(configWithServer, "dev");
    const result = plan(baseConfig, state);
    expect(result.hasChanges).toBe(true);
    expect(result.toDelete.some((i) => i.resource === "mcp_server" && i.field === "old-server")).toBe(true);
  });
});

describe("diff — multiple changes together", () => {
  it("captures add + update + delete in single plan", () => {
    const initialConfig: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [
        { name: "keep-me", command: "cmd-v1" },
        { name: "remove-me", command: "cmd" },
      ],
    };
    const state = createState(initialConfig, "dev");

    const newConfig: ForgeConfig = {
      ...baseConfig,
      agent: { name: "updated-agent" },  // update
      mcp_servers: [
        { name: "keep-me", command: "cmd-v2" }, // update
        { name: "add-me", command: "new-cmd" }, // create
        // "remove-me" is gone — delete
      ],
    };
    const result = plan(newConfig, state);
    expect(result.toCreate.some((i) => i.field === "add-me")).toBe(true);
    expect(result.toUpdate.some((i) => i.field === "keep-me")).toBe(true);
    expect(result.toDelete.some((i) => i.field === "remove-me")).toBe(true);
    expect(result.hasChanges).toBe(true);
  });
});
