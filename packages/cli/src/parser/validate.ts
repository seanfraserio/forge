import { parse as parseYaml } from "yaml";
import { forgeConfigSchema } from "./schema.js";
import type { ForgeConfig } from "@openforge-ai/sdk";

export interface ValidationResult {
  success: boolean;
  config?: ForgeConfig;
  errors?: string[];
}

export function parseForgeYaml(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    return {
      success: false,
      errors: [`YAML parse error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const result = forgeConfigSchema.safeParse(parsed);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      ),
    };
  }

  return {
    success: true,
    config: result.data as ForgeConfig,
  };
}

export function resolveEnvironment(
  config: ForgeConfig,
  env: string
): ForgeConfig {
  if (!config.environments?.[env]) {
    return config;
  }

  const override = config.environments[env];
  const resolved = { ...config };

  if (override.model) {
    resolved.model = { ...config.model, ...override.model };
  }
  if (override.tools) {
    resolved.tools = override.tools;
  }
  if (override.memory) {
    resolved.memory = override.memory;
  }

  return resolved;
}
