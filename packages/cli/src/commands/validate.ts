import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { parseForgeYaml } from "../parser/validate.js";
import { resolveAdapter } from "../engine/adapter-resolver.js";

export interface ValidateCommandOptions {
  config: string;
}

export async function validateCommand(opts: ValidateCommandOptions): Promise<void> {
  const configPath = resolve(opts.config);

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    console.error(chalk.red("✗ Could not read config file:"), configPath);
    process.exit(1);
  }

  const result = parseForgeYaml(raw);

  if (result.success) {
    const config = result.config;

    // Validate model against the adapter
    const adapter = resolveAdapter(config);
    if (!adapter.validateModel(config.model)) {
      console.error(chalk.red(`✗ Model '${config.model.name}' is not supported by provider '${config.model.provider}'`));
      process.exit(1);
    }

    console.log(chalk.green("✓ Configuration is valid."));
    console.log(chalk.dim(`  Agent: ${config.agent.name}`));
    console.log(chalk.dim(`  Model: ${config.model.provider}/${config.model.name}`));
    if (config.environments) {
      const envs = Object.keys(config.environments);
      console.log(chalk.dim(`  Environments: ${envs.join(", ")}`));
    }
  } else {
    console.error(chalk.red("✗ Validation failed:"));
    for (const err of result.errors) {
      console.error(chalk.red(`  • ${err}`));
    }
    process.exit(1);
  }
}
