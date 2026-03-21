import { Command } from "commander";
import { deployCommand } from "./commands/deploy.js";
import { diffCommand } from "./commands/diff.js";
import { rollbackCommand } from "./commands/rollback.js";
import { validateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("forgeai")
  .description("Agent infrastructure as code — the Terraform for AI agents")
  .version("0.2.5");

program
  .command("deploy")
  .description("Deploy an agent from a forge.yaml configuration")
  .option("-c, --config <path>", "Path to forge.yaml", "forge.yaml")
  .option("-e, --env <environment>", "Target environment", "dev")
  .option("--auto-approve", "Skip confirmation prompt", false)
  .option("--dry-run", "Show plan without applying changes", false)
  .option("--allow-hooks", "Allow execution of pre_deploy and post_deploy hooks", false)
  .action((opts) => {
    return deployCommand({
      config: opts.config,
      env: opts.env,
      autoApprove: opts.autoApprove,
      dryRun: opts.dryRun,
      allowHooks: opts.allowHooks,
    });
  });

program
  .command("diff")
  .description("Show what would change between config and deployed state")
  .option("-c, --config <path>", "Path to forge.yaml", "forge.yaml")
  .option("-e, --env <environment>", "Target environment", "dev")
  .action((opts) => {
    return diffCommand({
      config: opts.config,
      env: opts.env,
    });
  });

program
  .command("rollback")
  .description("Roll back to a previous deployment state")
  .option("--target <hash>", "Target state hash to roll back to")
  .action((opts) => {
    return rollbackCommand({
      targetHash: opts.target,
    });
  });

program
  .command("validate")
  .description("Validate a forge.yaml configuration file")
  .option("-c, --config <path>", "Path to forge.yaml", "forge.yaml")
  .action((opts) => {
    return validateCommand({
      config: opts.config,
    });
  });

program.parse();
