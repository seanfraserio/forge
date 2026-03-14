import chalk from "chalk";
import { resolveEnvironment } from "../parser/validate.js";
import { loadConfig } from "../parser/load.js";
import { plan } from "../engine/planner.js";
import { readState } from "../engine/state.js";

export interface DiffCommandOptions {
  config: string;
  env: string;
}

export async function diffCommand(opts: DiffCommandOptions): Promise<void> {
  const baseConfig = await loadConfig(opts.config);
  const config = resolveEnvironment(baseConfig, opts.env);
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
