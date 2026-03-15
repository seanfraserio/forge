# Forge Enterprise Integration Guide

> A step-by-step guide to setting up Forge with enterprise governance for your team. By the end, you'll have audit logging, role-based access control, gated promotions, and secrets management running in CI/CD.

This is a tutorial. It assumes you have never used Forge before and walks you through every step from installation to a production-ready deployment pipeline. Each step builds on the last. Follow them in order.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** installed (`node --version` to check)
- **A Git repository** for your agent configuration (any repo will do)
- **A terminal** with access to npm or Homebrew
- **Environment variables** for any secrets your agent needs (API keys, database URLs, etc.)

If you plan to follow Part 4 (CI/CD), you'll also need:

- A **GitHub repository** with Actions enabled
- Repository secrets configured in GitHub Settings > Secrets and variables > Actions

---

## Part 1: Foundation Setup

### Step 1: Install Forge CLI

Pick one of these three installation methods.

**npm (global install):**

```bash
npm install -g @openforge-ai/cli
```

**npx (no install, run directly):**

```bash
npx @openforge-ai/cli --version
```

**Homebrew (macOS/Linux):**

```bash
brew tap seanfraserio/tap
brew install forge
```

Verify the installation works:

```bash
forge --version
```

Expected output:

```
forge 0.x.x
```

### Step 2: Create Your First Agent

Create a project directory and write a `forge.yaml` file. This example defines a support ticket triage agent that you'll govern throughout the rest of this guide.

```bash
mkdir forge-enterprise-demo && cd forge-enterprise-demo
git init
```

Create `forge.yaml`:

```yaml
version: "1"

agent:
  name: support-triage
  description: "Routes incoming support tickets by urgency and category"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.3
  max_tokens: 2048

system_prompt:
  inline: "You classify support tickets by urgency (critical, high, medium, low) and route them to the appropriate team."

memory:
  type: none
```

Here's what each field does:

| Field | Purpose |
|-------|---------|
| `version` | Config schema version. Always `"1"` for now. |
| `agent.name` | Unique identifier for this agent. Used in audit logs, promotions, and RBAC. |
| `agent.description` | Human-readable summary. Shows up in `forge diff` output. |
| `model.provider` | LLM provider (anthropic, openai, etc.) |
| `model.name` | Specific model ID. Pin to a dated version for reproducibility. |
| `model.temperature` | Randomness. Lower values (0.1-0.3) for classification tasks, higher for creative tasks. |
| `model.max_tokens` | Maximum response length. |
| `system_prompt.inline` | The agent's instructions. For longer prompts, use `system_prompt.file` instead. |
| `memory.type` | How the agent remembers context. `none` means stateless. |

Validate the config:

```bash
forge validate
```

Expected output:

```
forge.yaml is valid
```

### Step 3: Deploy and Verify

Deploy the agent to your dev environment:

```bash
forge deploy --env dev
```

Run the same command again to confirm idempotency — Forge detects that nothing changed and skips the deploy:

```bash
forge deploy --env dev
```

Expected output:

```
No changes detected. Skipping deploy.
```

Use `forge diff` to preview what a deploy would do before running it:

```bash
forge diff
```

This shows a structured diff between your local `forge.yaml` and the live agent configuration, similar to `terraform plan`. You'll use this in CI/CD pipelines to gate deploys on review.

---

## Part 2: Add Enterprise Governance

This is where Forge goes from "deploy tool" to "enterprise platform." You'll add four layers of governance: audit logging, RBAC, environment promotion gates, and secrets management.

### Step 4: Install the Enterprise Package

```bash
npm init -y
npm install @openforge-ai/enterprise @openforge-ai/sdk
```

The enterprise package requires `@openforge-ai/sdk` as a peer dependency. Both use the `@openforge-ai/` scope.

Add `.forge/` to your `.gitignore` — this directory contains local state files (audit logs, role assignments, promotion requests) that should not be committed:

```bash
echo ".forge/" >> .gitignore
```

### Step 5: Add Audit Logging

Every deployment action gets recorded to an append-only JSONL file. This gives you a tamper-evident history of who deployed what, where, and when.

Create `scripts/deploy-with-audit.ts`:

```typescript
import { AuditTrail } from "@openforge-ai/enterprise";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Initialize the audit trail — stores entries in .forge/audit.jsonl
const audit = new AuditTrail({ stateDir: ".forge" });

// Compute a hash of the current config for traceability
const configContent = readFileSync("forge.yaml", "utf-8");
const configHash = createHash("sha256").update(configContent).digest("hex");

// Record the deployment — id and timestamp are auto-generated
const entry = await audit.record({
  action: "deploy",
  actor: "alice@example.com",
  environment: "dev",
  agentName: "support-triage",
  configHash: configHash,
  metadata: {
    trigger: "manual",
    cliVersion: "0.1.0",
  },
});

console.log(`Audit entry recorded: ${entry.id}`);
console.log(`Timestamp: ${entry.timestamp}`);
console.log(`Config hash: ${entry.configHash}`);
```

