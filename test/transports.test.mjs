import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from '../dist/server.js';
import { createHttpApp } from '../dist/http.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
import { CityClient } from '../dist/city.js';
import sharp from 'sharp';
import { importPhoto } from '../dist/photos.js';
import { reportInput } from '../dist/model.js';

async function service() {
  const store = new Store(await mkdtemp(join(tmpdir(), 'zurich-mcp-transport-')));
  await store.initialize();
  return new ReportService(
    new CityClient(async () => {
      throw new Error('No upstream calls permitted in transport tests.');
    }),
    store,
    { submissionEnabled: false, allowPaths: false },
  );
}
const token = 'test-token-only-not-a-real-secret-123456789';

test('MCP handshake exposes ten tools with correct write annotations and rejects false confirmation', async () => {
  const server = createServer(await service());
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 10);
    assert.equal(tools.find((t) => t.name === 'submit_report').annotations.readOnlyHint, false);
    assert.equal(tools.find((t) => t.name === 'list_categories').annotations.readOnlyHint, true);
    const status = await client.callTool({ name: 'server_status', arguments: {} });
    assert.equal(JSON.parse(status.content[0].text).submission_enabled, false);
    const guide = status.structuredContent.reporting_guidance;
    assert.equal(guide.municipality, 'Zürich (city only)');
    assert.equal(guide.sources[0].url, 'https://www.zueriwieneu.ch/faq');
    assert.ok(guide.exclusions.some((rule) => rule.issue === 'Outside Zürich city'));
    const rejected = await client.callTool({
      name: 'submit_report',
      arguments: {
        preview_id: 'f2c74da9-fb85-48f3-8522-021131316421',
        confirmation_token: 'b01b6366-e72d-4e1c-8a57-d2549657e95e',
        human_confirmed: false,
      },
    });
    assert.equal(rejected.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('live category lookup includes municipality guidance for the host model', async () => {
  const s = await service();
  s.city.categories = async () => [{ service_code: 'live-code', service_name: 'Live category' }];
  const server = createServer(s);
  const client = new Client({ name: 'guidance-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const result = await client.callTool({ name: 'list_categories', arguments: {} });
    assert.deepEqual(result.structuredContent.categories, [
      { service_code: 'live-code', service_name: 'Live category' },
    ]);
    assert.equal(result.structuredContent.reporting_guidance.verified_on, '2026-10-04');
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.match(client.getInstructions(), /Do not determine or assert legality/);
  } finally {
    await client.close();
    await server.close();
  }
});

test('MCP preview reuses each encoded thumbnail for chat and optional app metadata', async (t) => {
  const s = await service();
  const photos = [];
  for (const background of ['#123456', '#abcdef']) {
    const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background } })
      .png()
      .toBuffer();
    photos.push(await importPhoto({ base64: bytes.toString('base64') }, false, s.store.now()));
  }
  const input = reportInput.parse({
    latitude: 47.37,
    longitude: 8.53,
    location_label: 'Synthetic test location',
    location_confirmed: true,
    category: 'Test category',
    description: 'Synthetic test description',
    email: 'test@example.test',
    photo_ids: photos.map((photo) => photo.id),
  });
  const preview = await s.store.prepare(input, photos);
  const server = createServer(s),
    client = new Client({ name: 'preview-test', version: '1' });
  t.after(async () => {
    await client.close();
    await server.close();
    await rm(s.store.directory, { recursive: true, force: true });
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  const resizing = t.mock.method(sharp.prototype, 'resize');
  const result = await client.callTool({
    name: 'get_preview',
    arguments: { preview_id: preview.id },
  });
  assert.notEqual(result.isError, true);
  const images = result.content.filter((item) => item.type === 'image');
  assert.equal(images.length, photos.length);
  assert.deepEqual(
    result._meta.photos.map((photo) => photo.data),
    images.map((image) => image.data),
  );
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.equal(resizing.mock.callCount(), photos.length, 'one image-resize pipeline per photo');
});

test('actual stdio entrypoint speaks MCP without stdout noise', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zurich-mcp-stdio-'));
  const client = new Client({ name: 'stdio-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/cli.js')],
    env: {
      PATH: process.env.PATH ?? '',
      ZURI_DATA_DIR: directory,
      ZURI_ENABLE_SUBMISSION: 'false',
    },
    stderr: 'pipe',
  });
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length, 10);
  } finally {
    await client.close();
  }
});

test('HTTP forbids weak tokens and configurations with filesystem access', async () => {
  const s = await service();
  assert.throws(() => createHttpApp(s, 'short'), /32 random/);
  s.options.allowPaths = true;
  assert.throws(() => createHttpApp(s, token), /disable local/);
});

test('HTTP authenticates, rejects hostile Host/Origin, and connects via official SDK', async () => {
  const app = createHttpApp(await service(), token);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const url = new URL(`http://127.0.0.1:${listener.address().port}/mcp`);
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer wrong-token` } })).status,
      401,
    );
    assert.equal(
      (
        await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Origin: 'https://hostile.example' },
        })
      ).status,
      403,
    );
    // Node fetch may normalize/override Host; send the actual header through node:http.
    const invalidHostStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(
        url,
        { headers: { Authorization: `Bearer ${token}`, Host: 'hostile.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(invalidHostStatus, 403);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 405);
    const client = new Client({ name: 'http-test', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    try {
      assert.equal((await client.listTools()).tools.length, 10);
      const result = await client.callTool({
        name: 'inspect_photo',
        arguments: { path: '/etc/passwd' },
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /disabled/);
    } finally {
      await client.close();
    }
  } finally {
    listener.closeAllConnections();
    await new Promise((resolve) => listener.close(resolve));
  }
});
