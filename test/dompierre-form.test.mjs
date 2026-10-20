import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectDompierreSource,
  dompierreSourcePins,
  dompierreCategories,
  dompierreRequirements,
  verifyDompierreSources,
} from '../dist/dompierre-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation = 'Nonurgent fault of actual Dompierre VD communal road confirmed';

test('Dompierre publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(dompierreSourcePins.length, 4);
  assert.ok(Object.isFrozen(dompierreSourcePins) && dompierreSourcePins.every(Object.isFrozen));
  assert.ok(dompierreSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(dompierreSourcePins.map((p) => p.url)).size, 4);
  for (const p of dompierreSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectDompierreSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = dompierreRequirements()['Routes communales'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /Initial optional call/);
  assert.match(r.scope, /telephone0788739737/);
  assert.match(r.scope, /Telephone reporter requirements/);
  assert.throws(
    () => inspectMunicipalForm('dompierre-roads', 'Own offline example'),
    /complete pinned/,
  );
});

test('Dompierre failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyDompierreSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('dompierre-roads', request, {
      places: { municipality: async () => ({ bfs_id: 5671 }) },
    });
    city.cached = { value: dompierreCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.712, longitude: 6.857 }), /paused/);
    await assert.rejects(
      verifyDompierreSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [dompierreSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Dompierre exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'dompierre-roads',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5673 }) } },
  );
  assert.deepEqual(await city.categories(), dompierreCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.712, longitude: 6.857 }),
    /municipality|boundary|Dompierre/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('dompierre-roads', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Dompierre local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dompierre-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient('dompierre-roads', async () => assert.fail('offline only'), {
    places: { municipality: async () => ({ bfs_id: 5671 }) },
  });
  city.requirements = async () => dompierreRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.712,
    longitude: 6.857,
    location_confirmed: true,
    location_label: 'Offline actual communal road',
    category: 'Routes communales',
    description:
      'Le revêtement communal fictif est usé, sans danger ni risque immédiat pour la circulation.',
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
  assert.equal(p.municipality.bfs_id, 5671);
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
    description: 'Le second revêtement communal fictif est usé, sans risque immédiat.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
