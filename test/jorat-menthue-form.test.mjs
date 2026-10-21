import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectJoratMenthueSource,
  joratMenthueSourcePins,
  joratMenthueCategories,
  joratMenthueRequirements,
  verifyJoratMenthueSources,
} from '../dist/jorat-menthue-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Resident with legitimately issued card confirms actual source-listed communal underground Molok and nonurgent mechanical access failure';
test('JoratMenthue publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(joratMenthueSourcePins.length, 5);
  assert.ok(
    Object.isFrozen(joratMenthueSourcePins) && joratMenthueSourcePins.every(Object.isFrozen),
  );
  assert.ok(
    joratMenthueSourcePins.slice(0, 1).every((p) => p.plain && p.url.endsWith('/robots.txt')),
  );
  assert.equal(new Set(joratMenthueSourcePins.map((p) => p.url)).size, 5);
  for (const p of joratMenthueSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectJoratMenthueSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = joratMenthueRequirements()['Molok communal inaccessible'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /not a complete official form/);
  assert.match(r.scope, /no office, member, substitute, phone or provider fallback/);
  assert.match(r.scope, /Montaubion-Chardonney/);
  assert.match(r.scope, /Sottens/);
  assert.match(r.scope, /greffe@jorat-menthue.ch/);
  assert.match(
    r.scope,
    /Excludes Peney-le-Jorat, Villars-Mendraz and Villars-Tiercelin compactors/,
  );
  assert.match(r.scope, /Never collect card numbers/);
  assert.match(r.scope, /unknown identifiers remain missing/);
  assert.ok(joratMenthueSourcePins.every((p) => new URL(p.url).host === 'www.jorat-menthue.ch'));
  assert.throws(
    () => inspectMunicipalForm('jorat-menthue-molok-note', 'Own offline example'),
    /complete pinned/,
  );
});

test('JoratMenthue failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyJoratMenthueSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('jorat-menthue-molok-note', request, {
      places: { municipality: async () => ({ bfs_id: 5804 }) },
    });
    city.cached = { value: joratMenthueCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.655, longitude: 6.741 }), /paused/);
    await assert.rejects(
      verifyJoratMenthueSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [joratMenthueSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('JoratMenthue exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'jorat-menthue-molok-note',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5803 }) } },
  );
  assert.deepEqual(await city.categories(), joratMenthueCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.655, longitude: 6.741 }),
    /municipality|boundary|JoratMenthue/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('jorat-menthue-molok-note', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('JoratMenthue limits actual Molok sites and resident-card confirmation, rejects sensitive/native data, freezes facts and refuses every send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'jorat-menthue-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'jorat-menthue-molok-note',
    async () => assert.fail('offline only'),
    { places: { municipality: async () => ({ bfs_id: 5804 }) } },
  );
  city.requirements = async () => joratMenthueRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.655,
    longitude: 6.741,
    location_confirmed: true,
    location_label: 'Site communal fictif hors ligne',
    category: 'Molok communal inaccessible',
    description: 'Le couvercle du Molok communal fictif ne s’ouvre pas, sans danger immédiat.',
    email: '',
    photo_ids: [],
    extra_fields: {
      public_asset_confirmed: confirmation,
      molok_site: 'Montaubion-Chardonney – ancienne laiterie en face du collège',
      fault_kind: 'Couvercle ne s’ouvre pas',
    },
  };
  for (const change of [
    { name: 'PrivateName' },
    { email: 'private@example.invalid' },
    { phone: '0210000000' },
    { category: 'Benne compactante' },
    { description: 'x'.repeat(4001) },
    { location_confirmed: false },
    { extra_fields: {} },
    { extra_fields: { ...input.extra_fields, public_asset_confirmed: 'Visitor without card' } },
    {
      extra_fields: {
        ...input.extra_fields,
        public_asset_confirmed: 'Resident with lost or invalid card',
      },
    },
    { extra_fields: { ...input.extra_fields, molok_site: 'Peney-le-Jorat – compacteur' } },
    { extra_fields: { ...input.extra_fields, molok_site: 'Villars-Mendraz – Casino' } },
    { extra_fields: { ...input.extra_fields, molok_site: 'Villars-Tiercelin – Planche-Marion' } },
    { extra_fields: { ...input.extra_fields, molok_site: '' } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Lost card' } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Billing dispute' } },
    { extra_fields: { ...input.extra_fields, fault_kind: 'Immediate danger' } },
    { extra_fields: { ...input.extra_fields, known_container_number: 'x'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, known_observation_time: 'x'.repeat(101) } },
    { extra_fields: { ...input.extra_fields, card_number: 'forbidden' } },
    { extra_fields: { ...input.extra_fields, account_password: 'forbidden' } },
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
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [image.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5804);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.known_container_number, undefined);
  assert.equal(p.report.extra_fields.known_observation_time, undefined);
  const q = await service.prepare({
    ...input,
    description: 'Le second Molok fictif est inaccessible sans risque immédiat.',
    extra_fields: {
      ...input.extra_fields,
      molok_site: 'Sottens – place du Village, direction Moudon',
      known_container_number: 'M-42',
      known_observation_time: '20 octobre à 10h',
    },
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.report.extra_fields.known_container_number, 'M-42');
  assert.equal(q.report.extra_fields.known_observation_time, '20 octobre à 10h');
  assert.equal(q.submission_enabled, false);
  assert.doesNotMatch(
    JSON.stringify(p.report),
    /PrivateName|private@example.invalid|card_number|account_password|native_state/,
  );
  for (const preview of [p, q])
    await assert.rejects(
      service.submit(preview.preview_id, preview.confirmation_token, true),
      /unverified|verification|disabled/i,
    );
});
