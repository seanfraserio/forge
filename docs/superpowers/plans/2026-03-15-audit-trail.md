# AuditTrail Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a file-based, append-only audit trail for tracking agent deployments, rollbacks, and deletions in `@forge-ai/enterprise`.

**Architecture:** JSONL file storage at `.forge/audit.jsonl`, co-located with existing `state.json`. New `AuditEntryInput` type separates caller input (optional `id`/`timestamp`) from stored `AuditEntry` (required fields). Follows existing `state.ts` patterns for file I/O, permissions, and error handling.

**Tech Stack:** TypeScript (ES2022), node:fs/promises, node:crypto, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-audit-trail-design.md`

---

## Chunk 1: Types and Interface Update

### Task 1: Update AuditEntry interface and add AuditEntryInput type

**Files:**
- Modify: `packages/enterprise/src/audit/trail.ts`
- Modify: `packages/enterprise/src/index.ts`

- [ ] **Step 1: Update the interface and types in trail.ts**

Replace the entire contents of `packages/enterprise/src/audit/trail.ts` with:

```typescript
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: "deploy" | "rollback" | "delete";
  actor: string;
  environment: string;
  agentName: string;
  configHash: string;
  previousHash?: string;
  metadata?: Record<string, unknown>;
}

export type AuditEntryInput = Omit<AuditEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

export interface IAuditTrail {
  record(entry: AuditEntryInput): Promise<AuditEntry>;
  query(filter: Partial<AuditEntry>): Promise<AuditEntry[]>;
  getHistory(agentName: string): Promise<AuditEntry[]>;
}

// Stub — implementation in Task 2
export class AuditTrail implements IAuditTrail {
  async record(_entry: AuditEntryInput): Promise<AuditEntry> {
    throw new Error("Not yet implemented");
  }

  async query(_filter: Partial<AuditEntry>): Promise<AuditEntry[]> {
    throw new Error("Not yet implemented");
  }

  async getHistory(_agentName: string): Promise<AuditEntry[]> {
    throw new Error("Not yet implemented");
  }
}
```

- [ ] **Step 2: Update index.ts exports to include AuditEntryInput**

In `packages/enterprise/src/index.ts`, update the audit exports:

```typescript
export { AuditTrail } from "./audit/trail.js";
export type { AuditEntry, AuditEntryInput, IAuditTrail } from "./audit/trail.js";
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/audit/trail.ts packages/enterprise/src/index.ts
git commit -m "feat(enterprise): add AuditEntryInput type and update IAuditTrail interface"
```

---

## Chunk 2: Tests First — record() Method

### Task 2: Write failing tests for record()

**Files:**
- Create: `packages/enterprise/src/audit/trail.test.ts`

- [ ] **Step 1: Create the test file with record() tests**

Create `packages/enterprise/src/audit/trail.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AuditTrail } from "./trail.js";
import type { AuditEntryInput, AuditEntry } from "./trail.js";

function makeEntry(overrides: Partial<AuditEntryInput> = {}): AuditEntryInput {
  return {
    action: "deploy",
    actor: "alice@example.com",
    environment: "production",
    agentName: "support-triage",
    configHash: "abc123def456",
    ...overrides,
  };
}

