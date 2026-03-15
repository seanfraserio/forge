import type {
  ForgeClientOptions,
  ForgeConfig,
  PlanResult,
  ApplyResult,
  ApplyOptions,
  AgentState,
} from "./types.js";

/**
 * Programmatic API for Forge operations.
 * Wraps the core engine functionality for use outside the CLI.
 */
export class ForgeClient {
  private configPath: string;
  private stateDir: string;
  private environment: string;

  constructor(options: ForgeClientOptions = {}) {
    this.configPath = options.configPath ?? "forge.yaml";
    this.stateDir = options.stateDir ?? ".forge";
    this.environment = options.environment ?? "dev";
  }

  // TODO: Implement config loading with YAML parsing
  async loadConfig(): Promise<ForgeConfig> {
    throw new Error("Not implemented — use @openforge-ai/cli for full functionality");
  }

  // TODO: Implement plan generation
  async plan(_config: ForgeConfig): Promise<PlanResult> {
    throw new Error("Not implemented — use @openforge-ai/cli for full functionality");
  }

  // TODO: Implement apply
  async apply(_plan: PlanResult, _opts?: Partial<ApplyOptions>): Promise<ApplyResult> {
    throw new Error("Not implemented — use @openforge-ai/cli for full functionality");
  }

  // TODO: Load current state
  async getState(): Promise<AgentState | null> {
    throw new Error("Not implemented — use @openforge-ai/cli for full functionality");
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getStateDir(): string {
    return this.stateDir;
  }

  getEnvironment(): string {
    return this.environment;
  }
}
