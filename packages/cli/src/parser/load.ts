import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { parseForgeYaml } from "./validate.js";
import type { ForgeConfig } from "@forge-ai/sdk";

export async function loadConfig(configPath: string): Promise<ForgeConfig> {
  const resolved = resolve(configPath);
  console.log(chalk.blue("→ Reading configuration from"), resolved);

  let raw: string;
  try {
    raw = await readFile(resolved, "utf-8");
  } catch {
    console.error(chalk.red("✗ Could not read config file:"), resolved);
    process.exit(1);
  }

  const result = parseForgeYaml(raw);
  if (!result.success || !result.config) {
    console.error(chalk.red("✗ Validation errors:"));
    for (const err of result.errors ?? []) {
      console.error(chalk.red(`  • ${err}`));
    }
    process.exit(1);
  }

  return result.config;
}
