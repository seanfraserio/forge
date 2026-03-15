# AuditTrail Implementation Design

**Module**: `@forge-ai/enterprise` — `src/audit/trail.ts`
**Date**: 2026-03-15
**Status**: Approved

## Overview

Implement the `AuditTrail` class as a file-based, append-only audit log for tracking deployments, rollbacks, and deletions. This is the foundational enterprise feature — other modules (RBAC, promotions) will log events to it.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage backend | JSONL file (`.forge/audit.jsonl`) | Matches existing `.forge/state.json` pattern, zero dependencies, naturally append-only |
| License gating | Skip for now | Ship working code first, bolt on license validation later |
| ID/timestamp generation | Auto-generate with optional override | Simpler API for normal use, allows overrides for testing and event replay |
| Input type | Separate `AuditEntryInput` type | Keeps `AuditEntry` fields required (stored entries always have `id`/`timestamp`), while callers can omit them |
| File permissions | `0o700` dirs, `0o600` files | Matches existing `state.ts` pattern, audit logs may contain sensitive actor/environment data |
| Error type | Plain `Error` with descriptive messages | Matches existing codebase pattern, no custom error classes needed yet |

## Architecture

### Storage

- **Format**: JSON Lines (`.forge/audit.jsonl`) — one `AuditEntry` per line
- **Location**: Co-located with `state.json` in the `.forge/` directory (or custom `stateDir`)
- **Creation**: File and directory created lazily on first `record()` call
- **Immutability**: Enforced by API design — only `appendFile` is used, no update/delete methods exist
- **Permissions**: Directory created with `mode: 0o700`, file written with `mode: 0o600` — matches existing `state.ts` pattern
- **Concurrency**: Not handled. Forge is a single-process, single-user CLI tool. If concurrent access becomes a requirement, file locking must be added.

### Constructor

```typescript
interface AuditTrailOptions {
  stateDir?: string; // defaults to ".forge"
}

const audit = new AuditTrail();                              // default
const audit = new AuditTrail({ stateDir: "/custom/path" });  // custom
```

### ID Generation

- `crypto.randomUUID()` — Node 19+ built-in, no external dependencies
- Timestamps via `new Date().toISOString()`

## Types

A new input type separates what callers provide from what gets stored:

```typescript
// What callers pass in — id and timestamp are optional
export type AuditEntryInput = Omit<AuditEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};
```

`AuditEntry` (the stored/returned type) stays unchanged — `id` and `timestamp` remain required. This guarantees every persisted entry always has both fields.

## Method Behavior

### `record(entry: AuditEntryInput): Promise<AuditEntry>`

- Auto-generates `id` (UUID) and `timestamp` (ISO) if not provided by caller
- Validates required fields: `action`, `actor`, `environment`, `agentName`, `configHash` — throws `Error` with descriptive message if missing
- Appends a single JSON line to `audit.jsonl` with trailing newline
- Creates `.forge/` directory (`mode: 0o700`) and `audit.jsonl` (`mode: 0o600`) if they don't exist
- Returns the completed `AuditEntry` (with generated `id`/`timestamp`)

**Interface changes** (both `IAuditTrail` and `AuditTrail`):
- Parameter type: `AuditEntry` → `AuditEntryInput`
- Return type: `Promise<void>` → `Promise<AuditEntry>`

### `query(filter): Promise<AuditEntry[]>`

- Reads entire JSONL file, parses each line
- Matches entries where every **string** field in `filter` equals the entry's field (`===` comparison)
- Filterable fields: `id`, `action`, `actor`, `environment`, `agentName`, `configHash`, `previousHash`. The `metadata` field is **not filterable** (object equality is unreliable) — it is ignored if present in the filter
- Empty filter `query({})` returns **all** entries
- Returns matches in chronological order (file order = insertion order)
- Returns empty array if file doesn't exist (not an error)

### `getHistory(agentName): Promise<AuditEntry[]>`

- Convenience wrapper: equivalent to `query({ agentName })`
- Returns all entries for that agent in chronological order

## Error Handling

- File read/write errors propagate as-is (caller handles)
- Malformed JSONL lines are skipped with a `console.warn` (graceful degradation — a corrupted line shouldn't block reading the rest of the log)
- Missing audit file on read returns empty array (no history yet is not an error)

## Testing Strategy

**File**: `src/audit/trail.test.ts` (co-located)
**Approach**: Real filesystem via `fs.mkdtemp` temp directories. No mocks.

### Test Cases

| Category | Test |
|----------|------|
| record | Creates `.forge/` dir and `audit.jsonl` on first write |
| record | Auto-generates `id` and `timestamp` when omitted |
| record | Uses caller-provided `id` and `timestamp` when supplied |
| record | Validates required fields — throws on missing `action`, `actor`, etc. |
| record | Appends multiple entries without overwriting |
| record | Returns the completed entry with generated fields |
| query | Filters by single field (`action: "deploy"`) |
| query | Filters by multiple fields (`action` + `environment`) |
| query | Returns empty array when no matches |
| query | Returns empty array when audit file doesn't exist |
| query | Skips malformed JSONL lines without crashing |
| getHistory | Returns all entries for a given agent in chronological order |
| getHistory | Returns empty array for unknown agent |
| query | Empty filter `query({})` returns all entries |
| query | Ignores `metadata` field in filter |
| record | Rapid sequential writes don't corrupt file (`Promise.all`) |

Each test gets its own temp directory, cleaned up in `afterEach`.

## Integration

Integration with the CLI deploy command is **out of scope** for this implementation. The AuditTrail is built and tested as a standalone module. Wiring it into the deploy flow (e.g., after `writeState()` in `applier.ts`) will be a follow-up task once all four enterprise modules are implemented.

## Out of Scope

- License validation (separate concern, added later)
- Log rotation or compaction (premature — deploy event volume is low)
- Remote/cloud storage backends (future pluggable interface if needed)
- Encryption at rest (filesystem-level concern, not application-level)
