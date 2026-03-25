import chalk from "chalk";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveEnvironment } from "../parser/validate.js";
import { loadConfig } from "../parser/load.js";
import { plan, formatPlan } from "../engine/planner.js";
import { apply } from "../engine/applier.js";
import { readState } from "../engine/state.js";
import type { ApplyOptions } from "@openforge-ai/sdk";

const execFileAsync = promisify(execFile);

/**
 * Redact common secret patterns from hook output before printing to console.
 */
function redactOutput(text: string): string {
  return text
    .replace(/password\s*=\s*\S+/gi, "password=[REDACTED]")
    .replace(/token\s*=\s*\S+/gi, "token=[REDACTED]")
    .replace(/Bearer\s+[a-zA-Z0-9\-_.]+/g, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]")
    .replace(/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]");
}

export interface DeployCommandOptions {
  config: string;
  env: string;
  autoApprove: boolean;
  dryRun: boolean;
  allowHooks: boolean;
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function runHook(command: string, label: string): Promise<void> {
  console.log(chalk.dim(`  Running ${label}: ${redactOutput(command)}`));
  try {
    const { stdout, stderr } = await execFileAsync("/bin/sh", ["-c", command], {
      timeout: 60_000,
    });
    if (stdout.trim()) console.log(chalk.dim(`  ${redactOutput(stdout.trim())}`));
    if (stderr.trim()) console.warn(chalk.yellow(`  ${redactOutput(stderr.trim())}`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Hook "${label}" failed: ${redactOutput(msg)}`);
  }
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

  // 5. Dry run — show plan only
  if (opts.dryRun) {
    console.log(chalk.yellow("\n⚠ Dry run — no changes applied."));
    return;
  }

  // 6. Confirm (unless auto-approve)
  if (!opts.autoApprove) {
    const approved = await confirm(chalk.yellow("\nDo you want to apply these changes?"));
    if (!approved) {
      console.log(chalk.dim("Deploy cancelled."));
      return;
    }
  }

  // 7. Run pre-deploy hooks
  const preHooks = config.hooks?.pre_deploy ?? [];
  const postHooks = config.hooks?.post_deploy ?? [];

  if (preHooks.length > 0 || postHooks.length > 0) {
    if (!opts.allowHooks) {
      console.log(chalk.yellow("\n⚠ Hooks detected but --allow-hooks not set:"));
      for (const hook of preHooks) {
        console.log(chalk.yellow(`  pre_deploy:  ${hook.run}`));
      }
      for (const hook of postHooks) {
        console.log(chalk.yellow(`  post_deploy: ${hook.run}`));
      }
      console.log(chalk.yellow("  Skipping hook execution.\n"));
    } else {
      for (const hook of preHooks) {
        await runHook(hook.run, "pre_deploy");
      }
    }
  }

  // 8. Apply
  const applyOpts: ApplyOptions = {
    dryRun: false,
    environment: opts.env,
    autoApprove: opts.autoApprove,
  };

  try {
    const result = await apply(planResult, config, applyOpts);

    console.log(chalk.green(`\n✓ Agent "${config.agent.name}" deployed to ${opts.env}`));
    if (result.state.endpoint) {
      console.log(chalk.dim(`  Endpoint: ${result.state.endpoint}`));
    }
    console.log(chalk.dim(`  Config hash: ${result.state.configHash.slice(0, 12)}...`));
    console.log(chalk.dim(`  State written to .forge/state.json`));

    // 9. Run post-deploy hooks
    if (opts.allowHooks) {
      for (const hook of postHooks) {
        await runHook(hook.run, "post_deploy");
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\n✗ Deploy failed: ${msg}`));
    process.exit(1);
  }
}
