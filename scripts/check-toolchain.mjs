// Security floors are coordinated across workspace test/build consumers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const root = read('package.json');
assert.equal(root.pnpm.overrides['tsup@8.5.1>esbuild'], undefined,
  'retain the documented low advisory rather than force esbuild outside tsup\'s declared pre-1.0 minor range');
for (const path of ['package.json', 'packages/sdk/package.json', 'packages/adapters/package.json', 'packages/cli/package.json']) {
  const pkg = read(path);
  assert.equal(pkg.devDependencies.vitest, '4.1.12', `${path}: use patched Node-20-compatible Vitest`);
  assert.equal(pkg.devDependencies.tsup, '8.5.1', `${path}: use patched Node-20-compatible build tool`);
}
assert.equal(root.devDependencies['@vitest/coverage-v8'], root.devDependencies.vitest);
assert.equal(root.devDependencies.vite, '7.3.7');
assert.equal(root.devDependencies.eslint, '10.13.0');
assert.equal(root.devDependencies['@typescript-eslint/parser'], '8.71.2');
assert.equal(root.devDependencies['@typescript-eslint/eslint-plugin'], '8.71.2');
assert.equal(root.engines.node, '^20.19.0 || ^22.13.0 || >=24.0.0');
for (const [selector, version] of Object.entries(root.pnpm.overrides)) {
  assert(selector.includes('@'), `unqualified graph-wide override: ${selector}`);
  assert(!version.startsWith('>='), `unbounded security override: ${selector}`);
}
for (const name of ['sdk', 'adapters', 'cli']) {
  assert.equal(read(`packages/${name}/package.json`).engines.node, '>=20.0.0', 'published runtime stays Node 20');
}
console.log('toolchain security contract ok: patched coordinated test/build/lint dependencies; scoped overrides; Node 20 runtime');
