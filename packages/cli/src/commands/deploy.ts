import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { parseForgeYaml, resolveEnvironment } from "../parser/validate.js";
import { plan, formatPlan } from "../engine/planner.js";
import { apply } from "../engine/applier.js";
import { readState } from "../engine/state.js";
import type { ApplyOptions } from "@forge-ai/sdk";

export interface DeployCommandOptions {
  config: string;
  env: string;
  autoApprove: boolean;
  dryRun: boolean;
}

export async function deployCommand(opts: DeployCommandOptions): Promise<void> {
  const configPath = resolve(opts.config);

  // 1. Read and parse forge.yaml
  console.log(chalk.blue("→ Reading configuration from"), configPath);
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

  // 2. Resolve environment overrides
  const config = resolveEnvironment(parsed.config, opts.env);
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

  // 6. Apply
  const applyOpts: ApplyOptions = {
    dryRun: opts.dryRun,
    environment: opts.env,
    autoApprove: opts.autoApprove,
  };

  const result = await apply(planResult, config, applyOpts);

  if (result.success) {
    console.log(chalk.green(`\n✓ Successfully deployed "${config.agent.name}" to ${opts.env}`));
    console.log(chalk.dim(`  State written to .forge/state.json`));
    console.log(chalk.dim(`  Config hash: ${result.state.configHash.slice(0, 12)}...`));
  } else {
    console.error(chalk.red(`\n✗ Deploy failed: ${result.error}`));
    process.exit(1);
  }
}
