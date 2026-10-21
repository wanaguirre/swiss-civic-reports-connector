import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectSuscevazSource,
  suscevazSourcePins,
  suscevazCategories,
  suscevazRequirements,
  verifySuscevazSources,
} from '../dist/suscevaz-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent factual suspected Asian-hornet observation at exact Suscevaz point confirmed; local facts fulfill neither platform nor commune announcement';

test('Suscevaz publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(suscevazSourcePins.length, 5);
  assert.ok(Object.isFrozen(suscevazSourcePins) && suscevazSourcePins.every(Object.isFrozen));
  assert.ok(suscevazSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(suscevazSourcePins.map((p) => p.url)).size, 5);
  for (const p of suscevazSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      Object.keys(p).sort().join(','),
      p.pdf ? 'pdf,plain,sha256,url' : 'plain,sha256,url',
    );
    assert.throws(() => inspectSuscevazSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = suscevazRequirements()['Observation présumée de frelon asiatique'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.equal(r.report_kind, 'species_observation');
  assert.match(r.scope, /suspected Asian-hornet individual or nest observation/);
  assert.match(r.scope, /platform AND commune/);
  assert.match(r.scope, /fulfill neither/);
  assert.match(r.scope, /2026-12-31T23:00:00Z/);
  assert.match(r.scope, /no office, member, substitute, phone or provider fallback/);
  assert.match(r.scope, /without|no identification/i);
  assert.deepEqual(
    r.extra_fields.map((f) => f.code),
    ['hornet_observation_confirmed'],
  );
  assert.ok(suscevazSourcePins.every((p) => new URL(p.url).host === 'www.suscevaz.ch'));
  assert.ok(suscevazSourcePins.filter((p) => p.pdf).length === 1);
  assert.ok(
    suscevazSourcePins.every(
      (p) =>
        !p.url.includes('frelonasiatique.ch') &&
        !p.url.includes('asiatischehornisse.ch') &&
        !p.url.includes('/contact'),
    ),
  );
  assert.throws(
    () => inspectMunicipalForm('suscevaz-hornet-observation-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('Suscevaz failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifySuscevazSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('suscevaz-hornet-observation-note', request, {
      places: { municipality: async () => ({ bfs_id: 5930 }) },
    });
    city.cached = { value: suscevazCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.75, longitude: 6.57 }), /paused/);
    await assert.rejects(
      verifySuscevazSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [suscevazSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Suscevaz exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'suscevaz-hornet-observation-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5929 }) } },
  );
  assert.deepEqual(await city.categories(), suscevazCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.75, longitude: 6.57 }),
    /municipality|boundary|Suscevaz/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('suscevaz-hornet-observation-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Suscevaz suspected-observation facts reject contacts, photos, identification/native fields and wrong confirmation; frozen facts cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'suscevaz-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'suscevaz-hornet-observation-note',
    async () => assert.fail('offline only'),
    {
      places: { municipality: async () => ({ bfs_id: 5930 }) },
    },
  );
  city.requirements = async () => suscevazRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.75,
    longitude: 6.57,
    location_confirmed: true,
    location_label: 'Emplacement fictif hors ligne de l’observation à Suscevaz',
    category: 'Observation présumée de frelon asiatique',
    description:
      'Un insecte présumé frelon asiatique a été observé au point fictif d’Suscevaz; seuls les faits déjà observés sont décrits, sans identification ou conclusion de sécurité.',
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
  await assert.rejects(service.prepare({ ...input, photo_ids: [image.photo_id] }), /photo/);
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5930);
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
      'Une seconde observation fictive non urgente à Suscevaz décrit un insecte présumé, sans identification garantie ni conclusion de sécurité.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});

test('Suscevaz merger retirement rejects cached peers and stops between paced reads irreversibly', async () => {
  const { suscevazRetiresAt, assertSuscevazSourcesAvailable } =
    await import('../dist/suscevaz-form.js');
  let now = suscevazRetiresAt;
  let reads = 0;
  const request = async () => {
    reads++;
    throw new Error('No source read after retirement');
  };
  const city = new MunicipalFormClient('suscevaz-hornet-observation-note', request, {
    now: () => now,
    places: { municipality: async () => ({ bfs_id: 5930 }) },
  });
  city.cached = { value: suscevazCategories, expires: now + 300000 };
  await assert.rejects(city.requirements({ latitude: 46.75, longitude: 6.57 }), /retired/);
  assert.equal(reads, 0);
  now -= 100000;
  assert.throws(() => assertSuscevazSourcesAvailable(request, () => now), /retired/);
  const robots = 'Sitemap: https://www.suscevaz.ch/sitemap.xml\n';
  // Exercise the real profile clock hook, supplying only its first exact robots body.
  now = suscevazRetiresAt - 5000;
  const calls = [];
  const during = async (url) => {
    calls.push(url);
    return new Response(robots, { headers: { 'content-type': 'text/plain' } });
  };
  await assert.rejects(
    verifySuscevazSources(
      during,
      () => {},
      () => now,
      async (ms) => {
        now += ms;
      },
    ),
    /paused/,
  );
  assert.equal(now, suscevazRetiresAt + 5000);
  assert.deepEqual(calls, [suscevazSourcePins[0].url]);
  assert.throws(() => assertSuscevazSourcesAvailable(during, () => 0), /paused/);
});
