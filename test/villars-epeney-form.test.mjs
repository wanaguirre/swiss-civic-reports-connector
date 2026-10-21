import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectVillarsEpeneySource,
  villarsEpeneySourcePins,
  villarsEpeneyCategories,
  villarsEpeneyRequirements,
  verifyVillarsEpeneySources,
} from '../dist/villars-epeney-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Legitimate subscriber confirms actual Villars-Epeney communal water meter and existing independently nonurgent mechanical fault at exact point; no leak, outage, testing or diagnosis';

test('Villars-Epeney publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(villarsEpeneySourcePins.length, 7);
  assert.ok(
    Object.isFrozen(villarsEpeneySourcePins) && villarsEpeneySourcePins.every(Object.isFrozen),
  );
  assert.ok(
    villarsEpeneySourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')),
  );
  assert.equal(new Set(villarsEpeneySourcePins.map((p) => p.url)).size, 7);
  for (const p of villarsEpeneySourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      Object.keys(p).sort().join(','),
      p.pdf ? 'pdf,plain,sha256,url' : 'plain,sha256,url',
    );
    assert.throws(() => inspectVillarsEpeneySource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = villarsEpeneyRequirements()['Compteur d’eau communal'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.equal(r.report_kind, undefined);
  assert.match(r.scope, /legitimate subscriber/);
  assert.match(r.scope, /actual communal water meter/);
  assert.match(r.scope, /do not perform that notification/);
  assert.match(r.scope, /extend any deadline/);
  assert.match(r.scope, /No new observation, reading, testing/);
  assert.match(r.scope, /undated roster/);
  assert.match(r.scope, /separately published2025 tariff annex/);
  assert.match(r.scope, /no office, member, substitute, phone, contractor or provider fallback/);
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['meter_fault_confirmed'],
  );
  assert.ok(villarsEpeneySourcePins.every((p) => new URL(p.url).host === 'www.villars-epeney.ch'));
  assert.equal(villarsEpeneySourcePins.filter((p) => p.pdf).length, 2);
  assert.ok(
    villarsEpeneySourcePins.every(
      (p) =>
        !p.url.includes('contact') &&
        !p.url.includes('administrator') &&
        !p.url.includes('components'),
    ),
  );
  assert.throws(
    () => inspectMunicipalForm('villars-epeney-meter-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Villars-Epeney failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyVillarsEpeneySources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('villars-epeney-meter-note', request, {
      places: { municipality: async () => ({ bfs_id: 5935 }) },
    });
    city.cached = { value: villarsEpeneyCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.79, longitude: 6.75 }), /paused/);
    await assert.rejects(
      verifyVillarsEpeneySources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [villarsEpeneySourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Villars-Epeney exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'villars-epeney-meter-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5934 }) } },
  );
  assert.deepEqual(await city.categories(), villarsEpeneyCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.79, longitude: 6.75 }),
    /municipality|boundary|VillarsEpeney/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('villars-epeney-meter-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Villars-Epeney local meter facts reject contacts, photos, account/serial and clinical/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'villarsEpeney-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'villars-epeney-meter-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5935 }) },
    },
  );
  city.requirements = async () => villarsEpeneyRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.79,
    longitude: 6.75,
    location_confirmed: true,
    location_label: 'Emplacement fictif hors ligne du compteur à Villars-Epeney',
    category: 'Compteur d’eau communal',
    description:
      'Un élément extérieur du compteur communal fictif à Villars-Epeney présente un défaut déjà observé; aucun essai, manipulation, diagnostic, fuite ou interruption déclaré.',
    email: '',
    photo_ids: [],
    extra_fields: { meter_fault_confirmed: confirmation },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0240000000' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { meter_fault_confirmed: 'Subscriber or ownership not confirmed' } },
    { extra_fields: { public_asset_confirmed: confirmation } },
    { extra_fields: { ...input.extra_fields, clinical_data: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, diagnosis: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, account_number: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, customer_id: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, meter_number: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, meter_serial: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, subscription_id: 'forbidden' } },
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
  assert.equal(p.municipality.bfs_id, 5935);
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
      'Une seconde observation fictive décrit un défaut mécanique déjà observé du compteur communal, sans essai, manipulation ou diagnostic.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