Run it:

```bash
npx tsx scripts/deploy-with-audit.ts
```

Expected output:

```
Audit entry recorded: a1b2c3d4-5678-9abc-def0-1234567890ab
Timestamp: 2026-03-15T14:30:00.000Z
Config hash: 84ef0d1ddb5f...
```

Now query the audit log to see what's been recorded:

```typescript
import { AuditTrail } from "@openforge-ai/enterprise";

const audit = new AuditTrail({ stateDir: ".forge" });

// Query all deploys to dev
const devDeploys = await audit.query({ action: "deploy", environment: "dev" });
console.log(`Dev deploys: ${devDeploys.length}`);

// Get full history for the support-triage agent
const history = await audit.getHistory("support-triage");
for (const entry of history) {
  console.log(`${entry.timestamp} | ${entry.action} | ${entry.actor} | ${entry.environment}`);
}

// Get all entries (empty filter returns everything)
const everything = await audit.query({});
console.log(`Total audit entries: ${everything.length}`);
```

You can also inspect the raw JSONL file directly:

```bash
cat .forge/audit.jsonl
```

Each line is a self-contained JSON object:

```json
{"id":"a1b2c3d4-...","timestamp":"2026-03-15T14:30:00.000Z","action":"deploy","actor":"alice@example.com","environment":"dev","agentName":"support-triage","configHash":"84ef0d1d...","metadata":{"trigger":"manual","cliVersion":"0.1.0"}}
```

The file is append-only. Malformed lines are skipped during reads with a warning — a corrupted entry won't block reading the rest of the log.

### Step 6: Set Up Role-Based Access Control

RBAC controls who can deploy, rollback, and manage agents in each environment. You define roles with permissions and optional environment restrictions, then assign users to those roles.

Create `scripts/setup-rbac.ts`:

```typescript
import { RbacManager } from "@openforge-ai/enterprise";

// Define your role policy
const rbac = new RbacManager({
  policy: {
    roles: [
      {
        name: "developer",
        permissions: ["read", "deploy"],
        environments: ["dev"],
      },
      {
        name: "senior-developer",
        permissions: ["read", "deploy"],
        environments: ["dev", "staging"],
      },
      {
        name: "operator",
        permissions: ["read", "deploy", "rollback"],
        // No environments array = allowed in ALL environments
      },
      {
        name: "admin",
        permissions: ["read", "deploy", "rollback", "admin"],
      },
    ],
    defaultRole: "developer",
  },
  stateDir: ".forge",
});

// Assign roles to team members
await rbac.assignRole("alice@example.com", "admin");
await rbac.assignRole("bob@example.com", "operator");
await rbac.assignRole("charlie@example.com", "senior-developer");

console.log("Roles assigned successfully.");

// Verify: can Charlie deploy to staging?
const charlieStaging = await rbac.checkPermission("charlie@example.com", "deploy", "staging");
console.log(`Charlie can deploy to staging: ${charlieStaging}`);
// true — senior-developer has deploy permission in staging

// Verify: can Charlie deploy to production?
const charlieProd = await rbac.checkPermission("charlie@example.com", "deploy", "production");
console.log(`Charlie can deploy to production: ${charlieProd}`);
// false — senior-developer is restricted to dev and staging

// Verify: can Alice deploy to production?
const aliceProd = await rbac.checkPermission("alice@example.com", "deploy", "production");
console.log(`Alice can deploy to production: ${aliceProd}`);
// true — admin permission bypasses all environment restrictions

// Verify: defaultRole fallback for unknown users
const newHireDev = await rbac.checkPermission("new-hire@example.com", "deploy", "dev");
console.log(`New hire can deploy to dev: ${newHireDev}`);
// true — no assignment found, falls back to "developer" role which allows deploy in dev

const newHireProd = await rbac.checkPermission("new-hire@example.com", "deploy", "production");
console.log(`New hire can deploy to production: ${newHireProd}`);
// false — developer role is restricted to dev only

// List all available roles
const roles = await rbac.listRoles();
console.log(`Available roles: ${roles.map((r) => r.name).join(", ")}`);
```

Run it:

```bash
npx tsx scripts/setup-rbac.ts
```

Expected output:

```
Roles assigned successfully.
Charlie can deploy to staging: true
Charlie can deploy to production: false
Alice can deploy to production: true
New hire can deploy to dev: true
New hire can deploy to production: false
Available roles: developer, senior-developer, operator, admin
```

