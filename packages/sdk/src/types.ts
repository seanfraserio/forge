// ─── forge.yaml configuration types ───

export interface ForgeConfig {
  version: "1";
  agent: AgentConfig;
  model: ModelConfig;
  system_prompt?: SystemPromptConfig;
  mcp_servers?: McpServerConfig[];
  memory?: MemoryConfig;
  environments?: Record<string, EnvironmentOverride>;
  hooks?: HooksConfig;
}

export interface AgentConfig {
  name: string;
  description?: string;
}

export interface ModelConfig {
  provider: ProviderName;
  name: string;
  temperature?: number;
  max_tokens?: number;
}

export type ProviderName = "anthropic" | "openai" | "google" | "ollama" | "bedrock" | "mistral" | "cohere";

export type SystemPromptConfig = string | { file: string };

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type MemoryConfig =
  | { type: "none" }
  | { type: "in-context" }
  | { type: "vector"; provider: MemoryProvider; collection?: string };

export type MemoryType = "none" | "in-context" | "vector";
export type MemoryProvider = "chroma" | "pinecone" | "weaviate";

export interface EnvironmentOverride {
  model?: Partial<ModelConfig>;
  mcp_servers?: McpServerConfig[];
  memory?: MemoryConfig;
}

export interface HooksConfig {
  pre_deploy?: string[];
  post_deploy?: string[];
}

// ─── Engine types ───

export interface AgentState {
  configHash: string;
  lastDeployed: string; // ISO timestamp
  environment: string;
  agentName: string;
  agentVersion?: string;
  endpoint?: string;
  agentId?: string;
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
  stateDir?: string;
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
