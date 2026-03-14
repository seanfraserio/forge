import chalk from "chalk";
import { readState } from "../engine/state.js";

export interface RollbackCommandOptions {
  targetHash?: string;
}

// TODO: Implement full rollback by storing state history
export async function rollbackCommand(opts: RollbackCommandOptions): Promise<void> {
  const currentState = await readState(".forge");

  if (!currentState) {
    console.error(chalk.red("✗ No state found. Nothing to roll back."));
    process.exit(1);
  }

  console.log(chalk.blue("→ Current state:"));
  console.log(chalk.dim(`  Agent: ${currentState.agentName}`));
  console.log(chalk.dim(`  Environment: ${currentState.environment}`));
  console.log(chalk.dim(`  Deployed: ${currentState.lastDeployed}`));
  console.log(chalk.dim(`  Hash: ${currentState.configHash.slice(0, 12)}...`));

  if (opts.targetHash) {
    console.log(chalk.yellow(`\n⚠ Rollback to ${opts.targetHash} is not yet implemented.`));
    console.log(chalk.dim("  State history tracking coming in a future release."));
  } else {
    console.log(chalk.yellow("\n⚠ Specify a target hash to roll back to."));
    console.log(chalk.dim("  Usage: forge rollback --target <hash>"));
  }
}
