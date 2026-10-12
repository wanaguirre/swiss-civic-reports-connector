import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('package.json'));
// Build first with npm test or npm run build. Ignore lifecycle scripts here so
// this checks exactly those tested bytes and never silently rebuilds them.
const [archive] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const files = new Set(archive.files.map((file) => file.path));
const expectedRuntime = new Set(
  (await readdir(new URL('../src/', import.meta.url)))
    .filter((name) => name.endsWith('.ts'))
    .flatMap((name) => [`dist/${name.slice(0, -3)}.js`, `dist/${name.slice(0, -3)}.d.ts`]),
);
assert.deepEqual(
  new Set([...files].filter((path) => path.startsWith('dist/'))),
  expectedRuntime,
  'Release runtime must match the current source; rebuild to remove stale or missing modules.',
);
for (const entry of [
  ...Object.values(manifest.bin),
  ...Object.values(manifest.exports).flatMap(Object.values),
]) {
  assert.ok(files.has(entry.replace(/^\.\//, '')), `Missing package entrypoint: ${entry}`);
}
for (const path of [
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.env.example',
  'docs/SETUP.md',
  'docs/DEVELOPMENT.md',
  'docs/ARCHITECTURE.md',
  'skills/zurich-reports/SKILL.md',
]) {
  assert.ok(files.has(path), `Missing package documentation: ${path}`);
}
// A source checkout can hide broken archive links: validate local Markdown
// targets against the package inventory, not just the working directory.
for (const path of files) {
  if (!path.endsWith('.md')) continue;
  for (const [, target] of (await read(path)).matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
    const local = decodeURIComponent(target.split('#')[0]);
    const resolved = posix.normalize(posix.join(posix.dirname(path), local));
    assert.ok(files.has(resolved), `Broken package link in ${path}: ${target}`);
  }
}
assert.ok(
  ![...files].some(
    (path) =>
      /^(?:src|test|web|ui|deploy|node_modules)\//.test(path) ||
      (/(?:^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example'),
  ),
  'Unexpected private or development content in package.',
);
console.log(
  `Package verified: ${files.size} files, current runtime, valid exports and documentation links.`,
);