The permission evaluation chain works like this:

1. Look up the user's assigned role from `.forge/rbac-assignments.json`
2. If no assignment exists, fall back to `policy.defaultRole`
3. If still no role, **deny**
4. If the role has the `admin` permission, **allow** (bypasses environment checks entirely)
5. Otherwise, check that the role has the requested permission AND the environment is in the role's `environments` list (or the role has no `environments` restriction)

Role assignments are persisted to `.forge/rbac-assignments.json`:

```bash
cat .forge/rbac-assignments.json
```

```json
{
  "alice@example.com": "admin",
  "bob@example.com": "operator",
  "charlie@example.com": "senior-developer"
}
```

### Step 7: Configure Environment Promotion Gates

Promotion gates prevent agents from being pushed to higher environments without approval. You define rules that specify which transitions need sign-off and who can approve them.

Create `scripts/setup-promotions.ts`:

```typescript
import { PromotionManager } from "@openforge-ai/enterprise";

// Define promotion rules for your pipeline: dev → staging → production
const promotions = new PromotionManager({
  rules: [
    {
      from: "dev",
      to: "staging",
      requireApproval: false,
      requireTests: true,
      requireAudit: true,
    },
    {
      from: "staging",
      to: "production",
      requireApproval: true,
      approvers: ["alice@example.com", "bob@example.com"],
      requireTests: true,
      requireAudit: true,
    },
  ],
  stateDir: ".forge",
});

// Charlie requests a promotion from staging to production
const request = await promotions.requestPromotion({
  agentName: "support-triage",
  fromEnv: "staging",
  toEnv: "production",
  configHash: "84ef0d1ddb5f3a7b9c2e1d4f6a8b0c3e5d7f9a1b3c5e7d9f1a3b5c7e9d1f3a5b",
  requestedBy: "charlie@example.com",
});

console.log(`Promotion request created: ${request.id}`);
console.log(`Status: ${request.status}`);
// Status: pending

// Alice approves (she's in the approvers list)
await promotions.approvePromotion(request.id, "alice@example.com");
console.log("Promotion approved by Alice.");

// Try to approve with an unauthorized user — this will throw
try {
  // First, create another request to demonstrate rejection
  const request2 = await promotions.requestPromotion({
    agentName: "support-triage",
    fromEnv: "staging",
    toEnv: "production",
    configHash: "new-hash-abc123",
    requestedBy: "charlie@example.com",
  });

  await promotions.approvePromotion(request2.id, "charlie@example.com");
} catch (error) {
  console.log(`Rejection: ${(error as Error).message}`);
  // Rejection: User "charlie@example.com" is not an authorized approver for staging → production
}

// List all promotion requests
const allRequests = await promotions.getRequests();
console.log(`\nAll promotion requests: ${allRequests.length}`);
for (const req of allRequests) {
  console.log(`  ${req.id} | ${req.fromEnv} → ${req.toEnv} | ${req.status} | by ${req.requestedBy}`);
}

// Filter requests by agent name
const agentRequests = await promotions.getRequests("support-triage");
console.log(`\nRequests for support-triage: ${agentRequests.length}`);
```

Run it:

```bash
npx tsx scripts/setup-promotions.ts
```

Expected output:

```
Promotion request created: f1e2d3c4-...
Status: pending
Promotion approved by Alice.
Rejection: User "charlie@example.com" is not an authorized approver for staging → production

All promotion requests: 2
  f1e2d3c4-... | staging → production | approved | by charlie@example.com
  a9b8c7d6-... | staging → production | pending | by charlie@example.com

Requests for support-triage: 2
```

You can also add rules at runtime:

```typescript
await promotions.createRule({
  from: "dev",
  to: "staging",
  requireApproval: false,
  requireTests: true,
  requireAudit: false,
});
```

Attempting to create a duplicate rule (same `from` and `to`) throws an error.

### Step 8: Integrate Secrets Management

Secrets management resolves sensitive values from environment variables at deploy time, keeping them out of `forge.yaml` and version control.

Create `scripts/deploy-with-secrets.ts`:

