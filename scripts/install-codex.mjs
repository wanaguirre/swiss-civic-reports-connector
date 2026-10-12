#!/usr/bin/env node
import { access, cp, mkdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entrypoint = join(project, 'dist', 'cli.js');
const node = await realpath(process.execPath);
const skillSource = join(project, 'skills', 'zurich-reports');
const skillTarget = join(
  process.env.CODEX_HOME ?? join(homedir(), '.codex'),
  'skills',
  'zurich-reports',
);
const args = [
  'mcp',
  'add',
  'zueri-wie-neu',
  '--env',
  'ZURI_ENABLE_SUBMISSION=false',
  '--',
  node,
  entrypoint,
];
await access(entrypoint);
await access(join(skillSource, 'SKILL.md'));
if (process.argv.includes('--dry-run')) {
  console.log(
    JSON.stringify(
      {
        mcp_command: ['codex', ...args],
        skill_source: skillSource,
        skill_destination: skillTarget,
        changes:
          'Register this built local server with city writes disabled; copy its companion skill. Existing configuration is not overwritten.',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (process.argv.length > 2) throw new Error('Usage: node scripts/install-codex.mjs [--dry-run]');
try {
  await access(skillTarget);
  throw new Error(
    `Skill already exists at ${skillTarget}; installation stopped without overwriting it.`,
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const existing = spawnSync('codex', ['mcp', 'get', 'zueri-wie-neu', '--json'], {
  encoding: 'utf8',
});
if (existing.error)
  throw new Error(
    'Codex CLI is unavailable. Install it or use the manual MCP configuration in README.md.',
  );
if (existing.status === 0)
  throw new Error(
    'An MCP named zueri-wie-neu already exists. Installation stopped without overwriting it.',
  );
if (!existing.stderr.includes("No MCP server named 'zueri-wie-neu' found"))
  throw new Error('Could not verify existing MCP configuration; no changes made.');
const added = spawnSync('codex', args, { encoding: 'utf8' });
if (added.status !== 0)
  throw new Error(
    `Could not register MCP: ${added.stderr || added.error?.message || 'unknown error'}`,
  );
await mkdir(dirname(skillTarget), { recursive: true });
try {
  await cp(skillSource, skillTarget, { recursive: true, errorOnExist: true, force: false });
} catch (error) {
  throw new Error(
    `MCP was registered, but skill copy failed: ${error.message}. Copy ${skillSource} to ${skillTarget} after resolving the error.`,
  );
}
console.log(
  'Installed zueri-wie-neu MCP and zurich-reports skill. Start a new task/restart Codex to load them. City submission remains disabled.',
);
