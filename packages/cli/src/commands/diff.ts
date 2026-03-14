import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { parseForgeYaml, resolveEnvironment } from "../parser/validate.js";
import { plan } from "../engine/planner.js";
import { readState } from "../engine/state.js";

export interface DiffCommandOptions {
  config: string;
  env: string;
}

export async function diffCommand(opts: DiffCommandOptions): Promise<void> {
  const configPath = resolve(opts.config);

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    console.error(chalk.red("✗ Could not read config file:"), configPath);
    process.exit(1);
  }

  const parsed = parseForgeYaml(raw);
  if (!parsed.success || !parsed.config) {
    console.error(chalk.red("✗ Validation errors:"));
    for (const err of parsed.errors ?? []) {
      console.error(chalk.red(`  • ${err}`));
    }
    process.exit(1);
  }

  const config = resolveEnvironment(parsed.config, opts.env);
  const currentState = await readState(".forge");
  const planResult = plan(config, currentState);

  // Output colored diff
  if (!planResult.hasChanges) {
    console.log(chalk.green("✓ No changes. Infrastructure matches configuration."));
    return;
  }

  for (const item of planResult.toCreate) {
    console.log(chalk.green(`+ ${item.summary}`));
    if (item.newValue) {
      const lines = JSON.stringify(item.newValue, null, 2).split("\n");
      for (const line of lines) {
        console.log(chalk.green(`  + ${line}`));
      }
    }
  }

  for (const item of planResult.toUpdate) {
    console.log(chalk.yellow(`~ ${item.summary}`));
    if (item.oldValue !== undefined) {
      console.log(chalk.red(`  - ${JSON.stringify(item.oldValue)}`));
    }
    if (item.newValue !== undefined) {
      console.log(chalk.green(`  + ${JSON.stringify(item.newValue)}`));
    }
  }

  for (const item of planResult.toDelete) {
    console.log(chalk.red(`- ${item.summary}`));
  }
}