```typescript
import { SecretsManager } from "@openforge-ai/enterprise";

// Initialize with a provider declaration
// Currently resolves from process.env — the provider field is a forward
// declaration for future cloud vault adapters (HashiCorp Vault, AWS SSM,
// GCP Secret Manager, Azure Key Vault)
const secrets = new SecretsManager({
  provider: "aws-ssm",
  region: "us-east-1",
});

// Resolve a single secret
try {
  const apiKey = await secrets.resolve("BRAVE_API_KEY");
  console.log(`BRAVE_API_KEY resolved (${apiKey.length} chars)`);
} catch (error) {
  console.log(`Error: ${(error as Error).message}`);
}

// Resolve multiple secrets at once
try {
  const allSecrets = await secrets.resolveAll(["BRAVE_API_KEY", "DATABASE_URL", "ANTHROPIC_API_KEY"]);
  for (const [key, value] of Object.entries(allSecrets)) {
    console.log(`${key}: resolved (${value.length} chars)`);
  }
} catch (error) {
  // resolveAll throws on the first missing key
  console.log(`Error: ${(error as Error).message}`);
}
```

Set the environment variables and run it:

```bash
export BRAVE_API_KEY="BSA_test_key_1234567890"
export DATABASE_URL="libsql://my-db.turso.io"
export ANTHROPIC_API_KEY="sk-ant-test-1234567890"

npx tsx scripts/deploy-with-secrets.ts
```

Expected output:

```
BRAVE_API_KEY resolved (26 chars)
BRAVE_API_KEY: resolved (26 chars)
DATABASE_URL: resolved (28 chars)
ANTHROPIC_API_KEY: resolved (23 chars)
```

If a secret is missing:

```bash
unset DATABASE_URL
npx tsx scripts/deploy-with-secrets.ts
```

```
BRAVE_API_KEY resolved (26 chars)
Error: Secret "DATABASE_URL" not found in environment variables (provider: aws-ssm)
```

The supported provider values are `"vault"`, `"aws-ssm"`, `"gcp-secrets"`, and `"azure-keyvault"`. Currently all providers resolve from `process.env`. The provider field is stored for future cloud adapter support — when native vault integrations ship, your config won't need to change.

---

## Part 3: Team Onboarding

### Step 9: Design Your Role Structure

Before assigning roles, map out your team's permissions matrix. Here's a realistic example for a team of five:

| Role | Permissions | Environments | Typical Assignee |
|------|------------|--------------|------------------|
| `developer` | `read`, `deploy` | `dev` only | Junior developers, new hires |
| `senior-developer` | `read`, `deploy` | `dev`, `staging` | Senior engineers, tech leads |
| `operator` | `read`, `deploy`, `rollback` | all | DevOps/SRE, on-call engineers |
| `tech-lead` | `read`, `deploy`, `rollback` | `dev`, `staging`, `production` | Team leads, architects |
| `admin` | `read`, `deploy`, `rollback`, `admin` | all (bypasses checks) | Platform team, org admins |

Key design decisions:

- **`developer` is the defaultRole.** Any team member without an explicit assignment gets read and deploy access to dev only. This is the principle of least privilege.
- **`operator` has no environment restriction.** On-call engineers need to rollback in production at 2am without waiting for approvals.
- **`tech-lead` is explicitly scoped.** Unlike admin, tech leads can only operate in environments they're listed for. This gives them production access without the nuclear option of bypassing all checks.
- **`admin` is for platform engineers only.** The `admin` permission bypasses all environment restrictions. Use it sparingly.

### Step 10: Onboard Team Members

Create `scripts/onboard-team.ts` to bulk-assign roles for your team:

```typescript
import { RbacManager } from "@openforge-ai/enterprise";

const rbac = new RbacManager({
  policy: {
    roles: [
      { name: "developer", permissions: ["read", "deploy"], environments: ["dev"] },
      { name: "senior-developer", permissions: ["read", "deploy"], environments: ["dev", "staging"] },
      { name: "operator", permissions: ["read", "deploy", "rollback"] },
      { name: "tech-lead", permissions: ["read", "deploy", "rollback"], environments: ["dev", "staging", "production"] },
      { name: "admin", permissions: ["read", "deploy", "rollback", "admin"] },
    ],
    defaultRole: "developer",
  },
  stateDir: ".forge",
});

// Team roster — define once, update as the team changes
const teamAssignments: Array<{ user: string; role: string }> = [
  { user: "alice@example.com", role: "admin" },
  { user: "bob@example.com", role: "operator" },
  { user: "charlie@example.com", role: "senior-developer" },
  { user: "diana@example.com", role: "tech-lead" },
  { user: "eve@example.com", role: "developer" },
];

// Assign all roles
for (const { user, role } of teamAssignments) {
  await rbac.assignRole(user, role);
  console.log(`Assigned ${role} to ${user}`);
}

// Verify assignments by checking a representative permission for each user
console.log("\nVerification:");
const checks = [
  { user: "alice@example.com", perm: "deploy" as const, env: "production", expect: true },
  { user: "bob@example.com", perm: "rollback" as const, env: "production", expect: true },
  { user: "charlie@example.com", perm: "deploy" as const, env: "production", expect: false },
  { user: "diana@example.com", perm: "deploy" as const, env: "production", expect: true },
  { user: "eve@example.com", perm: "deploy" as const, env: "staging", expect: false },
];

for (const { user, perm, env, expect } of checks) {
  const allowed = await rbac.checkPermission(user, perm, env);
  const status = allowed === expect ? "PASS" : "FAIL";
  console.log(`  [${status}] ${user} → ${perm} in ${env}: ${allowed}`);
}

// List all roles for documentation
const roles = await rbac.listRoles();
console.log("\nConfigured roles:");
for (const role of roles) {
  const envs = role.environments ? role.environments.join(", ") : "all";
  console.log(`  ${role.name}: [${role.permissions.join(", ")}] → ${envs}`);
}
```