describe("AuditTrail", () => {
  let tempDir: string;
  let stateDir: string;
  let audit: AuditTrail;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "forge-audit-test-"));
    stateDir = join(tempDir, ".forge");
    audit = new AuditTrail({ stateDir });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("record()", () => {
    it("creates state dir and audit.jsonl on first write", async () => {
      await audit.record(makeEntry());
      const content = await readFile(join(stateDir, "audit.jsonl"), "utf-8");
      expect(content).toBeTruthy();
    });

    it("auto-generates id and timestamp when omitted", async () => {
      const result = await audit.record(makeEntry());
      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
      // UUID v4 format
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      // ISO timestamp format
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it("uses caller-provided id and timestamp when supplied", async () => {
      const result = await audit.record(
        makeEntry({ id: "custom-id-001", timestamp: "2026-01-01T00:00:00.000Z" })
      );
      expect(result.id).toBe("custom-id-001");
      expect(result.timestamp).toBe("2026-01-01T00:00:00.000Z");
    });

    it("validates required fields — throws on missing action", async () => {
      const entry = makeEntry();
      delete (entry as Record<string, unknown>).action;
      await expect(audit.record(entry as AuditEntryInput)).rejects.toThrow("action");
    });

    it("validates required fields — throws on missing actor", async () => {
      const entry = makeEntry();
      delete (entry as Record<string, unknown>).actor;
      await expect(audit.record(entry as AuditEntryInput)).rejects.toThrow("actor");
    });

    it("validates required fields — throws on missing agentName", async () => {
      const entry = makeEntry();
      delete (entry as Record<string, unknown>).agentName;
      await expect(audit.record(entry as AuditEntryInput)).rejects.toThrow("agentName");
    });

    it("validates required fields — throws on missing configHash", async () => {
      const entry = makeEntry();
      delete (entry as Record<string, unknown>).configHash;
      await expect(audit.record(entry as AuditEntryInput)).rejects.toThrow("configHash");
    });

    it("validates required fields — throws on missing environment", async () => {
      const entry = makeEntry();
      delete (entry as Record<string, unknown>).environment;
      await expect(audit.record(entry as AuditEntryInput)).rejects.toThrow("environment");
    });

    it("appends multiple entries without overwriting", async () => {
      await audit.record(makeEntry({ agentName: "agent-1" }));
      await audit.record(makeEntry({ agentName: "agent-2" }));
      await audit.record(makeEntry({ agentName: "agent-3" }));

      const content = await readFile(join(stateDir, "audit.jsonl"), "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(3);

      const entries = lines.map((l) => JSON.parse(l) as AuditEntry);
      expect(entries[0].agentName).toBe("agent-1");
      expect(entries[1].agentName).toBe("agent-2");
      expect(entries[2].agentName).toBe("agent-3");
    });

    it("returns the completed entry with generated fields", async () => {
      const result = await audit.record(makeEntry());
      expect(result.action).toBe("deploy");
      expect(result.actor).toBe("alice@example.com");
      expect(result.environment).toBe("production");
      expect(result.agentName).toBe("support-triage");
      expect(result.configHash).toBe("abc123def456");
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("handles many sequential writes without corruption", async () => {
      for (let i = 0; i < 10; i++) {
        await audit.record(makeEntry({ agentName: `agent-${i}` }));
      }

      const content = await readFile(join(stateDir, "audit.jsonl"), "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(10);

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx vitest run src/audit/trail.test.ts`
Expected: All tests FAIL with "Not yet implemented"

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/enterprise/src/audit/trail.test.ts
git commit -m "test(enterprise): add failing tests for AuditTrail.record()"
```

---

### Task 3: Implement record() to pass the tests

**Files:**
- Modify: `packages/enterprise/src/audit/trail.ts`

- [ ] **Step 1: Implement the AuditTrail class with record()**

Replace the `AuditTrail` class in `packages/enterprise/src/audit/trail.ts` (keep all the types/interfaces above it):

```typescript
const AUDIT_FILE = "audit.jsonl";
const REQUIRED_FIELDS: (keyof AuditEntryInput)[] = [
  "action",
  "actor",
  "environment",
  "agentName",
  "configHash",
];
const VALID_ACTIONS = new Set(["deploy", "rollback", "delete"]);

interface AuditTrailOptions {
  stateDir?: string;
}

export class AuditTrail implements IAuditTrail {
  private readonly stateDir: string;
  private readonly auditPath: string;

  constructor(options?: AuditTrailOptions) {
    this.stateDir = options?.stateDir ?? ".forge";
    this.auditPath = join(this.stateDir, AUDIT_FILE);
  }

  async record(entry: AuditEntryInput): Promise<AuditEntry> {
    // Validate required fields
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field]) {
        throw new Error(`Missing required audit field: ${field}`);
      }
    }

    // Validate action enum
    if (!VALID_ACTIONS.has(entry.action)) {
      throw new Error(`Invalid audit action: "${entry.action}". Must be one of: deploy, rollback, delete`);
    }

    // Build complete entry with auto-generated fields
    const complete: AuditEntry = {
      id: entry.id ?? randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      action: entry.action,
      actor: entry.actor,
      environment: entry.environment,
      agentName: entry.agentName,
      configHash: entry.configHash,
      ...(entry.previousHash !== undefined && { previousHash: entry.previousHash }),
      ...(entry.metadata !== undefined && { metadata: entry.metadata }),
    };

    // Ensure state directory exists
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });

    // Append entry as a JSONL line
    await appendFile(this.auditPath, JSON.stringify(complete) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });

    return complete;
  }

  async query(_filter: Partial<AuditEntry>): Promise<AuditEntry[]> {
    throw new Error("Not yet implemented");
  }

  async getHistory(_agentName: string): Promise<AuditEntry[]> {
    throw new Error("Not yet implemented");
  }
}
```

- [ ] **Step 2: Run the record() tests to verify they pass**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx vitest run src/audit/trail.test.ts`
Expected: All `record()` tests PASS

- [ ] **Step 3: Run typecheck to verify no type errors**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/audit/trail.ts
git commit -m "feat(enterprise): implement AuditTrail.record() with JSONL storage"
```

---

## Chunk 3: Tests and Implementation — query() and getHistory()

### Task 4: Write failing tests for query() and getHistory()

**Files:**
- Modify: `packages/enterprise/src/audit/trail.test.ts`

- [ ] **Step 1: Add query() and getHistory() test blocks**

Append these `describe` blocks inside the outer `describe("AuditTrail")` block in `trail.test.ts`, after the `record()` describe block:

```typescript
  describe("query()", () => {
    it("filters by single field", async () => {
      await audit.record(makeEntry({ action: "deploy", agentName: "agent-1" }));
      await audit.record(makeEntry({ action: "rollback", agentName: "agent-2" }));
      await audit.record(makeEntry({ action: "deploy", agentName: "agent-3" }));

      const results = await audit.query({ action: "deploy" });
      expect(results).toHaveLength(2);
      expect(results[0].agentName).toBe("agent-1");
      expect(results[1].agentName).toBe("agent-3");
    });

    it("filters by multiple fields", async () => {
      await audit.record(makeEntry({ action: "deploy", environment: "dev" }));
      await audit.record(makeEntry({ action: "deploy", environment: "production" }));
      await audit.record(makeEntry({ action: "rollback", environment: "production" }));

      const results = await audit.query({ action: "deploy", environment: "production" });
      expect(results).toHaveLength(1);
      expect(results[0].environment).toBe("production");
      expect(results[0].action).toBe("deploy");
    });

    it("returns empty array when no matches", async () => {
      await audit.record(makeEntry({ action: "deploy" }));
      const results = await audit.query({ action: "rollback" });
      expect(results).toHaveLength(0);
    });

    it("returns empty array when audit file does not exist", async () => {
      const results = await audit.query({ action: "deploy" });
      expect(results).toHaveLength(0);
    });

    it("skips malformed JSONL lines without crashing", async () => {
      // Write a valid entry, then corrupt the file, then write another valid entry
      await audit.record(makeEntry({ agentName: "valid-1" }));

      // Manually append a malformed line
      const { appendFile: appendRaw } = await import("node:fs/promises");
      await appendRaw(join(stateDir, "audit.jsonl"), "NOT VALID JSON\n");

      await audit.record(makeEntry({ agentName: "valid-2" }));

      const results = await audit.query({});
      expect(results).toHaveLength(2);
      expect(results[0].agentName).toBe("valid-1");
      expect(results[1].agentName).toBe("valid-2");
    });

    it("returns all entries when filter is empty", async () => {
      await audit.record(makeEntry({ agentName: "agent-1" }));
      await audit.record(makeEntry({ agentName: "agent-2" }));
      await audit.record(makeEntry({ agentName: "agent-3" }));

      const results = await audit.query({});
      expect(results).toHaveLength(3);
    });

    it("ignores metadata field in filter", async () => {
      await audit.record(makeEntry({ metadata: { key: "value" } }));

      // Filtering by metadata should be ignored — entry still matches
      const results = await audit.query({ metadata: { key: "other" } } as Partial<AuditEntry>);
      expect(results).toHaveLength(1);
    });
  });

  describe("getHistory()", () => {
    it("returns all entries for a given agent in chronological order", async () => {
      await audit.record(makeEntry({ agentName: "agent-a", action: "deploy" }));
      await audit.record(makeEntry({ agentName: "agent-b", action: "deploy" }));
      await audit.record(makeEntry({ agentName: "agent-a", action: "rollback" }));

      const history = await audit.getHistory("agent-a");
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe("deploy");
      expect(history[1].action).toBe("rollback");
    });

    it("returns empty array for unknown agent", async () => {
      await audit.record(makeEntry({ agentName: "agent-a" }));
      const history = await audit.getHistory("unknown-agent");
      expect(history).toHaveLength(0);
    });
  });
```

- [ ] **Step 2: Run the tests to verify query/getHistory tests fail**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx vitest run src/audit/trail.test.ts`
Expected: `record()` tests PASS, `query()` and `getHistory()` tests FAIL with "Not yet implemented"

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/enterprise/src/audit/trail.test.ts
git commit -m "test(enterprise): add failing tests for AuditTrail.query() and getHistory()"
```

---

### Task 5: Implement query() and getHistory()

**Files:**
- Modify: `packages/enterprise/src/audit/trail.ts`

- [ ] **Step 1: Add a private readEntries() helper and implement query() and getHistory()**

Add this private method to the `AuditTrail` class, and replace the `query()` and `getHistory()` stubs:

```typescript
  /**
   * Read and parse all valid entries from the audit JSONL file.
   * Skips malformed lines with a warning.
   */
  private async readEntries(): Promise<AuditEntry[]> {
    let raw: string;
    try {
      raw = await readFile(this.auditPath, "utf-8");
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }

    const entries: AuditEntry[] = [];
    const lines = raw.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        entries.push(JSON.parse(trimmed) as AuditEntry);
      } catch {
        console.warn(`Warning: Skipping malformed audit entry: ${trimmed.slice(0, 80)}`);
      }
    }

    return entries;
  }

  // Filterable string fields (metadata excluded — object equality is unreliable)
  private static readonly FILTERABLE_FIELDS: (keyof AuditEntry)[] = [
    "id",
    "action",
    "actor",
    "environment",
    "agentName",
    "configHash",
    "previousHash",
  ];

  async query(filter: Partial<AuditEntry>): Promise<AuditEntry[]> {
    const entries = await this.readEntries();

    return entries.filter((entry) =>
      AuditTrail.FILTERABLE_FIELDS.every((field) => {
        if (!(field in filter) || filter[field] === undefined) return true;
        return entry[field] === filter[field];
      })
    );
  }

  async getHistory(agentName: string): Promise<AuditEntry[]> {
    return this.query({ agentName });
  }
```

- [ ] **Step 2: Run all tests to verify they pass**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx vitest run src/audit/trail.test.ts`
Expected: ALL tests PASS

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise/src/audit/trail.ts
git commit -m "feat(enterprise): implement AuditTrail.query() and getHistory() with JSONL reader"
```

---

## Chunk 4: Build Verification and Final Commit

### Task 6: Full build and test verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full enterprise package test suite**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx vitest run`
Expected: All 20 tests pass (11 record + 7 query + 2 getHistory)

- [ ] **Step 2: Build the enterprise package**

Run: `cd /Users/sfraser/DevOps/Projects/forge/packages/enterprise && npx tsup src/index.ts --format esm,cjs --dts`
Expected: Build succeeds, generates `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`

- [ ] **Step 3: Run full monorepo build to ensure no cross-package breakage**

Run: `cd /Users/sfraser/DevOps/Projects/forge && pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Run full monorepo test suite**

Run: `cd /Users/sfraser/DevOps/Projects/forge && pnpm test`
Expected: All tests pass across all packages
