import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectYvonandSource,
  yvonandSourcePins,
  yvonandCategories,
  yvonandRequirements,
  verifyYvonandSources,
} from '../dist/yvonand-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Existing independently nonurgent suspected nest at exact Yvonand point confirmed; identification remains uncertain and both official announcements incomplete';

test('Yvonand publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(yvonandSourcePins.length, 6);
  assert.ok(Object.isFrozen(yvonandSourcePins) && yvonandSourcePins.every(Object.isFrozen));
  assert.ok(yvonandSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(yvonandSourcePins.map((p) => p.url)).size, 6);
  for (const p of yvonandSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      Object.keys(p).sort().join(','),
      p.pdf ? 'pdf,plain,sha256,url' : 'plain,sha256,url',
    );
    assert.throws(() => inspectYvonandSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = yvonandRequirements()['Nid présumé de frelon asiatique'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.equal(r.report_kind, 'species_observation');
  assert.match(r.scope, /suspected Asian-hornet NEST/);
  assert.match(r.scope, /neither official announcement/);
  assert.match(r.scope, /required photos unfulfilled/);
  assert.match(r.scope, /email OR phone/);
  assert.match(r.scope, /Excludes individual-only sightings/);
  assert.match(r.scope, /no new approach, inspection, photograph, filming/i);
  assert.match(r.scope, /not a payment or removal promise/);
  assert.doesNotMatch(r.scope, /2026-12-31|merger|communal water meter|Orzens|Suscévaz/);
  assert.match(r.scope, /no office, member, substitute, phone, contractor or provider fallback/);
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['hornet_nest_confirmed'],
  );
  assert.ok(yvonandSourcePins.every((p) => new URL(p.url).host === 'yvonand.ch'));
  assert.equal(yvonandSourcePins.filter((p) => p.pdf).length, 1);
  assert.ok(
    yvonandSourcePins.every(
      (p) =>
        !p.url.includes('frelonasiatique.ch') &&
        !p.url.includes('communeapp') &&
        !p.url.includes('claim') &&
        !p.url.includes('reviews'),
    ),
  );
  assert.match(r.notes.join(' '), /NON REMPLIE/);
  assert.throws(
    () => inspectMunicipalForm('yvonand-hornet-nest-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Yvonand failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyYvonandSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('yvonand-hornet-nest-note', request, {
      places: { municipality: async () => ({ bfs_id: 5939 }) },
    });
    city.cached = { value: yvonandCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.8, longitude: 6.74 }), /paused/);
    await assert.rejects(
      verifyYvonandSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [yvonandSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Yvonand exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'yvonand-hornet-nest-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5938 }) } },
  );
  assert.deepEqual(await city.categories(), yvonandCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.8, longitude: 6.74 }),
    /municipality|boundary|Yvonand/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('yvonand-hornet-nest-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Yvonand local nest facts reject contacts, required-source photos and clinical/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'yvonand-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'yvonand-hornet-nest-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5939 }) },
    },
  );
  city.requirements = async () => yvonandRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.8,
    longitude: 6.74,
    location_confirmed: true,
    location_label: 'Emplacement fictif hors ligne du nid présumé à Yvonand',
    category: 'Nid présumé de frelon asiatique',
    description:
      'Un nid présumé fictif a déjà été observé au point hors ligne à Yvonand; identification incertaine, faits non urgents, aucune annonce ni photo réalisée par cette fiche.',
    email: '',
    photo_ids: [],
    extra_fields: { hornet_nest_confirmed: confirmation },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0240000000' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    {
      extra_fields: { hornet_nest_confirmed: 'Individual-only sighting or urgency not confirmed' },
    },
    { extra_fields: { public_asset_confirmed: confirmation } },
    { extra_fields: { ...input.extra_fields, clinical_data: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, diagnosis: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, account_number: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, customer_id: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, platform_case_id: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, nest_identifier: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, species_id: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, first_name: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, last_name: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, case_kind: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, email_to: 'recipient@example.invalid' } },
    { extra_fields: { ...input.extra_fields, mail_headers: 'forbidden' } },
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
  assert.equal(p.municipality.bfs_id, 5939);
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
    description:
      'Une seconde observation fictive décrit uniquement les faits déjà observés du nid présumé, sans identification garantie ni annonce officielle.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