Run it:

```bash
npx tsx scripts/onboard-team.ts
```

Expected output:

```
Assigned admin to alice@example.com
Assigned operator to bob@example.com
Assigned senior-developer to charlie@example.com
Assigned tech-lead to diana@example.com
Assigned developer to eve@example.com

Verification:
  [PASS] alice@example.com → deploy in production: true
  [PASS] bob@example.com → rollback in production: true
  [PASS] charlie@example.com → deploy in production: false
  [PASS] diana@example.com → deploy in production: true
  [PASS] eve@example.com → deploy in staging: false

Configured roles:
  developer: [read, deploy] → dev
  senior-developer: [read, deploy] → dev, staging
  operator: [read, deploy, rollback] → all
  tech-lead: [read, deploy, rollback] → dev, staging, production
  admin: [read, deploy, rollback, admin] → all
```

Document your policy by committing the onboarding script and a summary of role definitions. The `.forge/rbac-assignments.json` file is the live state and can be regenerated from the script at any time.

### Step 11: Establish Promotion Workflows

Design a multi-stage promotion pipeline where each transition has different rules.

Create `scripts/promotion-policy.ts`:

```typescript
import { PromotionManager } from "@openforge-ai/enterprise";

const promotions = new PromotionManager({
  rules: [
    // dev → staging: auto-approve, but require tests
    {
      from: "dev",
      to: "staging",
      requireApproval: false,
      requireTests: true,
      requireAudit: true,
    },
    // staging → production: require approval from senior staff
    {
      from: "staging",
      to: "production",
      requireApproval: true,
      approvers: [
        "alice@example.com",   // admin
        "bob@example.com",     // operator
        "diana@example.com",   // tech-lead
      ],
      requireTests: true,
      requireAudit: true,
    },
  ],
  stateDir: ".forge",
});

// Scenario: Charlie promotes from dev to staging (auto-approved, no manual step)
const stagingRequest = await promotions.requestPromotion({
  agentName: "support-triage",
  fromEnv: "dev",
  toEnv: "staging",
  configHash: "abc123def456",
  requestedBy: "charlie@example.com",
});
console.log(`Dev → Staging: ${stagingRequest.status}`);
// Dev → Staging: pending
// (In practice, since requireApproval is false, your deploy script
//  would proceed without waiting for approvePromotion)

// Scenario: Charlie requests production promotion
const prodRequest = await promotions.requestPromotion({
  agentName: "support-triage",
  fromEnv: "staging",
  toEnv: "production",
  configHash: "abc123def456",
  requestedBy: "charlie@example.com",
});
console.log(`Staging → Production: ${prodRequest.status}`);
// Staging → Production: pending

// Diana (tech-lead) approves
await promotions.approvePromotion(prodRequest.id, "diana@example.com");
console.log("Production promotion approved by Diana.");

// Review the promotion history
const requests = await promotions.getRequests("support-triage");
console.log(`\nPromotion history for support-triage:`);
for (const req of requests) {
  console.log(`  ${req.fromEnv} → ${req.toEnv} | ${req.status} | requested by ${req.requestedBy}`);
}
```

Run it:

```bash
npx tsx scripts/promotion-policy.ts
```

Expected output:

```
Dev → Staging: pending
Staging → Production: pending
Production promotion approved by Diana.

Promotion history for support-triage:
  dev → staging | pending | requested by charlie@example.com
  staging → production | approved | requested by charlie@example.com
```

When designing your promotion rules:

- **dev to staging** should be low-friction. Require tests, but let anyone on the team push.
- **staging to production** is the critical gate. Require approval from a named list of senior team members.
- **If a rule has no `approvers` list**, any user can approve. Use this for low-risk transitions only.

---

## Part 4: CI/CD Integration

### Step 12: GitHub Actions Deployment Pipeline

This workflow validates the agent config, checks RBAC permissions, deploys, and records an audit entry. It runs on every push to `main`.

