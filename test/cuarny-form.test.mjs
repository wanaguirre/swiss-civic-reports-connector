import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectCuarnySource,
  cuarnySourcePins,
  cuarnyCategories,
  cuarnyRequirements,
  verifyCuarnySources,
} from '../dist/cuarny-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent factual perceived-quality observation of actual Cuarny-supplied drinking water at exact point confirmed; no diagnosis, cause or safety conclusion';

test('Cuarny publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(cuarnySourcePins.length, 5);
  assert.ok(Object.isFrozen(cuarnySourcePins) && cuarnySourcePins.every(Object.isFrozen));
  assert.ok(cuarnySourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(cuarnySourcePins.map((p) => p.url)).size, 5);
  for (const p of cuarnySourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectCuarnySource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = cuarnyRequirements()['Qualité perçue de l’eau potable'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /perceived quality/);
  assert.match(r.scope, /Jérémie Cartier/);
  assert.match(r.scope, /2026–2031/);
  assert.match(r.scope, /no diagnosis/i);
  assert.match(r.scope, /safety, drinkability or urgency conclusion/);
  assert.match(r.scope, /no office, member, substitute, phone or provider fallback/);
  assert.match(r.scope, /literal jeremie.cartier\(at\)cuarny.ch/);
  assert.match(
    r.scope,
    /identity\/photo\/privacy\/retention\/country\/forwarding\/guest acceptance\/receipt remain unknown/,
  );
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['quality_observation_confirmed'],
  );
  assert.ok(cuarnySourcePins.every((p) => new URL(p.url).host === 'www.cuarny.ch'));
  assert.ok(
    cuarnySourcePins.every(
      (p) =>
        !p.url.includes('/contact') &&
        !p.url.includes('cgu') &&
        !p.url.includes('email-protection'),
    ),
  );
  assert.throws(
    () => inspectMunicipalForm('cuarny-water-quality-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Cuarny failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyCuarnySources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('cuarny-water-quality-note', request, {
      places: { municipality: async () => ({ bfs_id: 5911 }) },
    });
    city.cached = { value: cuarnyCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.77, longitude: 6.69 }), /paused/);
    await assert.rejects(
      verifyCuarnySources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [cuarnySourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Cuarny exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'cuarny-water-quality-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5910 }) } },
  );
  assert.deepEqual(await city.categories(), cuarnyCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.77, longitude: 6.69 }),
    /municipality|boundary|Cuarny/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('cuarny-water-quality-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Cuarny factual quality note rejects contacts, photos, clinical/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cuarny-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'cuarny-water-quality-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5911 }) },
    },
  );
  city.requirements = async () => cuarnyRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.77,
    longitude: 6.69,
    location_confirmed: true,
    location_label: 'Emplacement fictif hors ligne de l’observation à Cuarny',
    category: 'Qualité perçue de l’eau potable',
    description:
      'L’aspect perçu de l’eau fournie au point fictif de Cuarny diffère de l’habitude; faits non urgents sans conclusion sur la cause ou la potabilité.',
    email: '',
    photo_ids: [],
    extra_fields: { quality_observation_confirmed: confirmation },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0240000000' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { quality_observation_confirmed: 'Water is safe' } },
    { extra_fields: { public_asset_confirmed: confirmation } },
    { extra_fields: { ...input.extra_fields, clinical_data: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, diagnosis: 'forbidden' } },
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
  assert.equal(p.municipality.bfs_id, 5911);
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
      'Une seconde observation fictive non urgente décrit uniquement l’aspect perçu de l’eau à Cuarny, sans conclusion sur la cause ou la potabilité.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
