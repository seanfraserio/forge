// ─── forge.yaml configuration types ───

export interface ForgeConfig {
  version: string;
  agent: AgentConfig;
  model: ModelConfig;
  system_prompt?: SystemPromptConfig;
  tools?: ToolsConfig;
  memory?: MemoryConfig;
  environments?: Record<string, EnvironmentOverride>;
  hooks?: HooksConfig;
}

export interface AgentConfig {
  name: string;
  description?: string;
}

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
  temperature?: number;
  max_tokens?: number;
}

export type ModelProvider = "anthropic" | "openai" | "ollama" | "bedrock";

export interface SystemPromptConfig {
  file?: string;
  inline?: string;
}

export interface ToolsConfig {
  mcp_servers?: McpServerConfig[];
}

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MemoryConfig {
  type: MemoryType;
  provider?: MemoryProvider;
  collection?: string;
}

export type MemoryType = "none" | "in-context" | "vector";
export type MemoryProvider = "chroma" | "pinecone" | "weaviate";

export interface EnvironmentOverride {
  model?: Partial<ModelConfig>;
  tools?: ToolsConfig;
  memory?: MemoryConfig;
}

export interface HooksConfig {
  pre_deploy?: HookStep[];
  post_deploy?: HookStep[];
}

export interface HookStep {
  run: string;
}

// ─── Engine types ───

export interface AgentState {
  configHash: string;
  lastDeployed: string; // ISO timestamp
  environment: string;
  agentName: string;
  agentVersion?: string;
  config: ForgeConfig;
}

export interface PlanResult {
  toCreate: PlanItem[];
  toUpdate: PlanItem[];
  toDelete: PlanItem[];
  noChange: PlanItem[];
  hasChanges: boolean;
}

export interface PlanItem {
  resource: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  summary: string;
}

export interface ApplyOptions {
  dryRun: boolean;
  environment: string;
  autoApprove: boolean;
}

export interface ApplyResult {
  success: boolean;
  applied: PlanItem[];
  skipped: PlanItem[];
  error?: string;
  state: AgentState;
}

// ─── SDK Client types ───

export interface ForgeClientOptions {
  configPath?: string;
  stateDir?: string;
  environment?: string;
}
