import { describe, it, expect } from "vitest";
import { ForgeClient } from "../client.js";

describe("ForgeClient — construction", () => {
  it("uses defaults when no options provided", () => {
    const client = new ForgeClient();
    expect(client.getConfigPath()).toBe("forge.yaml");
    expect(client.getStateDir()).toBe(".forge");
    expect(client.getEnvironment()).toBe("dev");
  });

  it("uses provided configPath", () => {
    const client = new ForgeClient({ configPath: "custom/path.yaml" });
    expect(client.getConfigPath()).toBe("custom/path.yaml");
  });

  it("uses provided stateDir", () => {
    const client = new ForgeClient({ stateDir: ".my-state" });
    expect(client.getStateDir()).toBe(".my-state");
  });

  it("uses provided environment", () => {
    const client = new ForgeClient({ environment: "production" });
    expect(client.getEnvironment()).toBe("production");
  });

  it("accepts all options together", () => {
    const client = new ForgeClient({
      configPath: "forge.yaml",
      stateDir: ".forge-prod",
      environment: "staging",
    });
    expect(client.getConfigPath()).toBe("forge.yaml");
    expect(client.getStateDir()).toBe(".forge-prod");
    expect(client.getEnvironment()).toBe("staging");
  });
});

describe("ForgeClient — unimplemented methods", () => {
  it("loadConfig throws not implemented", async () => {
    const client = new ForgeClient();
    await expect(client.loadConfig()).rejects.toThrow(/not implemented/i);
  });

  it("plan throws not implemented", async () => {
    const client = new ForgeClient();
    const config = {
      version: "1" as const,
      agent: { name: "bot" },
      model: { provider: "anthropic" as const, name: "claude-sonnet-4-5-20251001" },
    };
    await expect(client.plan(config)).rejects.toThrow(/not implemented/i);
  });

  it("apply throws not implemented", async () => {
    const client = new ForgeClient();
    const fakePlan = {
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      noChange: [],
      hasChanges: false,
    };
    await expect(client.apply(fakePlan)).rejects.toThrow(/not implemented/i);
  });

  it("getState throws not implemented", async () => {
    const client = new ForgeClient();
    await expect(client.getState()).rejects.toThrow(/not implemented/i);
  });
});
