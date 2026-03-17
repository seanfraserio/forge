import type { PlanResult, ApplyOptions, ApplyResult, ForgeConfig } from "@openforge-ai/sdk";
import { createState, writeState } from "./state.js";
import { resolveAdapter } from "./adapter-resolver.js";

/**
 * Apply a plan to make actual state match desired state.
 * Idempotent: applying an already-applied plan is a no-op.
 */
export async function apply(
  plan: PlanResult,
  config: ForgeConfig,
  opts: ApplyOptions
): Promise<ApplyResult> {
  const stateDir = opts.stateDir ?? ".forge";

  // If no changes, return immediately
  if (!plan.hasChanges) {
    const state = createState(config, opts.environment);
    return {
      success: true,
      applied: [],
      skipped: plan.noChange,
      state,
    };
  }

  // Dry run: return what would happen without writing
  if (opts.dryRun) {
    const state = createState(config, opts.environment);
    return {
      success: true,
      applied: [],
      skipped: [...plan.toCreate, ...plan.toUpdate, ...plan.toDelete],
      state,
    };
  }

  // Resolve adapter and validate/deploy before writing state
  const adapter = resolveAdapter(config);

  if (!adapter.validateModel(config.model)) {
    throw new Error(
      `Model '${config.model.name}' is not supported by provider '${config.model.provider}'`
    );
  }

  const deployResult = await adapter.deploy(config.model);

  if (!deployResult.success) {
    throw new Error(`Adapter deploy failed: ${deployResult.error}`);
  }

  const applied = [...plan.toCreate, ...plan.toUpdate, ...plan.toDelete];

  // Write state file — only after successful adapter deploy
  const state = createState(config, opts.environment);
  if (deployResult.endpoint) {
    state.endpoint = deployResult.endpoint;
  }
  if (deployResult.agentId) {
    state.agentId = deployResult.agentId;
  }
  await writeState(stateDir, state);

  return {
    success: true,
    applied,
    skipped: plan.noChange,
    state,
  };
}