Create `.github/workflows/forge-deploy.yml`:

```yaml
name: Forge Deploy

on:
  push:
    branches: [main]
    paths:
      - "forge.yaml"
      - "scripts/**"

env:
  FORGE_STATE_DIR: ".forge"

jobs:
  validate:
    name: Validate Config
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Validate forge.yaml
        run: npx @openforge-ai/cli validate

  deploy-dev:
    name: Deploy to Dev
    needs: validate
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Restore Forge state
        uses: actions/cache@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}
          restore-keys: |
            forge-state-${{ github.ref }}-
            forge-state-

      - name: Check RBAC permissions
        run: |
          npx tsx -e "
          import { RbacManager } from '@openforge-ai/enterprise';

          const rbac = new RbacManager({
            policy: {
              roles: [
                { name: 'developer', permissions: ['read', 'deploy'], environments: ['dev'] },
                { name: 'operator', permissions: ['read', 'deploy', 'rollback'] },
                { name: 'admin', permissions: ['read', 'deploy', 'rollback', 'admin'] },
              ],
              defaultRole: 'developer',
            },
            stateDir: '.forge',
          });

          const actor = '${{ github.actor }}@github.com';
          const allowed = await rbac.checkPermission(actor, 'deploy', 'dev');
          if (!allowed) {
            console.error('RBAC denied: ' + actor + ' cannot deploy to dev');
            process.exit(1);
          }
          console.log('RBAC check passed for ' + actor);
          "

      - name: Deploy to dev
        run: npx @openforge-ai/cli deploy --env dev
        env:
          BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Record audit entry
        run: |
          npx tsx -e "
          import { AuditTrail } from '@openforge-ai/enterprise';
          import { createHash } from 'node:crypto';
          import { readFileSync } from 'node:fs';

          const audit = new AuditTrail({ stateDir: '.forge' });
          const configHash = createHash('sha256')
            .update(readFileSync('forge.yaml', 'utf-8'))
            .digest('hex');

          await audit.record({
            action: 'deploy',
            actor: '${{ github.actor }}@github.com',
            environment: 'dev',
            agentName: 'support-triage',
            configHash: configHash,
            metadata: {
              runId: '${{ github.run_id }}',
              commitSha: '${{ github.sha }}',
              trigger: 'github-actions',
            },
          });

          console.log('Audit entry recorded.');
          "

      - name: Save Forge state
        uses: actions/cache/save@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}

  deploy-staging:
    name: Deploy to Staging
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Restore Forge state
        uses: actions/cache@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}
          restore-keys: |
            forge-state-${{ github.ref }}-
            forge-state-

      - name: Resolve secrets
        id: secrets
        run: |
          npx tsx -e "
          import { SecretsManager } from '@openforge-ai/enterprise';

          const secrets = new SecretsManager({
            provider: 'aws-ssm',
            region: 'us-east-1',
          });

          const resolved = await secrets.resolveAll([
            'BRAVE_API_KEY',
            'ANTHROPIC_API_KEY',
          ]);

          console.log('All secrets resolved successfully (' + Object.keys(resolved).length + ' keys).');
          "
        env:
          BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Deploy to staging
        run: npx @openforge-ai/cli deploy --env staging
        env:
          BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Record audit entry
        run: |
          npx tsx -e "
          import { AuditTrail } from '@openforge-ai/enterprise';
          import { createHash } from 'node:crypto';
          import { readFileSync } from 'node:fs';

          const audit = new AuditTrail({ stateDir: '.forge' });
          const configHash = createHash('sha256')
            .update(readFileSync('forge.yaml', 'utf-8'))
            .digest('hex');

          await audit.record({
            action: 'deploy',
            actor: '${{ github.actor }}@github.com',
            environment: 'staging',
            agentName: 'support-triage',
            configHash: configHash,
            metadata: {
              runId: '${{ github.run_id }}',
              commitSha: '${{ github.sha }}',
              trigger: 'github-actions',
            },
          });
          "

      - name: Save Forge state
        uses: actions/cache/save@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}

### Step 13: Automated Environment Promotion

This workflow handles the staging-to-production gate. It runs when manually triggered (via `workflow_dispatch`) or when a PR is labeled `promote-to-production`.

Create `.github/workflows/forge-promote.yml`:

```yaml
name: Forge Promote to Production

on:
  workflow_dispatch:
    inputs:
      approver:
        description: "Email of the approver (must be in the approvers list)"
        required: true
        type: string
      agent_name:
        description: "Agent to promote"
        required: true
        default: "support-triage"
        type: string

