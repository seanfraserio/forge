# Installation Methods Design

**Module**: Packaging & distribution for `@forge-ai/*` packages
**Date**: 2026-03-15
**Status**: Approved

## Overview

Set up two installation methods for the Forge CLI: npm/npx (primary) and Homebrew via a custom tap. No source code changes — purely packaging and distribution config.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| npm scope | `@forge-ai` (new org to create) | Consistent with existing package names |
| Homebrew distribution | Custom tap (`seanfraserio/homebrew-tap`) | No approval process, available immediately at v0.1.0 |
| Homebrew formula backend | npm-backed (`npm install`) | Single source of truth, one publish step covers both channels |
| Enterprise package | Published to npm with restricted access note | BUSL-1.1 license, public registry, license enforced by terms not access |
| Homebrew auto-update | GitHub Actions `workflow_run` trigger | Formula updates after npm publish completes, avoiding race condition |
| Publish tooling | `pnpm -r publish` only (never `npm publish`) | pnpm resolves `workspace:*` to real versions at publish time — other tools leave it broken |
| Shebang | tsup `--banner.js` flag (mandatory) | tsup does NOT preserve shebangs from source — must be explicitly configured |

## Part 1: npm / npx

### User Experience

```bash
# One-off execution
npx @forge-ai/cli validate -c forge.yaml

# Global install
npm install -g @forge-ai/cli
forge deploy -c forge.yaml --env production
```

### Package.json Changes

All 4 packages need publishing metadata. Fields to add:

```json
{
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/seanfraserio/forge.git",
    "directory": "packages/<name>"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist"],
  "keywords": ["forge", "ai", "agents", "infrastructure-as-code", "mcp"],
  "description": "<package-specific>"
}
```

**Note**: Enterprise package keeps `"license": "BUSL-1.1"` (already set). CLI, SDK, and adapters get `"license": "MIT"`. `README.md` and `LICENSE` files are auto-included by npm and do not need to be in `files`.

**Critical**: Always use `pnpm -r publish` to publish. Never use `npm publish` directly — it does not resolve `workspace:*` dependency specifiers and will publish broken packages.

**CLI-specific fields** (already present, verify):
- `bin.forge` → `./dist/index.js`
- Shebang `#!/usr/bin/env node` in source entry point

**Root package.json**: Add `repository` field. Stays `private: true`.

### .npmrc

Not needed — the npm public registry is already the default, and the release workflow sets `registry-url` in `setup-node`. Skip creating this file.

### Shebang Configuration

tsup does **not** preserve shebangs from source files. The CLI build script must explicitly add the shebang via the `--banner.js` flag:

```json
"build": "tsup src/index.ts --format esm,cjs --dts --banner.js '#!/usr/bin/env node'"
```

This ensures `dist/index.js` starts with `#!/usr/bin/env node` so the `forge` binary is executable via `npx` and Homebrew.

### Release Flow

Already configured in `.github/workflows/release.yml`:
1. Push tag `v*` → triggers workflow
2. Builds all packages
3. Runs tests
4. Publishes to npm with `pnpm -r publish --access public --no-git-checks`
5. Uses `NPM_TOKEN` secret

No changes needed to the release workflow.

## Part 2: Homebrew Tap

### User Experience

```bash
brew tap seanfraserio/tap
brew install forge
forge --version
```

### Tap Repository

Create `seanfraserio/homebrew-tap` on GitHub containing:

```
homebrew-tap/
└── Formula/
    └── forge.rb
```

### Formula: `forge.rb`

```ruby
class Forge < Formula
  desc "Agent infrastructure as code — the Terraform for AI agents"
  homepage "https://github.com/seanfraserio/forge"
  url "https://registry.npmjs.org/@forge-ai/cli/-/cli-<VERSION>.tgz"
  sha256 "<SHA256>"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match "forge", shell_output("#{bin}/forge --version")
  end
end
```

The formula:
- Downloads the npm tarball directly (no npm global install)
- Uses Homebrew's `std_npm_args` helper (installs to libexec, links to bin)
- Depends on `node@20`
- Includes a smoke test

### Auto-Update Workflow

Add `.github/workflows/brew-release.yml` to the **forge** repo (not the tap repo). Triggered by `workflow_run` on the release workflow (not tag push) to avoid a race condition — the npm tarball must exist before we compute its SHA256.

Trigger:
```yaml
on:
  workflow_run:
    workflows: ["Release"]
    types: [completed]
```

Steps:
1. Exit early if the release workflow failed
2. Extract version from the release workflow's tag
3. Fetch the npm tarball SHA256 from `https://registry.npmjs.org/@forge-ai/cli`
4. Update the formula in `seanfraserio/homebrew-tap` via GitHub API (commit to `main`)
5. Requires a `HOMEBREW_TAP_TOKEN` secret (PAT with `repo` scope for the tap repo)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/cli/package.json` | Modify | Add publish metadata |
| `packages/sdk/package.json` | Modify | Add publish metadata |
| `packages/adapters/package.json` | Modify | Add publish metadata |
| `packages/enterprise/package.json` | Modify | Add publish metadata |
| `package.json` (root) | Modify | Add repository field |
| `.github/workflows/brew-release.yml` | Create | Auto-update Homebrew formula on release |
| Template: `Formula/forge.rb` | Create | Homebrew formula (committed to forge repo for reference, deployed to tap repo) |

## Manual Steps (User Required)

These cannot be automated and must be done by the user:

1. **Create `@forge-ai` npm org**: `npm login` → visit npmjs.com → create org
2. **Set `NPM_TOKEN` secret**: In forge GitHub repo settings → Secrets → Actions
3. **Create `seanfraserio/homebrew-tap` repo**: On GitHub, create public repo
4. **Set `HOMEBREW_TAP_TOKEN` secret**: PAT with repo scope, added to forge repo secrets
5. **First publish**: Tag and push `v0.1.0` to trigger the release workflow

## Out of Scope

- Homebrew core submission (requires traction)
- Native binary compilation (premature for v0.1.0)
- Windows installer / chocolatey / scoop
- Docker image
