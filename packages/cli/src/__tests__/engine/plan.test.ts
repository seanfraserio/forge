import { describe, it, expect } from "vitest";
import { plan, formatPlan } from "../../engine/planner.js";
import { createState } from "../../engine/state.js";
import type { ForgeConfig, AgentState } from "@openforge-ai/sdk";

const baseConfig: ForgeConfig = {
  version: "1",
  agent: { name: "my-agent", description: "An agent" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001", temperature: 0.5 },
};

function makeState(config: ForgeConfig, env = "dev"): AgentState {
  return createState(config, env);
}

describe("plan — no existing state", () => {
  it("creates agent and model when no state exists", () => {
    const result = plan(baseConfig, null);
    expect(result.hasChanges).toBe(true);
    const resources = result.toCreate.map((i) => i.resource);
    expect(resources).toContain("agent");
    expect(resources).toContain("model");
  });

  it("creates system_prompt when present", () => {
    const config: ForgeConfig = {
      ...baseConfig,
      system_prompt: "You are helpful.",
    };
    const result = plan(config, null);
    const resources = result.toCreate.map((i) => i.resource);
    expect(resources).toContain("system_prompt");
  });

  it("creates mcp_servers when present", () => {
    const config: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "npx search" }],
    };
    const result = plan(config, null);
    const mcpItems = result.toCreate.filter((i) => i.resource === "mcp_server");
    expect(mcpItems.length).toBe(1);
    expect(mcpItems[0].field).toBe("search");
  });

  it("creates memory when type is not none", () => {
    const config: ForgeConfig = {
      ...baseConfig,
      memory: { type: "in-context" },
    };
    const result = plan(config, null);
    const resources = result.toCreate.map((i) => i.resource);
    expect(resources).toContain("memory");
  });

  it("does not create memory when type is none", () => {
    const config: ForgeConfig = {
      ...baseConfig,
      memory: { type: "none" },
    };
    const result = plan(config, null);
    const resources = result.toCreate.map((i) => i.resource);
    expect(resources).not.toContain("memory");
  });
});

describe("plan — idempotency (same hash = no-op)", () => {
  it("returns no changes when config hash matches", () => {
    const state = makeState(baseConfig);
    const result = plan(baseConfig, state);
    expect(result.hasChanges).toBe(false);
    expect(result.noChange.length).toBeGreaterThan(0);
  });

  it("places up-to-date resource in noChange", () => {
    const state = makeState(baseConfig);
    const result = plan(baseConfig, state);
    const summary = result.noChange[0].summary;
    expect(summary).toContain("up to date");
  });
});

describe("plan — detecting changes", () => {
  it("detects agent name change", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      agent: { name: "new-agent" },
    };
    const result = plan(newConfig, state);
    expect(result.hasChanges).toBe(true);
    const nameUpdate = result.toUpdate.find(
      (i) => i.resource === "agent" && i.field === "name"
    );
    expect(nameUpdate).toBeDefined();
    expect(nameUpdate!.oldValue).toBe("my-agent");
    expect(nameUpdate!.newValue).toBe("new-agent");
  });

  it("detects model name change", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      model: { ...baseConfig.model, name: "claude-haiku-4-5-20251001" },
    };
    const result = plan(newConfig, state);
    const update = result.toUpdate.find((i) => i.resource === "model" && i.field === "name");
    expect(update).toBeDefined();
  });

  it("detects model provider change", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      model: { provider: "openai", name: "gpt-4o" },
    };
    const result = plan(newConfig, state);
    const update = result.toUpdate.find((i) => i.resource === "model" && i.field === "provider");
    expect(update).toBeDefined();
  });

  it("detects temperature change", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      model: { ...baseConfig.model, temperature: 0.9 },
    };
    const result = plan(newConfig, state);
    const update = result.toUpdate.find(
      (i) => i.resource === "model" && i.field === "temperature"
    );
    expect(update).toBeDefined();
  });

  it("detects new mcp_server added", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "npx search" }],
    };
    const result = plan(newConfig, state);
    const create = result.toCreate.find(
      (i) => i.resource === "mcp_server" && i.field === "search"
    );
    expect(create).toBeDefined();
  });

  it("detects mcp_server removed", () => {
    const configWithServer: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "npx search" }],
    };
    const state = makeState(configWithServer);
    const result = plan(baseConfig, state);
    const del = result.toDelete.find(
      (i) => i.resource === "mcp_server" && i.field === "search"
    );
    expect(del).toBeDefined();
  });

  it("detects mcp_server updated", () => {
    const configV1: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "npx search-v1" }],
    };
    const state = makeState(configV1);
    const configV2: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "npx search-v2" }],
    };
    const result = plan(configV2, state);
    const update = result.toUpdate.find(
      (i) => i.resource === "mcp_server" && i.field === "search"
    );
    expect(update).toBeDefined();
  });
});

describe("formatPlan", () => {
  it("shows 'No changes' when nothing changed", () => {
    const state = makeState(baseConfig);
    const result = plan(baseConfig, state);
    const formatted = formatPlan(result);
    expect(formatted).toContain("No changes");
  });

  it("shows count summary for changes", () => {
    const result = plan(baseConfig, null);
    const formatted = formatPlan(result);
    expect(formatted).toMatch(/\d+ to add/);
  });

  it("uses + prefix for creates", () => {
    const result = plan(baseConfig, null);
    const formatted = formatPlan(result);
    expect(formatted).toContain("+ ");
  });

  it("uses ~ prefix for updates", () => {
    const state = makeState(baseConfig);
    const newConfig: ForgeConfig = {
      ...baseConfig,
      agent: { name: "renamed-agent" },
    };
    const result = plan(newConfig, state);
    const formatted = formatPlan(result);
    expect(formatted).toContain("~ ");
  });

  it("uses - prefix for deletes", () => {
    const configWithServer: ForgeConfig = {
      ...baseConfig,
      mcp_servers: [{ name: "search", command: "cmd" }],
    };
    const state = makeState(configWithServer);
    const result = plan(baseConfig, state);
    const formatted = formatPlan(result);
    expect(formatted).toContain("- ");
  });
});
