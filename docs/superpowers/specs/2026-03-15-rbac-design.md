# RbacManager Implementation Design

**Module**: `@forge-ai/enterprise` — `src/rbac/policies.ts`
**Date**: 2026-03-15
**Status**: Approved

## Overview

Implement the `RbacManager` class for role-based access control over agent deployments. Roles are declarative config passed via constructor; only user→role assignments are persisted to disk.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role storage | Constructor config (not persisted) | Roles are declarative — belong in forge.yaml, not mutable at runtime |
| Assignment storage | JSON file (`.forge/rbac-assignments.json`) | Simple `Record<string, string>`, matches AuditTrail file pattern |
| No-role behavior | Fall back to `defaultRole`, then deny | `Policy.defaultRole` already exists in the interface — use it |
| Admin behavior | Bypasses environment restrictions | Simpler mental model — admin means full access everywhere |
| License gating | Skip for now | Same decision as AuditTrail — ship working code first |
| File permissions | `0o700` dirs, `0o600` files | Matches existing `state.ts` and AuditTrail patterns |
| Corrupted assignments file | Treat as empty (reset) | CLI tool — resilience over strictness. User can re-assign roles. |
| Empty environment string | Treated as literal env name | All environments are explicit strings; callers must pass a real env name |

## Architecture

### Data Model

Two separate concerns:

- **Roles/Policy**: Passed into constructor as config. Not persisted. Immutable at runtime.
- **User assignments**: Persisted to `.forge/rbac-assignments.json`. Maps `userId` → `roleName` as a flat JSON object.

### Constructor

**Breaking change**: The current `RbacManager` has a no-argument constructor. This implementation adds a required `RbacManagerOptions` parameter. `RbacManagerOptions` must be exported from `index.ts`.

```typescript
export interface RbacManagerOptions {
  policy: Policy;
  stateDir?: string; // defaults to ".forge"
}

const rbac = new RbacManager({
  policy: {
    roles: [
      { name: "developer", permissions: ["read", "deploy"], environments: ["dev", "staging"] },
      { name: "operator", permissions: ["read", "deploy", "rollback"] },
      { name: "admin", permissions: ["read", "deploy", "rollback", "admin"] },
    ],
    defaultRole: "developer",
  },
});
```

### Storage

- **Format**: JSON file at `.forge/rbac-assignments.json`
- **Structure**: `Record<string, string>` — e.g., `{ "alice@example.com": "operator", "bob@example.com": "admin" }`
- **Creation**: File and directory created lazily on first `assignRole()` call
- **Permissions**: Directory `0o700`, file `0o600`
- **Concurrency**: Not handled (single-process CLI)

## Method Behavior

### `checkPermission(userId, permission, environment): Promise<boolean>`

1. Look up user's assigned role from assignments file
2. If no assignment found, fall back to `policy.defaultRole`
3. If still no role (no assignment AND no defaultRole) → return `false`
4. Find role definition in `policy.roles` by name
5. If role name not found in policy → return `false`. This applies to both stale file assignments AND a misconfigured `defaultRole` that doesn't match any role in `policy.roles`.
6. If role has `admin` permission → return `true` (bypasses environment check)
7. Check: role has the requested permission AND (role has no `environments` restriction OR `environment` is in the allowed list)

**Note**: `environment` is always treated as a literal string. Empty string `""` is not special — it would need to appear in the role's `environments` array to match.

### `assignRole(userId, roleName): Promise<void>`

- Validates `userId` is a non-empty string — throws `Error` if empty/whitespace
- Validates `roleName` exists in `policy.roles` — throws `Error` with descriptive message if not
- Reads current assignments from file (or empty object if file doesn't exist or is corrupted JSON)
- Sets `assignments[userId] = roleName`
- Writes back to `.forge/rbac-assignments.json` with `JSON.stringify(assignments, null, 2)`
- Creates directory (`0o700`) and file (`0o600`) if they don't exist

### `listRoles(): Promise<Role[]>`

- Returns `policy.roles` as-is (no file I/O — roles are constructor config)
- Async for `IRbacManager` interface compliance only; no `await` needed in implementation

## Error Handling

- `assignRole` with empty/whitespace `userId` → throws `Error`
- `assignRole` with unknown role name → throws `Error` with message including the invalid role name
- Missing assignments file on read → empty object (no assignments yet, not an error)
- Corrupted assignments file (invalid JSON) → `console.warn`, treat as empty object. CLI resilience over strictness — user can re-assign roles.
- Other file I/O errors propagate as-is

## Testing Strategy

**File**: `src/rbac/policies.test.ts` (co-located)
**Approach**: Real filesystem via `fs.mkdtemp` temp directories. No mocks.

### Test Cases

| Category | Test |
|----------|------|
| checkPermission | Returns true when user has matching role and permission |
| checkPermission | Returns false when user has role but lacks permission |
| checkPermission | Returns false when user has no assigned role and no defaultRole |
| checkPermission | Falls back to defaultRole for unassigned users |
| checkPermission | Denies when role's environment restriction doesn't include target env |
| checkPermission | Allows when role's environment restriction includes target env |
| checkPermission | Admin permission bypasses environment restrictions |
| checkPermission | Returns false for stale assignment (role name not in policy) |
| checkPermission | Allows when role has no environment restriction regardless of target env |
| checkPermission | Returns false for misconfigured defaultRole not in policy.roles |
| assignRole | Persists assignment to file |
| assignRole | Throws on unknown role name |
| assignRole | Throws on empty userId |
| assignRole | Overwrites previous assignment for same user |
| assignRole | Creates state dir and file on first call |
| listRoles | Returns all roles from policy config |
| listRoles | Returns empty array when no roles configured |

Each test gets its own temp directory, cleaned up in `afterEach`.

## Integration

Integration with the CLI deploy command is **out of scope**. The RbacManager is built and tested as a standalone module. Wiring it into the deploy flow (e.g., checking permissions before `apply()`) will be a follow-up task.

## Out of Scope

- License validation (separate concern)
- Role hierarchy / inheritance (premature complexity)
- Audit logging of permission checks (wire to AuditTrail in follow-up)
- Multi-tenancy or organization support
- `unassignRole` / `removeAssignment` (revert user to defaultRole — add if needed)
