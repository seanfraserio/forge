import chalk from "chalk";
import { resolveEnvironment } from "../parser/validate.js";
import { loadConfig } from "../parser/load.js";
import { plan, formatPlan } from "../engine/planner.js";
import { apply } from "../engine/applier.js";
import { readState } from "../engine/state.js";
import type { ApplyOptions } from "@openforge-ai/sdk";

export interface DeployCommandOptions {
  config: string;
  env: string;
  autoApprove: boolean;
  dryRun: boolean;
  allowHooks: boolean;
}

export async function deployCommand(opts: DeployCommandOptions): Promise<void> {
  // 1. Read and parse forge.yaml
  const baseConfig = await loadConfig(opts.config);

  // 2. Resolve environment overrides
  const config = resolveEnvironment(baseConfig, opts.env);
  console.log(
    chalk.blue("→ Agent:"),
    config.agent.name,
    chalk.blue("| Environment:"),
    opts.env,
    chalk.blue("| Model:"),
    `${config.model.provider}/${config.model.name}`
  );

  // 3. Load current state
  const currentState = await readState(".forge");

  // 4. Generate plan
  const planResult = plan(config, currentState);
  console.log("\n" + formatPlan(planResult));

  if (!planResult.hasChanges) {
    return;
  }

  // 5. Confirm (unless auto-approve or dry-run)
  if (opts.dryRun) {
    console.log(chalk.yellow("\n⚠ Dry run — no changes applied."));
    return;
  }

  if (!opts.autoApprove) {
    console.log(chalk.yellow("\nDo you want to apply these changes?"));
    console.log(chalk.dim("  Use --auto-approve to skip this prompt.\n"));
    // In a real CLI, we'd use readline for confirmation
    // For the scaffold, auto-approve by default
  }

  // 6. Warn about hooks
  const preHooks = config.hooks?.pre_deploy ?? [];
  const postHooks = config.hooks?.post_deploy ?? [];
  if (preHooks.length > 0 || postHooks.length > 0) {
    console.log(chalk.yellow("\n⚠ Hooks detected in configuration:"));
    for (const hook of preHooks) {
      console.log(chalk.yellow(`  pre_deploy:  ${hook.run}`));
    }
    for (const hook of postHooks) {
      console.log(chalk.yellow(`  post_deploy: ${hook.run}`));
    }
    if (!opts.allowHooks) {
      console.log(
        chalk.yellow("  Hooks will NOT be executed. Pass --allow-hooks to enable hook execution.\n")
      );
    }
  }

  // 7. Apply
  const applyOpts: ApplyOptions = {
    dryRun: opts.dryRun,
    environment: opts.env,
    autoApprove: opts.autoApprove,
  };

  const result = await apply(planResult, config, applyOpts);

  if (result.success) {
    console.log(chalk.green(`\n✓ Agent "${config.agent.name}" deployed to ${opts.env}`));
    if (result.state.endpoint) {
      console.log(chalk.dim(`  Endpoint: ${result.state.endpoint}`));
    }
    console.log(chalk.dim(`  Config hash: ${result.state.configHash.slice(0, 12)}...`));
    console.log(chalk.dim(`  State written to .forge/state.json`));
  } else {
    console.error(chalk.red(`\n✗ Deploy failed: ${result.error}`));
    process.exit(1);
  }
}
