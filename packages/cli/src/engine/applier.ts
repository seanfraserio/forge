import type { PlanResult, ApplyOptions, ApplyResult, ForgeConfig } from "@forge-ai/sdk";
import { createState, writeState } from "./state.js";

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

  const applied = [...plan.toCreate, ...plan.toUpdate, ...plan.toDelete];

  // Write state file
  const state = createState(config, opts.environment);
  await writeState(stateDir, state);

  return {
    success: true,
    applied,
    skipped: plan.noChange,
    state,
  };
}
