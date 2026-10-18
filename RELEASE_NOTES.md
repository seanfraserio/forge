# Forge 0.3.0 — prepared locally, not published

This coordinated SDK/adapters/CLI version is approved for local release preparation only. On 2026-10-18, the public registry listed 0.2.7 as latest for all three packages; 0.3.0 was unused for each, and the remote had no v0.3.0 tag. Availability must be checked again before separately authorized publication. No publication, tag, deployment or tap update is part of this preparation.

## Distribution correction

- Workspace-aware `pnpm pack`/`pnpm -r publish` resolves sibling `workspace:*` dependencies to concrete coordinated versions. Local 0.3.0 tarballs are checked by installing them into an external consumer, typechecking SDK/adapters declarations and running the installed `forgeai` bin. Publication failures are no longer swallowed.
- Immutable public CLI 0.2.6 and 0.2.7 artifacts still contain `workspace:*` dependencies and are not repaired by these source changes. The published 0.2.7 installation failure is distinct from the fixed local artifacts. Do not publish over that existing version.
- The checked-in Homebrew reference intentionally remains at the verified installable legacy 0.2.5 artifact. It does not contain current fixes and is not a claim that 0.3.0 is public. No external tap was changed.

## Compatibility changes — read before upgrading

- The CLI is now ESM-only. Requiring the CLI package as CommonJS is not supported; use the `forgeai` executable. SDK and adapters continue to ship ESM and CommonJS builds and declarations.
- State persistence separates the live configuration comparison hash from the hash of the persisted, redacted configuration. Newly written redacted state can round-trip and support unchanged-deployment detection without storing secret values.
- Legacy envelopes without the persisted hash still load when their embedded configuration matches their existing configuration hash. Old redacted states whose hash refers to the original secret-bearing config cannot be reconstructed and fail closed: they are treated as absent. **A subsequent deploy may plan a create rather than an update/no-op.** Back up local state and inspect `forgeai diff` before redeploying; reconcile real resources manually when necessary. This is not a transparent migration.
- State hashes detect corruption, not authenticated integrity. An attacker able to replace both config and hashes can forge them. Protect the state directory; no authenticity guarantee is made.
- YAML limits now count actual nested collections, not brackets inside comments or prompt scalars. Excessive nesting is rejected without throwing. Memory schema validation follows the SDK discriminated union: vector memory requires a provider; none/in-context memory strip unrelated vector fields.
- The current CLI does not offer rollback. This release does not implement rollback or promise automated recovery from a failed deployment.

## Development-toolchain security

- Coordinated Vitest and coverage-v8 4.1.12, Vite 7.3.7, tsup 8.5.1, ESLint 10.13.0 and TypeScript-ESLint 8.71.2 replace vulnerable development tooling. Test assertions are preserved; all 229 existing tests pass.
- ESLint uses flat config; the previous lint policy is retained, including two existing `no-explicit-any` warnings. The newly recommended ESLint 10 `preserve-caught-error` rule is not enabled as an unrelated behavioral/lint cleanup.
- Overrides are version-qualified transitive patches. Vite selects patched esbuild 0.28.2 within its declared range. tsup 8.5.1 retains its supported esbuild 0.27 range rather than forcing an incompatible pre-1.0 minor override; this leaves one low Windows development-server advisory. tsup 9 accepts patched esbuild but requires a newer development runtime than Node 20. Do not expose affected development servers to untrusted traffic. No production esbuild dependency is introduced.
- Private development requires Node 20.19+ on 20.x, 22.13+ on 22.x, or 24+. Published packages retain `engines.node: >=20.0.0`. Engine metadata usually warns rather than rejects unless package-manager engine-strict is enabled; it does not enforce a runtime guard. Local verification ran on actual Node 20.20.2, not merely Node 22.
- Audits on 2026-10-18: before this pass the full graph had **3 critical, 21 high, 10 moderate, 1 low** findings; production already had zero. After the coordinated updates and parent review, **production has zero findings; the full graph retains one low finding, with zero moderate, high or critical findings**. These are point-in-time registry results, not a guarantee against future advisories. CI/release check both scopes and the manifest security contract; moderate-or-higher findings block Forge's CI/release gates.

## Local acceptance

Frozen install, build, all tests, typecheck, lint, packed external-consumer/bin checks and release-workflow contracts must pass after the version change. Publication remains a separate authorization and remote-CI step; native Homebrew installation and live provider deployment are outside this local verification.