jobs:
  promote:
    name: Promote to Production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Restore Forge state
        uses: actions/cache@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}
          restore-keys: |
            forge-state-${{ github.ref }}-
            forge-state-

      - name: Request and approve promotion
        run: |
          npx tsx -e "
          import { PromotionManager } from '@openforge-ai/enterprise';
          import { RbacManager } from '@openforge-ai/enterprise';
          import { createHash } from 'node:crypto';
          import { readFileSync } from 'node:fs';

          const configHash = createHash('sha256')
            .update(readFileSync('forge.yaml', 'utf-8'))
            .digest('hex');

          // Check RBAC first
          const rbac = new RbacManager({
            policy: {
              roles: [
                { name: 'developer', permissions: ['read', 'deploy'], environments: ['dev'] },
                { name: 'operator', permissions: ['read', 'deploy', 'rollback'] },
                { name: 'admin', permissions: ['read', 'deploy', 'rollback', 'admin'] },
              ],
              defaultRole: 'developer',
            },
            stateDir: '.forge',
          });

          const approver = '${{ inputs.approver }}';
          const canDeploy = await rbac.checkPermission(approver, 'deploy', 'production');
          if (!canDeploy) {
            console.error('RBAC denied: ' + approver + ' cannot deploy to production');
            process.exit(1);
          }

          // Request and approve promotion
          const promotions = new PromotionManager({
            rules: [{
              from: 'staging',
              to: 'production',
              requireApproval: true,
              approvers: ['alice@example.com', 'bob@example.com', 'diana@example.com'],
              requireTests: true,
              requireAudit: true,
            }],
            stateDir: '.forge',
          });

          const request = await promotions.requestPromotion({
            agentName: '${{ inputs.agent_name }}',
            fromEnv: 'staging',
            toEnv: 'production',
            configHash: configHash,
            requestedBy: '${{ github.actor }}@github.com',
          });

          console.log('Promotion requested: ' + request.id);

          await promotions.approvePromotion(request.id, approver);
          console.log('Promotion approved by ' + approver);
          "

      - name: Deploy to production
        run: npx @openforge-ai/cli deploy --env production
        env:
          BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Record audit entry
        run: |
          npx tsx -e "
          import { AuditTrail } from '@openforge-ai/enterprise';
          import { createHash } from 'node:crypto';
          import { readFileSync } from 'node:fs';

          const audit = new AuditTrail({ stateDir: '.forge' });
          const configHash = createHash('sha256')
            .update(readFileSync('forge.yaml', 'utf-8'))
            .digest('hex');

          await audit.record({
            action: 'deploy',
            actor: '${{ inputs.approver }}',
            environment: 'production',
            agentName: '${{ inputs.agent_name }}',
            configHash: configHash,
            metadata: {
              runId: '${{ github.run_id }}',
              commitSha: '${{ github.sha }}',
              trigger: 'manual-promotion',
              requestedBy: '${{ github.actor }}@github.com',
              approvedBy: '${{ inputs.approver }}',
            },
          });

          console.log('Production deploy audit entry recorded.');
          "

      - name: Save Forge state
        uses: actions/cache/save@v4
        with:
          path: .forge
          key: forge-state-${{ github.ref }}-${{ github.sha }}
```

To trigger this workflow:

1. Go to your repository on GitHub
2. Click **Actions** > **Forge Promote to Production**
3. Click **Run workflow**
4. Enter the approver email and agent name
5. Click **Run workflow**

The GitHub Environment protection rules on `production` provide an additional layer — you can require reviewers at the GitHub level too, so the promotion gate is enforced even if someone bypasses the Forge workflow.

---

## Part 5: Production Readiness

### Step 14: Security Checklist

Before going live, verify each of these items.

**File permissions:**

```bash
# .forge/ directory should be 700 (owner only)
ls -la .forge/
# drwx------  ... .forge/

