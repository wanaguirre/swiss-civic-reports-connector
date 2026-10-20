import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectSaintSulpiceSource,
  saintSulpiceSourcePins,
  saintSulpiceCategories,
  saintSulpiceRequirements,
  verifySaintSulpiceSources,
} from '../dist/saint-sulpice-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation = 'Nonurgent fault of actual Saint-Sulpice communal streetlight confirmed';

test('SaintSulpice publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(saintSulpiceSourcePins.length, 5);
  assert.ok(
    Object.isFrozen(saintSulpiceSourcePins) && saintSulpiceSourcePins.every(Object.isFrozen),
  );
  assert.ok(
    saintSulpiceSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')),
  );
  assert.equal(new Set(saintSulpiceSourcePins.map((p) => p.url)).size, 5);
  for (const p of saintSulpiceSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectSaintSulpiceSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = saintSulpiceRequirements()['Éclairage public communal'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /initial optional call/);
  assert.match(r.scope, /published telephone route/);
  assert.match(r.scope, /Phone reporter requirements/);
  assert.throws(
    () => inspectMunicipalForm('saint-sulpice-lighting', 'Own offline example'),
    /complete pinned/,
  );
});

test('SaintSulpice failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
  const cases = [
    () => new Response('blocked', { status: 403 }),
    () => new Response('limited', { status: 429, headers: { 'retry-after': '3600' } }),
    () =>
      new Response('redirect', { status: 302, headers: { location: 'https://example.invalid/' } }),
    () =>
      new Response('Independent own source', {
        headers: { 'content-type': 'application/json' },
      }),
    () => response('Independent own source' + 'drift', true),
    () => response(new Uint8Array([0xc3, 0x28]), true),
    () => response('x'.repeat(1_000_001), true),
    () => {
      throw new Error('offline timeout');
    },
  ];
  for (const fail of cases) {
    const calls = [],
      delays = [];
    const request = async (url) => {
      calls.push(url);
      return fail();
    };
    await assert.rejects(
      verifySaintSulpiceSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('saint-sulpice-lighting', request, {
      places: { municipality: async () => ({ bfs_id: 5648 }) },
    });
    city.cached = { value: saintSulpiceCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.5092, longitude: 6.56 }), /paused/);
    await assert.rejects(
      verifySaintSulpiceSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [saintSulpiceSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('SaintSulpice exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'saint-sulpice-lighting',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5649 }) } },
  );
  assert.deepEqual(await city.categories(), saintSulpiceCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.5092, longitude: 6.56 }),
    /municipality|boundary|SaintSulpice/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('saint-sulpice-lighting', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('SaintSulpice local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'saintSulpice-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'saint-sulpice-lighting',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5648 }) },
    },
  );
  city.requirements = async () => saintSulpiceRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.5092,
    longitude: 6.56,
    location_confirmed: true,
    location_label: 'Offline actual communal streetlight',
    category: 'Éclairage public communal',
    description: 'Le luminaire communal fictif au point confirmé est éteint, sans danger immédiat.',
    email: '',
    photo_ids: [],
    extra_fields: { public_asset_confirmed: confirmation },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0240000000' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { public_asset_confirmed: 'Private asset' } },
    { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const image = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [image.photo_id] }), /photo/);
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5648);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.report.email, '');
  assert.doesNotMatch(JSON.stringify(p.report), /PrivateName|private@example.invalid|native_state/);
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true),
    /unverified|verification|disabled/i,
  );
  const q = await service.prepare({
    ...input,
    description: 'Le second luminaire communal fictif est éteint, sans danger immédiat.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
