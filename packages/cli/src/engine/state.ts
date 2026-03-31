import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { AgentState, ForgeConfig } from "@openforge-ai/sdk";
import { redactConfig } from "../utils/redact.js";

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
  config: z.record(z.unknown()),
  endpoint: z.string().optional(),
  agentId: z.string().optional(),
}).strict();

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
    // Verify configHash integrity: re-hash the embedded config and compare
    const recomputedHash = hashConfig(validated.data.config as ForgeConfig);
    if (recomputedHash !== validated.data.configHash) {
      console.warn("Warning: State file integrity check failed (configHash mismatch). Treating as no prior state.");
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
 * Patterns that indicate secrets leaked into state content.
 * Checked against the serialized JSON before writing to disk.
 */
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,       // OpenAI / Anthropic API keys
  /ghp_[a-zA-Z0-9]{36}/,       // GitHub personal access tokens
  /ghs_[a-zA-Z0-9]{36}/,       // GitHub server tokens
  /glpat-[a-zA-Z0-9\-_]{20,}/, // GitLab PATs
  /AKIA[0-9A-Z]{16}/,          // AWS access key IDs
  /Bearer\s+[a-zA-Z0-9\-_.]+/, // Bearer tokens
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/, // PEM private keys
  /password\s*[:=]\s*\S+/i,    // password assignments
];

/**
 * Scan serialized state for leaked secrets. Throws if any pattern matches.
 */
function assertNoSecrets(serialized: string): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(
        `Refusing to write state: potential secret detected (matched ${pattern.source}). ` +
        "Ensure all sensitive values are redacted before persisting state."
      );
    }
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
  const serialized = JSON.stringify(state, null, 2);

  assertNoSecrets(serialized);

  await mkdir(stateDir, { recursive: true, mode: 0o700 });

  await writeFile(statePath, serialized, {
    encoding: "utf-8",
    mode: 0o600,
  });
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
