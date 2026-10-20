import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectLabbayeSource,
  labbayeSourcePins,
  labbayeCategories,
  labbayeRequirements,
  verifyLabbayeSources,
} from '../dist/labbaye-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent fault of actual L Abbaye communal public streetlight at confirmed village and exact point';
test('Labbaye publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(labbayeSourcePins.length, 5);
  assert.ok(Object.isFrozen(labbayeSourcePins) && labbayeSourcePins.every(Object.isFrozen));
  assert.ok(labbayeSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(labbayeSourcePins.map((p) => p.url)).size, 5);
  for (const p of labbayeSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectLabbayeSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = labbayeRequirements()['Éclairage public communal'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /not a complete official form/);
  assert.match(r.scope, /no office, member, substitute, phone or provider fallback/);
  assert.match(r.scope, /communal network ownership/);
  assert.match(r.scope, /village, street and the real candelabrum number if possible/);
  assert.match(r.scope, /info@labbaye.ch/);
  assert.match(r.scope, /No LED technology assumption/);
  assert.match(r.scope, /2021–2026/);
  assert.match(r.scope, /never invented or replaced by zero/);
  assert.deepEqual(r.extra_fields.find((f) => f.code === 'village').values, [
    'L’Abbaye',
    'Le Pont',
    'Les Bioux',
  ]);
  assert.equal(r.extra_fields.find((f) => f.code === 'known_lamp_number').required, false);
  assert.ok(labbayeSourcePins.every((p) => new URL(p.url).host === 'www.labbaye.ch'));
  assert.throws(
    () => inspectMunicipalForm('labbaye-lighting-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Labbaye failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyLabbayeSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('labbaye-lighting-note', request, {
      places: { municipality: async () => ({ bfs_id: 5871 }) },
    });
    city.cached = { value: labbayeCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.65, longitude: 6.32 }), /paused/);
    await assert.rejects(
      verifyLabbayeSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [labbayeSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Labbaye exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'labbaye-lighting-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5872 }) } },
  );
  assert.deepEqual(await city.categories(), labbayeCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.65, longitude: 6.32 }),
    /municipality|boundary|Labbaye/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('labbaye-lighting-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Labbaye constrains actual villages and street facts, rejects sensitive/native data, freezes previews and refuses every send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'labbaye-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'labbaye-lighting-note',
    async () => assert.fail('offline only'),
    { places: { municipality: async () => ({ bfs_id: 5871 }) } },
  );
  city.requirements = async () => labbayeRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.65,
    longitude: 6.32,
    location_confirmed: true,
    location_label: 'Emplacement communal fictif hors ligne',
    category: 'Éclairage public communal',
    description:
      'Le luminaire communal fictif ne fonctionne pas, sans danger ni risque immédiat pour la circulation.',
    email: '',
    photo_ids: [],
    extra_fields: {
      public_asset_confirmed: confirmation,
      village: 'L’Abbaye',
      street_name: 'Rue fictive hors ligne',
      fault_kind: 'Ne fonctionne pas',
    },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0210000000' },
    { category: 'Voirie' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { ...input.extra_fields, public_asset_confirmed: 'Private asset' } },
    { extra_fields: { ...input.extra_fields, village: 'Le Lieu' } },
    { extra_fields: { ...input.extra_fields, village: 'Le Sentier' } },
    { extra_fields: { ...input.extra_fields, village: '' } },
    { extra_fields: { ...input.extra_fields, street_name: '' } },
    { extra_fields: { ...input.extra_fields, street_name: 'x'.repeat(151) } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Brightness adjustment' } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Planned extinction' } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Immediate danger' } },
    { extra_fields: { ...input.extra_fields, known_lamp_number: 'x'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, reporter_consent: 'forbidden' } },
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
  assert.equal(p.municipality.bfs_id, 5871);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.known_lamp_number, undefined);
  for (const village of ['Le Pont', 'Les Bioux']) {
    const q = await service.prepare({
      ...input,
      description: 'Le second luminaire communal fictif fonctionne par intermittence, sans danger.',
      extra_fields: {
        ...input.extra_fields,
        village,
        known_lamp_number: 'C-42',
        fault_kind: 'Fonctionne par intermittence',
      },
    });
    assert.notEqual(q.preview_id, p.preview_id);
    assert.equal(q.report.extra_fields.village, village);
    assert.equal(q.report.extra_fields.known_lamp_number, 'C-42');
    assert.equal(q.submission_enabled, false);
    await assert.rejects(
      service.submit(q.preview_id, q.confirmation_token, true),
      /unverified|verification|disabled/i,
    );
  }
  assert.equal(p.report.description, input.description);
  assert.equal(p.report.extra_fields.village, 'L’Abbaye');
  assert.doesNotMatch(
    JSON.stringify(p.report),
    /PrivateName|private@example.invalid|native_state|reporter_consent/,
  );
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true),
    /unverified|verification|disabled/i,
  );
});
