import type { ForgeConfig } from "@openforge-ai/sdk";

/**
 * Redact a single env vars record in place.
 * Keeps ${VAR} template references as-is for accurate diffing.
 * Replaces resolved secret values with [REDACTED].
 */
export function redactEnvRecord(env: Record<string, string>): void {
  for (const key of Object.keys(env)) {
    if (!/^\$\{.+\}$/.test(env[key])) {
      env[key] = "[REDACTED]";
    }
  }
}

/**
 * Deep-clone a config and redact sensitive values from MCP server env vars.
 */
export function redactConfig(config: ForgeConfig): ForgeConfig {
  const cloned = JSON.parse(JSON.stringify(config)) as ForgeConfig;
  if (cloned.tools?.mcp_servers) {
    for (const server of cloned.tools.mcp_servers) {
      if (server.env) {
        redactEnvRecord(server.env);
      }
    }
  }
  return cloned;
}

/**
 * Redact potential secrets from an arbitrary value before displaying.
 * If the value is an object with an `env` property, redacts its values.
 */
export function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  if (obj.env && typeof obj.env === "object") {
    const redacted = { ...obj, env: { ...(obj.env as Record<string, string>) } };
    redactEnvRecord(redacted.env as Record<string, string>);
    return redacted;
  }
  return value;
}
