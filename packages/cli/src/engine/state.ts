import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import type { AgentState, ForgeConfig } from "@forge-ai/sdk";

const STATE_FILE = "state.json";

/**
 * Deep-sort all object keys recursively to ensure deterministic serialization.
 */
function sortDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = sortDeep((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
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
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.configHash !== "string" ||
      typeof parsed.agentName !== "string"
    ) {
      console.warn(
        "Warning: State file is missing required fields (configHash, agentName). Treating as no prior state."
      );
      return null;
    }
    return parsed as AgentState;
  } catch {
    console.warn("Warning: Failed to parse state file. Treating as no prior state.");
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
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
  }

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
        for (const key of Object.keys(server.env)) {
          server.env[key] = "[REDACTED]";
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
