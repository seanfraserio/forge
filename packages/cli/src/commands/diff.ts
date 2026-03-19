import chalk from "chalk";
import { resolveEnvironment } from "../parser/validate.js";
import { loadConfig } from "../parser/load.js";
import { plan } from "../engine/planner.js";
import { readState } from "../engine/state.js";

export interface DiffCommandOptions {
  config: string;
  env: string;
}

/**
 * Redact potential secrets from plan item values before displaying.
 * Replaces MCP server env var values with [REDACTED] in display output.
 */
function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  // Redact env values in MCP server objects
  if (obj.env && typeof obj.env === "object") {
    const redacted = { ...obj, env: { ...obj.env as Record<string, string> } };
    for (const key of Object.keys(redacted.env as Record<string, string>)) {
      const val = (redacted.env as Record<string, string>)[key];
      if (!/^\$\{.+\}$/.test(val)) {
        (redacted.env as Record<string, string>)[key] = "[REDACTED]";
      }
    }
    return redacted;
  }
  return value;
}

export async function diffCommand(opts: DiffCommandOptions): Promise<void> {
  const baseConfig = await loadConfig(opts.config);
  const config = resolveEnvironment(baseConfig, opts.env);
  const currentState = await readState(".forge");
  // Plan against unredacted config for correct hash comparison
  const planResult = plan(config, currentState);

  // Output colored diff
  if (!planResult.hasChanges) {
    console.log(chalk.green("✓ No changes. Infrastructure matches configuration."));
    return;
  }

  for (const item of planResult.toCreate) {
    console.log(chalk.green(`+ ${item.summary}`));
    if (item.newValue) {
      const lines = JSON.stringify(redactValue(item.newValue), null, 2).split("\n");
      for (const line of lines) {
        console.log(chalk.green(`  + ${line}`));
      }
    }
  }

  for (const item of planResult.toUpdate) {
    console.log(chalk.yellow(`~ ${item.summary}`));
    if (item.oldValue !== undefined) {
      console.log(chalk.red(`  - ${JSON.stringify(redactValue(item.oldValue))}`));
    }
    if (item.newValue !== undefined) {
      console.log(chalk.green(`  + ${JSON.stringify(redactValue(item.newValue))}`));
    }
  }

  for (const item of planResult.toDelete) {
    console.log(chalk.red(`- ${item.summary}`));
  }
}
