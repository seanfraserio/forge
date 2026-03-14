import { z } from "zod";

export const modelProviderSchema = z.enum(["anthropic", "openai", "google", "ollama", "bedrock"]);

export const modelConfigSchema = z.object({
  provider: modelProviderSchema,
  name: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

export const systemPromptSchema = z.object({
  file: z.string().optional(),
  inline: z.string().optional(),
}).refine(
  (data) => data.file || data.inline,
  { message: "system_prompt must specify either 'file' or 'inline'" }
);

export const mcpServerSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const toolsConfigSchema = z.object({
  mcp_servers: z.array(mcpServerSchema).optional(),
});

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

export const hookStepSchema = z.object({
  run: z.string().min(1),
});

export const hooksConfigSchema = z.object({
  pre_deploy: z.array(hookStepSchema).optional(),
  post_deploy: z.array(hookStepSchema).optional(),
});

export const environmentOverrideSchema = z.object({
  model: modelConfigSchema.partial().optional(),
  tools: toolsConfigSchema.optional(),
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
  tools: toolsConfigSchema.optional(),
  memory: memoryConfigSchema.optional(),
  environments: z.record(environmentOverrideSchema).optional(),
  hooks: hooksConfigSchema.optional(),
});

export type ForgeConfigInput = z.input<typeof forgeConfigSchema>;
export type ForgeConfigParsed = z.output<typeof forgeConfigSchema>;