# State files should be 600 (owner read/write only)
ls -la .forge/audit.jsonl .forge/rbac-assignments.json .forge/promotion-requests.json
# -rw-------  ... audit.jsonl
# -rw-------  ... rbac-assignments.json
# -rw-------  ... promotion-requests.json
```

Forge sets these permissions automatically when creating files. If you restore from backup, re-apply them:

```bash
chmod 700 .forge
chmod 600 .forge/*
```

**Secrets hygiene:**

- No API keys, tokens, or passwords appear in `forge.yaml` or any committed file
- All secrets are resolved via `SecretsManager` from environment variables
- CI/CD secrets are set in GitHub repository settings, not in workflow files
- `.forge/` is in `.gitignore` — audit logs and role assignments stay local

**RBAC coverage:**

- Every team member has an explicit role assignment (don't rely solely on `defaultRole` for anyone who deploys regularly)
- Production deploy permission is limited to operators, tech leads, and admins
- The `admin` role is assigned to two or fewer people
- `defaultRole` grants the minimum viable permissions (read + deploy to dev)

**Audit trail integrity:**

- The audit log at `.forge/audit.jsonl` is append-only — no entries have been deleted or modified
- Every deploy (manual or CI/CD) records an audit entry with `commitSha` and `runId` metadata
- Audit entries include config hashes so you can trace exactly which config was deployed

### Step 15: Operational Checklist

These are ongoing operational practices to maintain your governance posture.

**Audit log monitoring:**

```typescript
import { AuditTrail } from "@openforge-ai/enterprise";

const audit = new AuditTrail({ stateDir: ".forge" });

// Weekly: check for unexpected production deploys
const prodDeploys = await audit.query({ action: "deploy", environment: "production" });
console.log(`Production deploys this period: ${prodDeploys.length}`);
for (const entry of prodDeploys) {
  console.log(`  ${entry.timestamp} by ${entry.actor} — hash: ${entry.configHash.slice(0, 12)}`);
}

// Monthly: check for rollbacks (may indicate instability)
const rollbacks = await audit.query({ action: "rollback" });
if (rollbacks.length > 0) {
  console.log(`\nRollbacks detected: ${rollbacks.length}`);
  for (const entry of rollbacks) {
    console.log(`  ${entry.timestamp} by ${entry.actor} in ${entry.environment}`);
  }
}
```

**Stale role cleanup:**

Review `.forge/rbac-assignments.json` quarterly. Remove users who have left the team. Re-run the onboarding script (Step 10) to reset to the canonical roster.

**Backup `.forge/` directory:**

The `.forge/` directory contains your governance state. Back it up alongside your code:

```bash
# Add to your backup script or CI artifact upload
tar czf forge-state-$(date +%Y%m%d).tar.gz .forge/
```

In CI, you can upload the state as an artifact:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: forge-state-${{ github.sha }}
    path: .forge/
    retention-days: 90
```

**Secrets rotation strategy:**

When rotating API keys or tokens:

1. Set the new value in your CI/CD secrets store (GitHub Settings > Secrets)
2. Deploy to dev first — `SecretsManager.resolve()` will pick up the new value
3. Verify the agent works with the new secret
4. Promote through staging and production using the promotion workflow
5. Revoke the old secret after all environments are updated

### Step 16: Go-Live Checklist

Verify each item before your first production deployment with governance enabled.

**Team setup:**

- [ ] All team members have explicit role assignments in `.forge/rbac-assignments.json`
- [ ] At least two people have `admin` or `operator` roles for production access
- [ ] `defaultRole` is set to the most restrictive appropriate role
- [ ] Role assignments have been verified with `checkPermission` tests

**Promotion rules:**

- [ ] Promotion rules exist for every environment transition (dev to staging, staging to production)
- [ ] Production promotion requires approval from a named approvers list
- [ ] Approvers list includes at least two people (bus factor)
- [ ] Unauthorized approvers are correctly rejected (tested in Step 7)

**CI/CD pipelines:**

- [ ] Deploy workflow validates `forge.yaml` before deploying
- [ ] Deploy workflow checks RBAC permissions before deploying
- [ ] Deploy workflow records audit entries after deploying
- [ ] Promotion workflow requires manual trigger with approver input
- [ ] All secrets are set in GitHub repository settings
- [ ] Workflows use `actions/cache` to persist `.forge/` state between runs

**Audit and compliance:**

- [ ] `.forge/` is in `.gitignore`
- [ ] Audit entries include `commitSha` and `runId` metadata for traceability
- [ ] File permissions on `.forge/` are `700` (directory) and `600` (files)
- [ ] A backup strategy for `.forge/` state is in place

**Operational readiness:**

- [ ] Team knows how to trigger the promotion workflow
- [ ] On-call engineers have `operator` role for emergency rollbacks
- [ ] Audit log monitoring is scheduled (weekly or per-deploy)
- [ ] Secrets rotation process is documented

---

## Next Steps

You now have a fully governed Forge deployment pipeline with audit logging, RBAC, environment promotion gates, and secrets management. Here's where to go from here:

- **[API Reference](../packages/enterprise/README.md)** — Full method signatures, types, and edge case behavior for all enterprise modules
- **[Forge YAML Reference](./forge-yaml-reference.md)** — Complete reference for `forge.yaml` configuration options
- **[Core Concepts](./concepts.md)** — Deeper explanation of Forge's architecture and design philosophy
- **[Architecture](../ARCHITECTURE.md)** — Internal architecture for contributors
- **Support** — Open an issue on [GitHub](https://github.com/seanfraserio/forge) for bugs, feature requests, or questions
