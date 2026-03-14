import type { ForgeConfig, AgentState, PlanResult, PlanItem } from "@forge-ai/sdk";
import { hashConfig } from "./state.js";

/**
 * Compare desired config against actual deployed state.
 * Returns a PlanResult describing what would change.
 */
export function plan(desired: ForgeConfig, actual: AgentState | null): PlanResult {
  const result: PlanResult = {
    toCreate: [],
    toUpdate: [],
    toDelete: [],
    noChange: [],
    hasChanges: false,
  };

  // If no existing state, everything is a create
  if (!actual) {
    result.toCreate.push({
      resource: "agent",
      newValue: desired.agent,
      summary: `Create agent "${desired.agent.name}"`,
    });
    result.toCreate.push({
      resource: "model",
      newValue: desired.model,
      summary: `Configure model ${desired.model.provider}/${desired.model.name}`,
    });
    if (desired.system_prompt) {
      result.toCreate.push({
        resource: "system_prompt",
        newValue: desired.system_prompt,
        summary: `Set system prompt from ${desired.system_prompt.file ?? "inline"}`,
      });
    }
    if (desired.tools?.mcp_servers) {
      for (const server of desired.tools.mcp_servers) {
        result.toCreate.push({
          resource: "mcp_server",
          field: server.name,
          newValue: server,
          summary: `Add MCP server "${server.name}"`,
        });
      }
    }
    if (desired.memory && desired.memory.type !== "none") {
      result.toCreate.push({
        resource: "memory",
        newValue: desired.memory,
        summary: `Configure ${desired.memory.type} memory`,
      });
    }
    result.hasChanges = result.toCreate.length > 0;
    return result;
  }

  // Compare configs using hash for quick check
  const desiredHash = hashConfig(desired);
  if (desiredHash === actual.configHash) {
    result.noChange.push({
      resource: "agent",
      summary: `Agent "${desired.agent.name}" is up to date (hash: ${desiredHash.slice(0, 8)})`,
    });
    return result;
  }

  // Detailed field-level diff
  const actualConfig = actual.config;

  // Agent name/description changes
  if (desired.agent.name !== actualConfig.agent.name) {
    result.toUpdate.push({
      resource: "agent",
      field: "name",
      oldValue: actualConfig.agent.name,
      newValue: desired.agent.name,
      summary: `Rename agent "${actualConfig.agent.name}" → "${desired.agent.name}"`,
    });
  }
  if (desired.agent.description !== actualConfig.agent.description) {
    result.toUpdate.push({
      resource: "agent",
      field: "description",
      oldValue: actualConfig.agent.description,
      newValue: desired.agent.description,
      summary: `Update agent description`,
    });
  }

  // Model changes
  if (desired.model.provider !== actualConfig.model.provider) {
    result.toUpdate.push({
      resource: "model",
      field: "provider",
      oldValue: actualConfig.model.provider,
      newValue: desired.model.provider,
      summary: `Change model provider: ${actualConfig.model.provider} → ${desired.model.provider}`,
    });
  }
  if (desired.model.name !== actualConfig.model.name) {
    result.toUpdate.push({
      resource: "model",
      field: "name",
      oldValue: actualConfig.model.name,
      newValue: desired.model.name,
      summary: `Change model: ${actualConfig.model.name} → ${desired.model.name}`,
    });
  }
  if (desired.model.temperature !== actualConfig.model.temperature) {
    result.toUpdate.push({
      resource: "model",
      field: "temperature",
      oldValue: actualConfig.model.temperature,
      newValue: desired.model.temperature,
      summary: `Change temperature: ${actualConfig.model.temperature} → ${desired.model.temperature}`,
    });
  }
  if (desired.model.max_tokens !== actualConfig.model.max_tokens) {
    result.toUpdate.push({
      resource: "model",
      field: "max_tokens",
      oldValue: actualConfig.model.max_tokens,
      newValue: desired.model.max_tokens,
      summary: `Change max_tokens: ${actualConfig.model.max_tokens} → ${desired.model.max_tokens}`,
    });
  }

  // MCP servers diff
  const desiredServers = desired.tools?.mcp_servers ?? [];
  const actualServers = actualConfig.tools?.mcp_servers ?? [];
  const actualServerMap = new Map(actualServers.map((s) => [s.name, s]));
  const desiredServerMap = new Map(desiredServers.map((s) => [s.name, s]));

  for (const server of desiredServers) {
    if (!actualServerMap.has(server.name)) {
      result.toCreate.push({
        resource: "mcp_server",
        field: server.name,
        newValue: server,
        summary: `Add MCP server "${server.name}"`,
      });
    } else {
      const existing = actualServerMap.get(server.name)!;
      if (JSON.stringify(server) !== JSON.stringify(existing)) {
        result.toUpdate.push({
          resource: "mcp_server",
          field: server.name,
          oldValue: existing,
          newValue: server,
          summary: `Update MCP server "${server.name}"`,
        });
      }
    }
  }

  for (const server of actualServers) {
    if (!desiredServerMap.has(server.name)) {
      result.toDelete.push({
        resource: "mcp_server",
        field: server.name,
        oldValue: server,
        summary: `Remove MCP server "${server.name}"`,
      });
    }
  }

  result.hasChanges =
    result.toCreate.length > 0 ||
    result.toUpdate.length > 0 ||
    result.toDelete.length > 0;

  return result;
}

/**
 * Format a PlanResult as a human-readable string.
 */
export function formatPlan(planResult: PlanResult): string {
  const lines: string[] = [];

  if (!planResult.hasChanges) {
    lines.push("No changes. Infrastructure is up to date.");
    for (const item of planResult.noChange) {
      lines.push(`  ${item.summary}`);
    }
    return lines.join("\n");
  }

  if (planResult.toCreate.length > 0) {
    lines.push("Resources to CREATE:");
    for (const item of planResult.toCreate) {
      lines.push(`  + ${item.summary}`);
    }
  }

  if (planResult.toUpdate.length > 0) {
    lines.push("Resources to UPDATE:");
    for (const item of planResult.toUpdate) {
      lines.push(`  ~ ${item.summary}`);
    }
  }

  if (planResult.toDelete.length > 0) {
    lines.push("Resources to DELETE:");
    for (const item of planResult.toDelete) {
      lines.push(`  - ${item.summary}`);
    }
  }

  lines.push(
    `\nPlan: ${planResult.toCreate.length} to add, ${planResult.toUpdate.length} to change, ${planResult.toDelete.length} to destroy.`
  );

  return lines.join("\n");
}
