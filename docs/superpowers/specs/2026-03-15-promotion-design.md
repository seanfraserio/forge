# PromotionManager Implementation Design

**Module**: `@forge-ai/enterprise` — `src/environments/promotion.ts`
**Date**: 2026-03-15
**Status**: Approved

## Overview

Implement gated environment promotion workflows. Rules define which env→env transitions need approval and who can approve them. Requests track the lifecycle of individual promotions (pending → approved/rejected).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rule storage | Constructor config + in-memory `createRule()` | Rules are declarative config, not persistent state |
| Request storage | JSON array in `.forge/promotion-requests.json` | Need to update individual request statuses; JSONL doesn't support in-place updates |
| Input type | `PromotionRequestInput` (separate from `PromotionRequest`) | Same pattern as AuditEntryInput — caller provides data, `id`/`status` auto-generated |
| Approver validation | Enforced against rule's `approvers[]` | The whole point of gated promotions — without enforcement, `approvers` is decoration |
| License gating | Skip for now | Same as AuditTrail and RBAC |
| File permissions | `0o700` dirs, `0o600` files | Matches codebase pattern |
| Corrupted file | Treat as empty array with `console.warn` | Resilience over strictness |

## Types

```typescript
export type PromotionRequestInput = {
  agentName: string;
  fromEnv: string;
  toEnv: string;
  configHash: string;
  requestedBy: string;
};

export interface PromotionManagerOptions {
  rules?: PromotionRule[];
  stateDir?: string; // defaults to ".forge"
}
```

Interface change: `requestPromotion(input: PromotionRequestInput)` replaces `requestPromotion(agentName, fromEnv, toEnv)`.

New method added to `IPromotionManager`: `getRequests(agentName?: string): Promise<PromotionRequest[]>`.

## Method Behavior

### `createRule(rule): Promise<void>`

- Adds rule to in-memory list
- Validates no duplicate `from→to` pair exists — throws if duplicate
- Async for interface compliance only

### `requestPromotion(input: PromotionRequestInput): Promise<PromotionRequest>`

- Finds matching rule for `input.fromEnv→input.toEnv` — throws if no rule
- Auto-generates `id` (UUID), sets `status: "pending"`
- Appends to requests array, persists to `.forge/promotion-requests.json`
- Creates directory/file if they don't exist
- Returns the complete `PromotionRequest`

### `approvePromotion(requestId, approverId): Promise<void>`

1. Loads requests from file — throws if request `id` not found
2. Throws if request status is not `"pending"`
3. Finds matching rule for the request's `fromEnv→toEnv`
4. If rule has `approvers[]`, validates `approverId` is in the list — throws if not
5. If rule has no `approvers` list (undefined), any approver is accepted
6. Updates request status to `"approved"`
7. Writes back to file

### `getRequests(agentName?): Promise<PromotionRequest[]>`

- Reads all requests from file
- If `agentName` provided, filters to that agent
- Returns empty array if file doesn't exist

## Testing Strategy

**File**: `src/environments/promotion.test.ts`

| Category | Test |
|----------|------|
| createRule | Adds a rule successfully |
| createRule | Throws on duplicate from→to pair |
| requestPromotion | Creates a pending request with auto-generated id |
| requestPromotion | Throws when no rule matches from→to |
| requestPromotion | Persists request to file |
| requestPromotion | Returns complete PromotionRequest |
| approvePromotion | Approves a pending request |
| approvePromotion | Throws when request not found |
| approvePromotion | Throws when request is not pending |
| approvePromotion | Throws when approver not in rule's approvers list |
| approvePromotion | Updates status in persisted file |
| approvePromotion | Allows approval when rule has no approvers list |
| integration | Full flow: create rule → request → approve |
| integration | Multiple requests for same agent tracked independently |
| getRequests | Returns all requests |
| getRequests | Returns empty array when no file exists |

## Out of Scope

- `rejectPromotion()` (add when needed)
- Automatic test execution (rule's `requireTests` is stored but not enforced)
- Automatic audit logging (rule's `requireAudit` is stored but not enforced)
- CLI integration
