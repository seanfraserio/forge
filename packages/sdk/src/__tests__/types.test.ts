import { describe, it, expect } from "vitest";
import type {
  ForgeConfig,
  AgentConfig,
  ModelConfig,
  SystemPromptConfig,
  ToolsConfig,
  McpServerConfig,
  MemoryConfig,
  AgentState,
  PlanResult,
  PlanItem,
  ApplyOptions,
  ApplyResult,
  ForgeClientOptions,
} from "../types.js";

// Type-level tests: verify shapes compile and runtime values satisfy constraints.

describe("ForgeConfig type", () => {
  it("constructs a minimal valid ForgeConfig", () => {
    const config: ForgeConfig = {
      version: "1",
      agent: { name: "my-agent" },
      model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
    };
    expect(config.version).toBe("1");
    expect(config.agent.name).toBe("my-agent");
  });

  it("allows all optional fields", () => {
    const config: ForgeConfig = {
      version: "1",
      agent: { name: "full-agent", description: "desc" },
      model: {
        provider: "openai",
        name: "gpt-4o",
        temperature: 0.7,
        max_tokens: 4096,
      },
      system_prompt: { inline: "You are helpful." },
      tools: {
        mcp_servers: [{ name: "search", command: "npx search" }],
      },
      memory: { type: "in-context" },
      environments: {
        prod: { model: { temperature: 0.1 } },
      },
      hooks: {
        pre_deploy: [{ run: "npm test" }],
        post_deploy: [{ run: "echo done" }],
      },
    };
    expect(config.model.temperature).toBe(0.7);
    expect(config.hooks?.pre_deploy?.[0].run).toBe("npm test");
  });

  it("supports all ModelProvider values", () => {
    const providers = ["anthropic", "openai", "google", "ollama", "bedrock"] as const;
    for (const provider of providers) {
      const config: ForgeConfig = {
        version: "1",
        agent: { name: "bot" },
        model: { provider, name: "some-model" },
      };
      expect(config.model.provider).toBe(provider);
    }
  });

  it("supports all MemoryType values", () => {
    const types = ["none", "in-context", "vector"] as const;
    for (const type of types) {
      const mem: MemoryConfig = { type };
      expect(mem.type).toBe(type);
    }
  });

  it("supports all MemoryProvider values", () => {
    const providers = ["chroma", "pinecone", "weaviate"] as const;
    for (const provider of providers) {
      const mem: MemoryConfig = { type: "vector", provider };
      expect(mem.provider).toBe(provider);
    }
  });
});

describe("AgentState type", () => {
  it("constructs a valid AgentState", () => {
    const config: ForgeConfig = {
      version: "1",
      agent: { name: "bot" },
      model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
    };
    const state: AgentState = {
      configHash: "abc123",
      lastDeployed: new Date().toISOString(),
      environment: "production",
      agentName: "bot",
      config,
    };
    expect(state.configHash).toBe("abc123");
    expect(state.environment).toBe("production");
  });

  it("allows optional agentVersion", () => {
    const state: AgentState = {
      configHash: "hash",
      lastDeployed: "2025-01-01T00:00:00Z",
      environment: "dev",
      agentName: "bot",
      agentVersion: "1.2.3",
      config: {
        version: "1",
        agent: { name: "bot" },
        model: { provider: "anthropic", name: "model" },
      },
    };
    expect(state.agentVersion).toBe("1.2.3");
  });
});

describe("PlanResult type", () => {
  it("constructs empty plan result", () => {
    const result: PlanResult = {
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      noChange: [],
      hasChanges: false,
    };
    expect(result.hasChanges).toBe(false);
  });

  it("constructs plan with items", () => {
    const item: PlanItem = {
      resource: "agent",
      field: "name",
      oldValue: "old",
      newValue: "new",
      summary: "Rename agent",
    };
    const result: PlanResult = {
      toCreate: [],
      toUpdate: [item],
      toDelete: [],
      noChange: [],
      hasChanges: true,
    };
    expect(result.toUpdate[0].resource).toBe("agent");
  });
});

describe("ApplyOptions and ApplyResult types", () => {
  it("constructs valid ApplyOptions", () => {
    const opts: ApplyOptions = {
      dryRun: false,
      environment: "dev",
      autoApprove: true,
    };
    expect(opts.dryRun).toBe(false);
  });

  it("constructs valid ApplyResult", () => {
    const state: AgentState = {
      configHash: "hash",
      lastDeployed: "2025-01-01T00:00:00Z",
      environment: "dev",
      agentName: "bot",
      config: {
        version: "1",
        agent: { name: "bot" },
        model: { provider: "anthropic", name: "model" },
      },
    };
    const result: ApplyResult = {
      success: true,
      applied: [],
      skipped: [],
      state,
    };
    expect(result.success).toBe(true);
  });
});

describe("ForgeClientOptions type", () => {
  it("allows all fields to be optional", () => {
    const opts: ForgeClientOptions = {};
    expect(opts.configPath).toBeUndefined();
  });

  it("accepts all fields", () => {
    const opts: ForgeClientOptions = {
      configPath: "path/to/forge.yaml",
      stateDir: ".forge",
      environment: "production",
    };
    expect(opts.environment).toBe("production");
  });
});
