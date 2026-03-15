# Enterprise Features

Forge Enterprise adds governance, security, and compliance features for teams running agents in production. Licensed under BUSL-1.1.

## Installation

```bash
npm install @openforge-ai/enterprise
```

## Features Overview

### Audit Trail

Immutable, append-only log of every deployment, rollback, and configuration change. Every action is recorded with the actor, environment, config hash, and timestamp to `.forge/audit.jsonl`.

```typescript
import { AuditTrail } from "@openforge-ai/enterprise";

const audit = new AuditTrail({ stateDir: ".forge" });

const entry = await audit.record({
  action: "deploy",
  actor: "alice@example.com",
  environment: "production",
  agentName: "support-triage",
  configHash: "84ef0d1ddb5f...",
});

// Query the log
const deploys = await audit.query({ action: "deploy", environment: "production" });
const history = await audit.getHistory("support-triage");
```

### RBAC (Role-Based Access Control)

Control who can deploy to which environments. Roles are defined as config with granular permissions and optional environment restrictions.

```typescript
import { RbacManager } from "@openforge-ai/enterprise";

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

await rbac.assignRole("alice@example.com", "operator");
const allowed = await rbac.checkPermission("alice@example.com", "deploy", "production");
```

Key behaviors:
- Unassigned users fall back to `defaultRole`
- The `admin` permission bypasses all environment restrictions
- Assignments persist to `.forge/rbac-assignments.json`

### Gated Environment Promotion

Require approvals before promoting an agent from one environment to another. Configurable approval chains ensure the right people sign off.

```typescript
import { PromotionManager } from "@openforge-ai/enterprise";

const promotions = new PromotionManager({
  rules: [{
    from: "staging",
    to: "production",
    requireApproval: true,
    approvers: ["alice@example.com", "bob@example.com"],
    requireTests: true,
    requireAudit: true,
  }],
});

const request = await promotions.requestPromotion({
  agentName: "support-triage",
  fromEnv: "staging",
  toEnv: "production",
  configHash: "84ef0d1ddb5f...",
  requestedBy: "charlie@example.com",
});

await promotions.approvePromotion(request.id, "alice@example.com");
```

### Secrets Management

Inject secrets at deploy time without hardcoding them in `forge.yaml` or state files. Currently resolves from environment variables, with cloud vault adapters planned.

```typescript
import { SecretsManager } from "@openforge-ai/enterprise";

const secrets = new SecretsManager({
  provider: "aws-ssm",
  region: "us-east-1",
});

const apiKey = await secrets.resolve("BRAVE_API_KEY");
const all = await secrets.resolveAll(["BRAVE_API_KEY", "DATABASE_URL"]);
```

Supported provider identifiers: `vault`, `aws-ssm`, `gcp-secrets`, `azure-keyvault`.

## Architecture

All enterprise modules follow the same pattern:

- **Config via constructor** — roles, promotion rules, and provider settings are passed at instantiation. They're declarative and belong in your `forge.yaml`.
- **State via file** — user assignments, audit entries, and promotion requests persist to `.forge/` with restrictive file permissions (`0o700` dirs, `0o600` files).

This separation ensures the source of truth for policy is always your config, while operational state is append-only and auditable.

## Full API Reference

See the [@openforge-ai/enterprise README](../packages/enterprise/README.md) for complete API reference with all method signatures, types, and fields.

## License

BUSL-1.1 — see `packages/enterprise/LICENSE` for details.
