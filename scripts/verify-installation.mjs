#!/usr/bin/env node
// Live read-only smoke check of a source build or an installed package.
// Synthetic previews stay in a disposable directory; submit_report is never called.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import sharp from 'sharp';

const directory = await mkdtemp(join(tmpdir(), 'civic-install-check-'));
const entrypoint = resolve(process.argv[2] ?? 'dist/cli.js');
const client = new Client({ name: 'civic-installation-check', version: '1' });
const transport = new StdioClientTransport({ command: process.execPath, args: [entrypoint],
  env: { PATH: process.env.PATH ?? '', ZURI_DATA_DIR: directory, ZURI_ENABLE_SUBMISSION: 'false' }, stderr: 'pipe' });
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `${name} failed: ${result.content?.find(c => c.type === 'text')?.text}`);
  return result.structuredContent;
}
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 10);
  assert.equal((await call('server_status')).submission_enabled, false);
  const { categories } = await call('list_categories');
  assert.ok(categories.length > 0);
  const point = { latitude: 47.370183, longitude: 8.535284 };
  assert.equal((await call('resolve_location', point)).inside_city, true);
  const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#dddddd' } }).jpeg().toBuffer();
  const photo = await call('inspect_photo', { base64: image.toString('base64') });
  const preview = await call('prepare_report', { ...point, location_label: 'Basteiplatz, Zürich', location_confirmed: true,
    category: 'Abfall/Sammelstelle', description: 'Synthetic installation check. No real issue. Never submit this preview.',
    email: 'installation-check@example.invalid', photo_ids: [photo.id] });
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.attachments.length, 1);
  assert.equal(new URL(preview.official_form_url).hostname, 'www.zueriwieneu.ch');
  const readBack = await call('get_preview', { preview_id: preview.preview_id });
  assert.deepEqual(readBack.report, preview.report);
  assert.deepEqual(readBack.attachments, preview.attachments);
  assert.equal((await call('list_my_reports')).receipts.length, 0);
  console.log(JSON.stringify({ ok: true, tools: 10, live_categories: categories.length,
    photo_import: true, frozen_preview: true, official_form_link: true,
    submission_enabled: false, submission_attempts: 0 }, null, 2));
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
