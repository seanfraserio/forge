import { z } from "zod";

export const modelProviderSchema = z.enum(["anthropic", "openai", "google", "ollama", "bedrock"]);

export const modelConfigSchema = z.object({
  provider: modelProviderSchema,
  name: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

export const systemPromptSchema = z.union([
  z.string().min(1),
  z.object({
    file: z.string().min(1).refine(
      (file) => {
        // Reject absolute paths and path traversal
        if (file.startsWith("/") || file.startsWith("\\")) return false;
        if (file.includes("..")) return false;
        return true;
      },
      { message: "system_prompt.file must be a relative path within the project (no absolute paths or '..')" }
    ),
  }),
]);

/**
 * Shell metacharacters that could enable command injection when the command
 * string is passed to a shell. These are rejected at parse time.
 */
const SHELL_METACHAR_PATTERN = /[;|&$()>`<]/;

export const mcpServerSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1).refine(
    (cmd) => !SHELL_METACHAR_PATTERN.test(cmd),
    { message: "MCP server command must not contain shell metacharacters (;|&$()>`<)" }
  ),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const mcpServersSchema = z.array(mcpServerSchema).optional();

export const memoryTypeSchema = z.enum(["none", "in-context", "vector"]);
export const memoryProviderSchema = z.enum(["chroma", "pinecone", "weaviate"]);

export const memoryConfigSchema = z.object({
  type: memoryTypeSchema,
  provider: memoryProviderSchema.optional(),
  collection: z.string().optional(),
}).refine(
  (data) => data.type !== "vector" || data.provider,
  { message: "vector memory type requires a provider" }
);

const hookCommandSchema = z.string().min(1).refine(
  (cmd) => !SHELL_METACHAR_PATTERN.test(cmd),
  { message: "Hook command must not contain shell metacharacters (;|&$()>`<)" }
);

export const hooksConfigSchema = z.object({
  pre_deploy: z.array(hookCommandSchema).optional(),
  post_deploy: z.array(hookCommandSchema).optional(),
});

export const environmentOverrideSchema = z.object({
  model: modelConfigSchema.partial().optional(),
  mcp_servers: mcpServersSchema,
  memory: memoryConfigSchema.optional(),
});

export const agentConfigSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, "Agent name must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
});

export const forgeConfigSchema = z.object({
  version: z.literal("1"),
  agent: agentConfigSchema,
  model: modelConfigSchema,
  system_prompt: systemPromptSchema.optional(),
  mcp_servers: mcpServersSchema,
  memory: memoryConfigSchema.optional(),
  environments: z.record(environmentOverrideSchema).optional(),
  hooks: hooksConfigSchema.optional(),
});

