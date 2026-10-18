/**
 * Durable packaging check against the artifacts the release pipeline produces.
 *
 * Uses `pnpm pack` (workspace-aware) so internal workspace:* dependencies are
 * rewritten to each sibling's own package version. Does not edit source
 * manifests, does not publish, and does not leave tarballs in the repo.
 *
 * No shell. Uses node:child_process and the local pnpm/npm/tsc binaries only.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["sdk", "adapters", "cli"];

function run(cmd, args, cwd, env) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ?? process.env,
  });
}

function readPackedFile(tarballPath, entry) {
  const compressed = readFileSync(tarballPath);
  const archive = gunzipSync(compressed);
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    const entryName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!entryName) break;
    const size = parseInt(header.subarray(124, 136).toString("utf8").trim(), 8);
    offset += 512;
    if (entryName === entry) {
      return archive.subarray(offset, offset + size).toString("utf8");
    }
    offset += Math.ceil(size / 512) * 512;
  }
  throw new Error(`${entry} not found in ${tarballPath}`);
}

function listPackedFiles(tarballPath) {
  const compressed = readFileSync(tarballPath);
  const archive = gunzipSync(compressed);
  const names = [];
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    const entryName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!entryName) break;
    const size = parseInt(header.subarray(124, 136).toString("utf8").trim(), 8);
    if (entryName !== "./" && !entryName.endsWith("/")) names.push(entryName);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function workspaceVersions() {
  const versions = new Map();
  for (const name of packages) {
    const manifest = JSON.parse(readFileSync(join(repoRoot, "packages", name, "package.json"), "utf8"));
    versions.set(manifest.name, manifest.version);
  }
  return versions;
}

const versions = workspaceVersions();
const stage = mkdtempSync(join(tmpdir(), "forge-pack-stage-"));
const packed = [];
const sourceSnapshots = new Map();
const preexistingTarballs = new Map();

for (const name of packages) {
  const cwd = join(repoRoot, "packages", name);
  sourceSnapshots.set(name, readFileSync(join(cwd, "package.json"), "utf8"));
  preexistingTarballs.set(name, new Set(readdirSync(cwd).filter((file) => file.endsWith(".tgz"))));
}

try {
  for (const name of packages) {
    const cwd = join(repoRoot, "packages", name);
    const sourceManifest = JSON.parse(sourceSnapshots.get(name));
    const types = sourceManifest.exports?.["."]?.types ?? sourceManifest.types;
    assert(typeof types === "string" && types.startsWith("./dist/") && !types.includes("/src/"),
      `${name} exports.types must point at published dist declarations, got ${types}`);

    const packedJson = run("pnpm", ["pack", "--pack-destination", stage], cwd);
    const reported = packedJson.trim().split(/\r?\n/).filter(Boolean).at(-1);
    assert(reported && reported.endsWith(".tgz"), `${name} pnpm pack did not report a tarball: ${packedJson}`);
    const tarball = isAbsolute(reported) ? reported : join(stage, reported);
    const tarballName = tarball.split("/").at(-1);
    assert(tarball.startsWith(stage), `${name} tarball was not written to the isolated stage: ${tarball}`);
    assert(existsSync(tarball), `${name} tarball was not written to the isolated stage: ${tarball}`);
    const packageTarballs = readdirSync(cwd).filter((file) => file.endsWith(".tgz"));
    const createdInPackage = packageTarballs.filter((file) => !preexistingTarballs.get(name).has(file));
    assert(createdInPackage.length === 0, `${name} pnpm pack wrote a tarball into the package directory: ${createdInPackage.join(", ")}`);
    assert(readFileSync(join(cwd, "package.json"), "utf8") === sourceSnapshots.get(name),
      `${name} source package.json was mutated by packaging`);

    const files = listPackedFiles(tarball).map((file) => file.replace(/^package\//, ""));
    const allowed = new Set(["package.json", "README.md", "LICENSE"]);
    assert(files.every((file) => allowed.has(file) || file.startsWith("dist/")),
      `${name} tarball includes non-dist source: ${files.join(", ")}`);
    assert(files.includes("dist/index.js"), `${name} tarball missing dist/index.js`);
    if (name === "cli") {
      assert(!files.some((file) => /\.(?:cjs|cts)$/.test(file)),
        "ESM-only CLI tarball contains stale CommonJS build artifacts");
    }
    assert(files.includes("dist/index.d.ts"), `${name} tarball missing dist/index.d.ts`);
    assert(!files.some((file) => file.startsWith("src/")), `${name} tarball unexpectedly includes src/`);

    const packedManifest = JSON.parse(readPackedFile(tarball, "package/package.json"));
    assert(packedManifest.version === sourceManifest.version,
      `${name} packed version ${packedManifest.version} != source ${sourceManifest.version}`);
    for (const [dep, spec] of Object.entries(packedManifest.dependencies ?? {})) {
      assert(!String(spec).startsWith("workspace:"), `${name} tarball still publishes ${dep}@${spec}`);
      if (versions.has(dep)) {
        assert(spec === versions.get(dep),
          `${name} resolved ${dep} to ${spec}, expected sibling version ${versions.get(dep)}`);
      }
    }
    if (packedManifest.exports?.["."]?.types) {
      assert(String(packedManifest.exports["."].types).startsWith("./dist/"),
        `${name} packed exports.types is ${packedManifest.exports["."].types}`);
    }
    packed.push({ name, tarball, files, manifest: packedManifest });
    console.log(`packed ${name}: ${tarballName} (${files.length} files, no src/, workspace deps resolved)`);
  }
} catch (err) {
  rmSync(stage, { recursive: true, force: true });
  throw err;
}

const consumer = mkdtempSync(join(tmpdir(), "forge-pack-consumer-"));
try {
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "forge-pack-consumer",
    private: true,
    type: "module",
  }, null, 2));
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["consumer.ts"],
  }, null, 2));
  writeFileSync(join(consumer, "consumer.ts"), `
import type { ForgeConfig, AgentState } from "@openforge-ai/sdk";
import { AnthropicAdapter } from "@openforge-ai/adapters";

const config: ForgeConfig = {
  version: "1",
  agent: { name: "pack-consumer" },
  model: { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
};

const state: AgentState = {
  configHash: "abc",
  lastDeployed: "2026-01-01T00:00:00.000Z",
  environment: "dev",
  agentName: config.agent.name,
  config,
};

const adapter = new AnthropicAdapter();
const supported = adapter.validateModel(config.model);
if (state.agentName.length === 0 || typeof supported !== "boolean") {
  throw new Error("consumer types did not resolve");
}
`);

  const sdk = packed.find((item) => item.name === "sdk");
  const adapters = packed.find((item) => item.name === "adapters");
  const cli = packed.find((item) => item.name === "cli");
  run("npm", ["install", "--ignore-scripts", "--no-fund", "--no-audit", sdk.tarball, adapters.tarball, cli.tarball], consumer);

  const sdkPkg = JSON.parse(readFileSync(join(consumer, "node_modules/@openforge-ai/sdk/package.json"), "utf8"));
  const adaptersPkg = JSON.parse(readFileSync(join(consumer, "node_modules/@openforge-ai/adapters/package.json"), "utf8"));
  const cliPkg = JSON.parse(readFileSync(join(consumer, "node_modules/@openforge-ai/cli/package.json"), "utf8"));
  assert(!sdkPkg.exports["."].types.includes("/src/"), `installed sdk types still point at source: ${sdkPkg.exports["."].types}`);
  assert(!adaptersPkg.exports["."].types.includes("/src/"), `installed adapters types still point at source: ${adaptersPkg.exports["."].types}`);
  assert(adaptersPkg.dependencies["@openforge-ai/sdk"] === versions.get("@openforge-ai/sdk"),
    `installed adapters depends on sdk ${adaptersPkg.dependencies["@openforge-ai/sdk"]}`);
  assert(cliPkg.dependencies["@openforge-ai/sdk"] === versions.get("@openforge-ai/sdk"),
    `installed cli depends on sdk ${cliPkg.dependencies["@openforge-ai/sdk"]}`);
  assert(cliPkg.dependencies["@openforge-ai/adapters"] === versions.get("@openforge-ai/adapters"),
    `installed cli depends on adapters ${cliPkg.dependencies["@openforge-ai/adapters"]}`);

  run("pnpm", ["exec", "tsc", "--pretty", "false", "-p", join(consumer, "tsconfig.json")], repoRoot);
  console.log("external TypeScript consumer typechecked against packed sdk and adapters");

  const cliJs = readPackedFile(cli.tarball, "package/dist/index.js");
  assert(cliJs.startsWith("#!/usr/bin/env node"), "packed CLI dist/index.js is missing the node shebang");
  assert(cli.manifest.bin?.forgeai === "./dist/index.js", "packed CLI bin does not point at dist/index.js");

  const bin = join(consumer, "node_modules/.bin/forgeai");
  assert(existsSync(bin), "installed forgeai bin is missing");
  const versionOut = run(process.execPath, [bin, "--version"], consumer, { ...process.env, FORCE_COLOR: "0" }).trim();
  assert(versionOut === versions.get("@openforge-ai/cli"),
    `installed forgeai --version printed ${versionOut}, expected ${versions.get("@openforge-ai/cli")}`);
  const helpOut = run(process.execPath, [bin, "--help"], consumer, { ...process.env, FORCE_COLOR: "0" });
  assert(helpOut.includes("forgeai") && helpOut.includes("validate") && helpOut.includes("--version"),
    "installed forgeai --help did not describe the CLI");
  assert(!helpOut.includes("0.2.5"), "installed forgeai --help still mentions the stale 0.2.5 version");
  console.log(`packed CLI --version=${versionOut} and --help ran from the installed bin`);
} catch (err) {
  const stderr = err && err.stderr ? err.stderr.toString() : "";
  const stdout = err && err.stdout ? err.stdout.toString() : "";
  console.error(stdout);
  console.error(stderr);
  console.error(err && err.message ? err.message : err);
  process.exit(1);
} finally {
  rmSync(consumer, { recursive: true, force: true });
  rmSync(stage, { recursive: true, force: true });
}
