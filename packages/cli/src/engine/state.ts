import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import type { AgentState, ForgeConfig } from "@forge-ai/sdk";

const STATE_FILE = "state.json";

/**
 * Compute a deterministic SHA-256 hash of a normalized config.
 * Used to detect config drift.
 */
export function hashConfig(config: ForgeConfig): string {
  // Normalize by sorting keys via JSON.stringify replacer
  const normalized = JSON.stringify(config, Object.keys(config).sort());
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
    return JSON.parse(raw) as AgentState;
  } catch {
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
    await mkdir(dir, { recursive: true });
  }

  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
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
    config,
  };
}
