/**
 * Local regression for the release/CI publication contract.
 * Does not publish, pack, or contact a registry.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const releaseVersion = "0.3.0";
for (const file of ["package.json", "packages/sdk/package.json", "packages/adapters/package.json", "packages/cli/package.json"]) {
  assert(JSON.parse(read(file)).version === releaseVersion, `${file} must use coordinated unused release ${releaseVersion}`);
}

const release = read(".github/workflows/release.yml");
const ci = read(".github/workflows/ci.yml");
const workflows = release + "\n" + ci;
for (const workflow of [ci, release]) {
  assert(workflow.includes('node scripts/check-toolchain.mjs'), 'CI/release must enforce the coordinated toolchain contract');
  assert(workflow.includes('pnpm audit --audit-level=moderate'), 'CI/release must audit development dependencies too');
}
assert(release.includes('body_path: RELEASE_NOTES.md'), 'release must include reviewed compatibility/security notes');

assert(!/\|\|\s*true/.test(workflows), "workflow still swallows publish failures with || true");
assert(!/npm publish/.test(workflows), "workflow still uses raw npm publish");
assert(/pnpm\s+-r\s+publish/.test(release) || /pnpm publish -r/.test(release),
  "release workflow does not use workspace-aware pnpm publish");
assert(/--access public/.test(release), "release workflow does not set public access");
assert(/--no-git-checks/.test(release), "release workflow does not pass --no-git-checks");
assert(!/continue-on-error:\s*true/.test(release), "release publish step continues on error");

assert(/node scripts\/packaging-consumer\.mjs/.test(ci),
  "CI does not run scripts/packaging-consumer.mjs");
const buildAt = ci.indexOf("pnpm build");
const typecheckAt = ci.indexOf("pnpm typecheck");
assert(buildAt !== -1 && typecheckAt > buildAt, "clean-checkout typecheck must run after building exported declarations");
const smokeAt = ci.indexOf("node scripts/packaging-consumer.mjs");
assert(buildAt !== -1 && smokeAt > buildAt, "packaging smoke must run after pnpm build");

const filters = [...release.matchAll(/--filter\s+"([^"]+)"/g)].map((match) => match[1]);
for (const name of ["@openforge-ai/sdk", "@openforge-ai/adapters", "@openforge-ai/cli"]) {
  assert(filters.includes(name), `release filter does not name ${name}: ${filters.join(", ")}`);
}

const brew = read(".github/workflows/brew-release.yml");
const formula = read("homebrew/forgeai.rb");
assert(brew.includes('#{bin}/forgeai --version') && !brew.includes('#{bin}/forge --version'),
  "generated Homebrew formula must test the published forgeai bin, not forge");
assert(/curl\s+-fsSL\s+"\$URL"/.test(brew),
  "Homebrew tarball download must fail on HTTP errors before hashing");
assert(/id: sha\n\s+shell: bash\n/.test(brew),
  "Homebrew checksum pipeline needs explicit bash for GitHub Actions pipefail");
assert(formula.includes('#{bin}/forgeai --version'), "reference formula must test forgeai");
assert(formula.includes('cli-0.2.5.tgz') &&
  formula.includes('28ead4be1aeb0f98e9b2dd9b6a5bf5479b5138dba5c2b2f62a8e2a17ff80a81c'),
  "reference formula must pin the verified installable 0.2.5 artifact, not broken workspace releases");

console.log("release workflow contract ok: pnpm -r publish, no || true, packaging smoke after build");
console.log("Homebrew contract ok: forgeai bin, HTTP failures propagate, verified legacy artifact pinned");
