import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectDuillierSource,
  duillierSourcePins,
  duillierCategories,
  duillierRequirements,
  verifyDuillierSources,
} from '../dist/seic-lighting-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation = 'Nonurgent fault of actual Duillier communal public streetlight confirmed';

test('Duillier publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(duillierSourcePins.length, 4);
  assert.ok(Object.isFrozen(duillierSourcePins) && duillierSourcePins.every(Object.isFrozen));
  assert.ok(duillierSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(duillierSourcePins.map((p) => p.url)).size, 4);
  for (const p of duillierSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectDuillierSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = duillierRequirements()['Éclairage public communal'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /not a complete official form/);
  assert.match(r.scope, /emergency telephone is not an ordinary fallback/);
  assert.match(r.scope, /unknown identifiers remain missing/);
  assert.ok(duillierSourcePins.every((p) => new URL(p.url).host === 'www.duillier.ch'));
  assert.match(
    r.scope,
    /requires description, city, street and number, title, surname, first name and email/,
  );
  assert.deepEqual(r.extra_fields.find((f) => f.code === 'fault_kind').values, [
    'Ne fonctionne pas',
    'Fonctionne par intermittence',
  ]);
  assert.throws(
    () => inspectMunicipalForm('seic-duillier-lighting-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Duillier failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyDuillierSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('seic-duillier-lighting-note', request, {
      places: { municipality: async () => ({ bfs_id: 5715 }) },
    });
    city.cached = { value: duillierCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.441, longitude: 6.248 }), /paused/);
    await assert.rejects(
      verifyDuillierSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [duillierSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Duillier exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'seic-duillier-lighting-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5704 }) } },
  );
  assert.deepEqual(await city.categories(), duillierCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.441, longitude: 6.248 }),
    /municipality|boundary|Duillier/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('seic-duillier-lighting-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Duillier local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'duillier-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'seic-duillier-lighting-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5715 }) },
    },
  );
  city.requirements = async () => duillierRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.441,
    longitude: 6.248,
    location_confirmed: true,
    location_label: 'Offline actual communal public streetlight',
    category: 'Éclairage public communal',
    description: 'Le luminaire fictif de Duillier ne fonctionne plus, sans danger immédiat.',
    email: '',
    photo_ids: [],
    extra_fields: {
      public_asset_confirmed: confirmation,
      street_name: 'Rue fictive hors ligne',
      fault_kind: 'Ne fonctionne pas',
    },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0240000000' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { ...input.extra_fields, street_name: '' } },
    { extra_fields: { ...input.extra_fields, street_name: 'x'.repeat(151) } },
    { extra_fields: { ...input.extra_fields, known_lamp_number: 'x'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Invented native option' } },
    { extra_fields: { public_asset_confirmed: 'Private asset' } },
    { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, native_city: 'Duillier' } },
    { extra_fields: { ...input.extra_fields, title: 'Monsieur' } },
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
  assert.equal(p.municipality.bfs_id, 5715);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.known_lamp_number, undefined);
  assert.equal(p.report.extra_fields.known_street_number, undefined);
  const numbered = await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, known_street_number: '12A', known_lamp_number: 'L-42' },
  });
  assert.equal(numbered.report.extra_fields.known_lamp_number, 'L-42');
  assert.equal(numbered.report.extra_fields.known_street_number, '12A');
  assert.doesNotMatch(JSON.stringify(p.report), /PrivateName|private@example.invalid|native_state/);
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true),
    /unverified|verification|disabled/i,
  );
  const q = await service.prepare({
    ...input,
    description:
      'Le second luminaire fictif de Duillier fonctionne par intermittence, sans danger immédiat.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
