import { describe, it, expect } from "vitest";
import { parseForgeYaml } from "../../parser/validate.js";

// The validateCommand calls process.exit(), so we test the underlying parser directly.
// Integration-level tests for the CLI command itself are covered by config.test.ts.

describe("validate — parser integration", () => {
  it("succeeds for a fully-featured valid config", () => {
    const yaml = `
version: "1"
agent:
  name: prod-agent
  description: A production agent
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.3
  max_tokens: 4096
system_prompt:
  inline: "You are a helpful assistant."
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
memory:
  type: in-context
environments:
  production:
    model:
      temperature: 0.1
hooks:
  pre_deploy:
    - run: "npm test"
  post_deploy:
    - run: "echo deployed"
`;
    const result = parseForgeYaml(yaml);
    if (!result.success) throw new Error("Expected success");
    expect(result.config.agent.name).toBe("prod-agent");
    expect(result.config.hooks?.pre_deploy?.[0].run).toBe("npm test");
  });

  it("collects multiple errors", () => {
    const yaml = `
version: "1"
agent:
  name: "Invalid Name"
model:
  provider: azure
  name: ""
`;
    const result = parseForgeYaml(yaml);
    if (result.success) throw new Error("Expected failure");
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("error messages identify the field path", () => {
    const yaml = `
version: "1"
agent:
  name: "Bad Name"
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
`;
    const result = parseForgeYaml(yaml);
    if (result.success) throw new Error("Expected failure");
    // Error should mention agent.name
    expect(result.errors.some((e) => e.includes("agent.name"))).toBe(true);
  });

  it("accepts hyphens in agent name", () => {
    const yaml = `
version: "1"
agent:
  name: my-cool-agent-123
model:
  provider: openai
  name: gpt-4o
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(true);
  });

  it("rejects agent name with spaces", () => {
    const yaml = `
version: "1"
agent:
  name: "my cool agent"
model:
  provider: openai
  name: gpt-4o
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(false);
  });

  it("rejects temperature out of range", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: openai
  name: gpt-4o
  temperature: 3.0
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(false);
  });

  it("rejects negative max_tokens", () => {
    const yaml = `
version: "1"
agent:
  name: my-agent
model:
  provider: openai
  name: gpt-4o
  max_tokens: -100
`;
    const result = parseForgeYaml(yaml);
    expect(result.success).toBe(false);
  });
});
