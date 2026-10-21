import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectSimplonSource,
  simplonSourcePins,
  simplonCategories,
  simplonRequirements,
  verifySimplonSources,
} from '../dist/simplon-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Legitimate EVS customer confirms actual EVS-owned meter at exact Simplon point and already observed independently established nonurgent display irregularity; no inspection, safety assessment or official notification performed';

test('Simplon publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(simplonSourcePins.length, 6);
  assert.ok(Object.isFrozen(simplonSourcePins) && simplonSourcePins.every(Object.isFrozen));
  assert.ok(simplonSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(simplonSourcePins.map((p) => p.url)).size, 6);
  for (const p of simplonSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      Object.keys(p).sort().join(','),
      p.pdf ? 'pdf,plain,sha256,url' : 'plain,sha256,url',
    );
    assert.throws(() => inspectSimplonSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = simplonRequirements()['EVS-Zähleranzeige – lokale Fakten'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.equal(r.report_kind, undefined);
  assert.match(r.scope, /Local German facts/);
  assert.match(r.scope, /legitimate EVS customer/);
  assert.match(r.scope, /NONURGENT DISPLAY/);
  assert.match(r.scope, /do not perform that notification/);
  assert.match(r.scope, /must not delay required notification/);
  assert.match(r.scope, /does not establish urgency or safety/);
  assert.match(r.scope, /No new approach, inspection, reading, testing, photograph/);
  assert.match(r.scope, /heat, noise, sparks, smoke, smell/);
  assert.match(r.scope, /billing\/accuracy\/calibration/);
  assert.match(
    r.scope,
    /no office, EVS staff, member, substitute, phone, contractor, EnBAG or provider fallback/,
  );
  assert.doesNotMatch(
    r.scope,
    /2026-12-31|merger|suspected Asian-hornet|French facts|communal water meter/,
  );
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['evs_meter_observation_confirmed'],
  );
  assert.ok(simplonSourcePins.every((p) => new URL(p.url).host === 'gemeinde-simplon.ch'));
  assert.equal(simplonSourcePins.filter((p) => p.pdf).length, 1);
  assert.ok(
    simplonSourcePins.every(
      (p) =>
        !p.url.includes('enbag.ch') &&
        !p.url.includes('privacybee') &&
        !p.url.includes('Wasserversorgung') &&
        !p.url.includes('2027'),
    ),
  );
  assert.match(r.notes.join(' '), /KEINE solche Meldung/);
  assert.throws(
    () => inspectMunicipalForm('simplon-evs-meter-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Simplon failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifySimplonSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('simplon-evs-meter-note', request, {
      places: { municipality: async () => ({ bfs_id: 6009 }) },
    });
    city.cached = { value: simplonCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.195, longitude: 8.055 }), /paused/);
    await assert.rejects(
      verifySimplonSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [simplonSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Simplon exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'simplon-evs-meter-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 6010 }) } },
  );
  assert.deepEqual(await city.categories(), simplonCategories);
  assert.equal(city.bfsId, 6009);
  assert.equal(city.deliveryLanguage, 'de');
  await assert.rejects(
    city.requirements({ latitude: 46.195, longitude: 8.055 }),
    /municipality|boundary|Simplon/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('simplon-evs-meter-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Simplon local EVS display facts reject contacts, photos, account/serial and clinical/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'simplon-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'simplon-evs-meter-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 6009 }) },
    },
  );
  city.requirements = async () => simplonRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.195,
    longitude: 8.055,
    location_confirmed: true,
    location_label: 'Fiktiver Offline-Ort des EVS-Zählers in Simplon',
    category: 'EVS-Zähleranzeige – lokale Fakten',
    description:
      'Eine fiktive, bereits beobachtete und unabhängig nicht dringende Anzeige-Unregelmässigkeit am tatsächlichen EVS-Zähler; keine Prüfung, Sicherheitsbewertung oder Meldung ausgeführt.',
    email: '',
    photo_ids: [],
    extra_fields: { evs_meter_observation_confirmed: confirmation },
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
        evs_meter_observation_confirmed:
          'EVS customer, meter ownership or independent nonurgency not confirmed',
      },
    },
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
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [image.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 6009);
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
      'Eine zweite fiktive Beobachtung beschreibt nur bestehende Anzeige-Fakten des EVS-Zählers, ohne neue Ablesung, Prüfung oder Meldung.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
