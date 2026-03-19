import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { AgentState, ForgeConfig } from "@openforge-ai/sdk";

/**
 * Zod schema for validating state.json structure.
 * Protects against tampered state files and prototype pollution.
 */
const agentStateSchema = z.object({
  configHash: z.string(),
  lastDeployed: z.string(),
  environment: z.string(),
  agentName: z.string(),
  agentVersion: z.string().optional(),
  config: z.object({}).passthrough(),
  endpoint: z.string().optional(),
  agentId: z.string().optional(),
}).passthrough();

const STATE_FILE = "state.json";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate stateDir against path traversal attacks.
 * Rejects paths containing '..' segments to prevent writing outside the intended directory.
 */
function validateStateDir(stateDir: string): void {
  if (stateDir.includes("..")) {
    throw new Error(`stateDir must not contain path traversal ('..').  Got: ${stateDir}`);
  }
}

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
  validateStateDir(stateDir);
  const statePath = join(stateDir, STATE_FILE);
  try {
    // Check file size before reading into memory
    const fileStat = await stat(statePath);
    if (fileStat.size > MAX_FILE_SIZE) {
      console.warn(`Warning: State file too large (${fileStat.size} bytes). Treating as no prior state.`);
      return null;
    }
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = agentStateSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn("Warning: State file has invalid structure. Treating as no prior state.");
      return null;
    }
    // Cast through unknown: Zod validates the envelope structure,
    // but the nested config object is opaque at the state-validation level
    return validated.data as unknown as AgentState;
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
  validateStateDir(stateDir);
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
export function redactConfig(config: ForgeConfig): ForgeConfig {
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
