import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectOrzensSource,
  orzensSourcePins,
  orzensCategories,
  orzensRequirements,
  verifyOrzensSources,
} from '../dist/orzens-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent factual suspected Asian-hornet observation at exact Orzens point confirmed; no identification or safety conclusion';

test('Orzens publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(orzensSourcePins.length, 5);
  assert.ok(Object.isFrozen(orzensSourcePins) && orzensSourcePins.every(Object.isFrozen));
  assert.ok(orzensSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(orzensSourcePins.map((p) => p.url)).size, 5);
  for (const p of orzensSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectOrzensSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = orzensRequirements()['Observation présumée de frelon asiatique'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.equal(r.report_kind, 'species_observation');
  assert.match(r.scope, /suspected Asian-hornet individual or nest observation/);
  assert.match(r.scope, /Frédéric Burkhard/);
  assert.match(r.scope, /2026–2031/);
  assert.match(r.scope, /without species-identification guarantee/);
  assert.match(r.scope, /no office, member, substitute, phone or provider fallback/);
  assert.match(r.scope, /one-year retention/);
  assert.match(r.scope, /not this individual hornet recipient/);
  assert.match(r.scope, /Official|official/);
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['hornet_observation_confirmed'],
  );
  assert.ok(orzensSourcePins.every((p) => new URL(p.url).host === 'orzens.ch'));
  assert.ok(orzensSourcePins.some((p) => p.url === 'https://orzens.ch/politique-confidentialite/'));
  assert.ok(
    orzensSourcePins.every(
      (p) =>
        !p.url.includes('frelonasiatique.ch') &&
        !p.url.includes('asiatischehornisse.ch') &&
        !p.url.includes('/contact'),
    ),
  );
  assert.throws(
    () => inspectMunicipalForm('orzens-hornet-observation-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Orzens failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyOrzensSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('orzens-hornet-observation-note', request, {
      places: { municipality: async () => ({ bfs_id: 5925 }) },
    });
    city.cached = { value: orzensCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.721, longitude: 6.682 }), /paused/);
    await assert.rejects(
      verifyOrzensSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [orzensSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Orzens exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'orzens-hornet-observation-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5924 }) } },
  );
  assert.deepEqual(await city.categories(), orzensCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.721, longitude: 6.682 }),
    /municipality|boundary|Orzens/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('orzens-hornet-observation-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Orzens suspected-observation facts reject contacts, photos, identification/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'orzens-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'orzens-hornet-observation-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5925 }) },
    },
  );
  city.requirements = async () => orzensRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.721,
    longitude: 6.682,
    location_confirmed: true,
    location_label: 'Emplacement fictif hors ligne de l’observation à Orzens',
    category: 'Observation présumée de frelon asiatique',
    description:
      'Un insecte présumé frelon asiatique a été observé au point fictif d’Orzens; seuls les faits déjà observés sont décrits, sans identification ou conclusion de sécurité.',
    email: '',
    photo_ids: [],
    extra_fields: { hornet_observation_confirmed: confirmation },
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
      extra_fields: {
        hornet_observation_confirmed: 'Definitive identification and safety guaranteed',
      },
    },
    { extra_fields: { public_asset_confirmed: confirmation } },
    { extra_fields: { ...input.extra_fields, clinical_data: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, diagnosis: 'forbidden' } },
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
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [image.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5925);
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
      'Une seconde observation fictive non urgente à Orzens décrit un insecte présumé, sans identification garantie ni conclusion de sécurité.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
