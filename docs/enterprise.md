# Enterprise Features

Forge Enterprise adds governance, security, and compliance features for teams running agents in production.

## License

Enterprise features are licensed under BUSL-1.1. See `packages/enterprise/LICENSE` for details.

## Features

### Audit Trail
Immutable, append-only log of every deployment, rollback, and configuration change. Supports export to SIEM systems.

### RBAC
Role-based access control for agent deployments. Define who can deploy to which environments.

### Gated Environment Promotion
Require approvals before promoting an agent from staging to production. Configurable approval chains.

### Secrets Management
Inject secrets from HashiCorp Vault, AWS SSM, GCP Secret Manager, or Azure Key Vault. Secrets never appear in `forge.yaml`.

### SSO / SAML
Integrate with your identity provider for team access management.

## Getting Started

Contact us for an enterprise license key. Once configured, enterprise features are available as drop-in additions to the standard CLI.
