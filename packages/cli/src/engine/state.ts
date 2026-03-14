import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { AgentState, ForgeConfig } from "@forge-ai/sdk";

const STATE_FILE = "state.json";

/**
 * Deep-sort all object keys recursively to ensure deterministic serialization.
 */
function sortDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map(key => [key, sortDeep(record[key])])
    );
  }
  return obj;
}

/**
 * Compute a deterministic SHA-256 hash of a normalized config.
 * Uses deep recursive key sorting for stable serialization.
 */
export function hashConfig(config: ForgeConfig): string {
  const normalized = JSON.stringify(sortDeep(config));
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Read the current agent state from .forge/state.json.
 * Returns null if no state file exists.
 */
export async function readState(stateDir: string): Promise<AgentState | null> {
  const statePath = join(stateDir, STATE_FILE);
  try {
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.configHash !== "string" ||
      typeof parsed.agentName !== "string"
    ) {
      console.warn("Warning: State file has invalid structure. Treating as no prior state.");
      return null;
    }
    return parsed as AgentState;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    console.warn("Warning: Failed to read state file. Treating as no prior state.");
    return null;
  }
}

/**
 * Write the agent state to .forge/state.json.
 * Creates the .forge directory if it doesn't exist.
 */
export async function writeState(
  stateDir: string,
  state: AgentState
): Promise<void> {
  const statePath = join(stateDir, STATE_FILE);

  await mkdir(stateDir, { recursive: true, mode: 0o700 });

  await writeFile(statePath, JSON.stringify(state, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

/**
 * Deep-clone a config and redact sensitive values from MCP server env vars.
 */
function redactConfig(config: ForgeConfig): ForgeConfig {
  const cloned = JSON.parse(JSON.stringify(config)) as ForgeConfig;
  if (cloned.tools?.mcp_servers) {
    for (const server of cloned.tools.mcp_servers) {
      if (server.env) {
        for (const [key, value] of Object.entries(server.env)) {
          // Keep ${VAR} template references as-is for accurate diffing
          // Only redact values that appear to be resolved secrets
          if (!/^\$\{.+\}$/.test(value)) {
            server.env[key] = "[REDACTED]";
          }
        }
      }
    }
  }
  return cloned;
}

/**
 * Create an AgentState snapshot from a config and environment.
 */
export function createState(
  config: ForgeConfig,
  environment: string
): AgentState {
  return {
    configHash: hashConfig(config),
    lastDeployed: new Date().toISOString(),
    environment,
    agentName: config.agent.name,
    config: redactConfig(config),
  };
}
