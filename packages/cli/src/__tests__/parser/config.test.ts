import { describe, it, expect } from "vitest";
import { parseForgeYaml, resolveEnvironment } from "../../parser/validate.js";

const minimalValidYaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
`;

describe("parseForgeYaml — valid configs", () => {
  it("parses minimal valid config", () => {
    const result = parseForgeYaml(minimalValidYaml);
    expect(result.success).toBe(true);
    expect(result.config?.agent.name).toBe("my-agent");
    expect(result.config?.model.provider).toBe("anthropic");
  });

  it("parses all provider types", () => {
    for (const provider of ["anthropic", "openai", "google", "ollama", "bedrock"]) {
      const yaml = `
version: "1"
agent:
  name: test-bot
model:
  provider: ${provider}
  name: some-model
`;
      const result = parseForgeYaml(yaml);
      expect(result.success).toBe(true);
    }
  });

  it("parses optional temperature and max_tokens", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: openai
  name: gpt-4o
  temperature: 0.7
  max_tokens: 2048
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.config?.model.temperature).toBe(0.7);
    expect(result.config?.model.max_tokens).toBe(2048);
  });

  it("parses system_prompt with inline", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
system_prompt:
  inline: "You are a helpful assistant."
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.config?.system_prompt?.inline).toBe("You are a helpful assistant.");
  });

  it("parses system_prompt with file", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
system_prompt:
  file: prompts/system.txt
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.config?.system_prompt?.file).toBe("prompts/system.txt");
  });

  it("parses mcp_servers", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
tools:
  mcp_servers:
    - name: search
      command: npx
      args: ["-y", "search-server"]
      env:
        API_KEY: "\${SEARCH_API_KEY}"
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    const server = result.config?.tools?.mcp_servers?.[0];
    expect(server?.name).toBe("search");
    expect(server?.args).toEqual(["-y", "search-server"]);
  });

  it("parses memory config", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
memory:
  type: vector
  provider: chroma
  collection: agent-memory
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.config?.memory?.type).toBe("vector");
    expect(result.config?.memory?.provider).toBe("chroma");
  });

  it("parses environments block", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
environments:
  production:
    model:
      temperature: 0.1
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.config?.environments?.production?.model?.temperature).toBe(0.1);
  });
});

describe("parseForgeYaml — error handling", () => {
  it("rejects invalid YAML syntax", () => {
    const result = parseForgeYaml(":\n  bad: [yaml: here");
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/YAML parse error/i);
  });

  it("rejects missing version", () => {
    const result = parseForgeYaml(`
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
`);
    expect(result.success).toBe(false);
  });

  it("rejects invalid agent name (uppercase)", () => {
    const result = parseForgeYaml(`
version: "1"
agent:
  name: MyAgent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
`);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.toLowerCase().includes("name"))).toBe(true);
  });

  it("rejects invalid provider", () => {
    const result = parseForgeYaml(`
version: "1"
agent:
  name: my-agent
model:
  provider: azure
  name: gpt-4
`);
    expect(result.success).toBe(false);
  });

  it("rejects system_prompt with neither file nor inline", () => {
    const result = parseForgeYaml(`
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
system_prompt:
  file:
`);
    expect(result.success).toBe(false);
  });

  it("rejects vector memory without provider", () => {
    const result = parseForgeYaml(`
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
memory:
  type: vector
`);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("provider"))).toBe(true);
  });

  it("includes field path in error messages", () => {
    const result = parseForgeYaml(`
version: "1"
agent:
  name: 123
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
`);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("agent"))).toBe(true);
  });
});

describe("resolveEnvironment", () => {
  const config = parseForgeYaml(`
version: "1"
agent:
  name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.7
environments:
  production:
    model:
      temperature: 0.1
  staging:
    model:
      name: claude-haiku-4-5-20251001
`).config!;

  it("returns base config when env not found", () => {
    const resolved = resolveEnvironment(config, "dev");
    expect(resolved.model.temperature).toBe(0.7);
    expect(resolved).toBe(config);
  });

  it("merges model overrides for matching env", () => {
    const resolved = resolveEnvironment(config, "production");
    expect(resolved.model.temperature).toBe(0.1);
    expect(resolved.model.provider).toBe("anthropic"); // preserved from base
  });

  it("merges model name override", () => {
    const resolved = resolveEnvironment(config, "staging");
    expect(resolved.model.name).toBe("claude-haiku-4-5-20251001");
  });

  it("does not mutate original config", () => {
    resolveEnvironment(config, "production");
    expect(config.model.temperature).toBe(0.7);
  });
});
