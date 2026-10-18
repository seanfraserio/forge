import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCommand } from "../../commands/validate.js";
import { diffCommand } from "../../commands/diff.js";
import { deployCommand } from "../../commands/deploy.js";
import { readState } from "../../engine/state.js";

vi.mock("../../engine/adapter-resolver.js", () => ({
  resolveAdapter: vi.fn(() => ({
    validateModel: (model: { name: string }) => model.name.startsWith("claude-"),
    deploy: async () => ({
      success: true,
      endpoint: "mock://local-adapter",
      agentId: "agent-local-1",
    }),
  })),
}));

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
  dirs.length = 0;
  vi.restoreAllMocks();
});

async function fixture(yaml: string): Promise<{ root: string; configPath: string; stateDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "forge-lifecycle-"));
  dirs.push(root);
  const configPath = join(root, "forge.yaml");
  await writeFile(configPath, yaml);
  return { root, configPath, stateDir: join(root, ".forge") };
}

const baseYaml = `
version: "1"
agent:
  name: lifecycle-agent
  description: local mock lifecycle
model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.2
mcp_servers:
  - name: search
    command: npx search-server
    env:
      API_TOKEN: "\${SEARCH_TOKEN}"
`;

describe("local mock lifecycle", () => {
  it("validates, diffs, deploys, repeats without a second adapter call, and has no rollback command", async () => {
    const { configPath, stateDir } = await fixture(baseYaml);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as typeof process.exit);

    await validateCommand({ config: configPath });
    expect(log.mock.calls.some((call) => String(call[0]).includes("Configuration is valid"))).toBe(true);
    expect(exit).not.toHaveBeenCalled();

    log.mockClear();
    await diffCommand({ config: configPath, env: "dev", stateDir });
    const firstDiff = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(firstDiff).toContain("Create agent");
    expect(firstDiff).toContain("${SEARCH_TOKEN}");
    expect(firstDiff).not.toMatch(/API_TOKEN": "(?!\$\{)/);

    const { resolveAdapter } = await import("../../engine/adapter-resolver.js");
    await deployCommand({
      config: configPath,
      env: "dev",
      autoApprove: true,
      dryRun: false,
      allowHooks: false,
      stateDir,
    });

    const deployed = await readState(stateDir);
    expect(deployed).not.toBeNull();
    expect(deployed!.agentName).toBe("lifecycle-agent");
    expect(deployed!.endpoint).toBe("mock://local-adapter");
    expect(deployed!.agentId).toBe("agent-local-1");
    expect(deployed!.config.mcp_servers?.[0]?.env?.API_TOKEN).toBe("${SEARCH_TOKEN}");
    expect(vi.mocked(resolveAdapter).mock.calls.length).toBeGreaterThan(0);
    const deploysAfterFirst = vi.mocked(resolveAdapter).mock.results.length;

    log.mockClear();
    await diffCommand({ config: configPath, env: "dev", stateDir });
    const secondDiff = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(secondDiff).toContain("No changes");

    log.mockClear();
    await deployCommand({
      config: configPath,
      env: "dev",
      autoApprove: true,
      dryRun: false,
      allowHooks: false,
      stateDir,
    });
    expect(vi.mocked(resolveAdapter).mock.results.length).toBe(deploysAfterFirst);
    const repeated = await readState(stateDir);
    expect(repeated!.configHash).toBe(deployed!.configHash);
    expect(repeated!.lastDeployed).toBe(deployed!.lastDeployed);

    const { readFile } = await import("node:fs/promises");
    const cli = await readFile(new URL("../../index.ts", import.meta.url), "utf8");
    expect(cli).not.toContain('.command("rollback")');
    expect(error).not.toHaveBeenCalled();
  });
});
