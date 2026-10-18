import { isMap, isSeq, parseDocument, visit } from "yaml";
import type { Document, Node } from "yaml";
import { forgeConfigSchema } from "./schema.js";
import type { ForgeConfig } from "@openforge-ai/sdk";

/**
 * Structural collection depth, counted on the document tree yaml already
 * parsed. yaml@2.8.3 has no nesting option (only maxAliasCount); this limit
 * stops hostile flow collections before toJS can overflow the stack.
 * Scalars and comments are not collections, so brackets inside them do not count.
 */
const MAX_YAML_COLLECTION_DEPTH = 32;

function isCollection(node: unknown): node is Node {
  return isMap(node) || isSeq(node);
}

function collectionDepthExceeded(doc: Document): boolean {
  let exceeded = false;
  visit(doc, (_key, node, path) => {
    if (exceeded) return visit.BREAK;
    if (!isCollection(node) || !Array.isArray(path)) return;
    // visit() path includes the node itself. Pair steps are not containers.
    const collectionDepth = path.filter(isCollection).length;
    if (collectionDepth > MAX_YAML_COLLECTION_DEPTH) exceeded = true;
  });
  return exceeded;
}

export type ValidationResult =
  | { success: true; config: ForgeConfig }
  | { success: false; errors: string[] };

export function parseForgeYaml(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    // parseDocument surfaces syntax errors without converting the tree.
    // maxAliasCount is the only depth-related option yaml@2.8.3 supports;
    // it applies when the document is converted, not while parsing.
    const doc = parseDocument(raw);
    if (doc.errors.length > 0) {
      throw doc.errors[0];
    }
    if (collectionDepthExceeded(doc)) {
      return {
        success: false,
        errors: ["YAML parse error: YAML collection nesting is too deep"],
      };
    }
    parsed = doc.toJS({ maxAliasCount: 100 });
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

  // Deep clone to prevent mutations leaking back to the original config
  const resolved = JSON.parse(JSON.stringify(config)) as ForgeConfig;
  // Read override from the cloned object — no need for additional deep clones
  const override = resolved.environments?.[env];
  if (!override) return resolved;

  if (override.model) {
    resolved.model = { ...resolved.model, ...override.model };
  }
  if (override.mcp_servers) {
    resolved.mcp_servers = override.mcp_servers;
  }
  if (override.memory) {
    resolved.memory = override.memory;
  }

  return resolved;
}
