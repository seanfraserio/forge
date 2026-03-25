import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { parseForgeYaml } from "./validate.js";
import type { ForgeConfig } from "@openforge-ai/sdk";

const MAX_CONFIG_SIZE = 1024 * 1024; // 1MB

export async function loadConfig(configPath: string): Promise<ForgeConfig> {
  const resolved = resolve(configPath);
  console.log(chalk.blue("→ Reading configuration from"), resolved);

  let raw: string;
  try {
    const fileStat = await stat(resolved);
    if (fileStat.size > MAX_CONFIG_SIZE) {
      console.error(chalk.red(`✗ Config file too large (${fileStat.size} bytes, max ${MAX_CONFIG_SIZE})`));
      process.exit(1);
    }
    raw = await readFile(resolved, "utf-8");
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    console.error(chalk.red("✗ Could not read config file:"), resolved);
    process.exit(1);
  }

  const result = parseForgeYaml(raw);
  if (!result.success) {
    console.error(chalk.red("✗ Validation errors:"));
    for (const err of result.errors) {
      console.error(chalk.red(`  • ${err}`));
    }
    process.exit(1);
  }

  return result.config;
}
