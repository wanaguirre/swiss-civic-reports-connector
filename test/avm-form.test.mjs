import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectAvmSource,
  avmSourcePins,
  avmCategories,
  avmRequirements,
  verifyAvmSources,
  avmMunicipalities,
  avmConfirmation,
  avmScopeFor,
  isAvmMunicipality,
} from '../dist/avm-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent fault of actual AVM communal drinking-water asset in Vaux-sur-Morges confirmed';

test('Avm publishes only fixed factual URL/digest pins and local note rules', () => {
  assert.equal(avmSourcePins.length, 6);
  assert.ok(Object.isFrozen(avmSourcePins) && avmSourcePins.every(Object.isFrozen));
  assert.ok(avmSourcePins.slice(0, 2).every((p) => p.plain && p.url.endsWith('/robots.txt')));
  assert.equal(new Set(avmSourcePins.map((p) => p.url)).size, 6);
  for (const p of avmSourcePins) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(p).sort().join(','), 'plain,sha256,url');
    assert.throws(() => inspectAvmSource(p.url, 'Independent offline drift'), /paused/);
  }
  const r = avmRequirements('avm-vaux')['Eau potable communale AVM'];
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.email_supported, false);
  assert.equal(r.max_photos, 0);
  assert.match(r.scope, /Initial optional call/);
  assert.match(r.scope, /dedicated dépannage/);
  assert.match(r.scope, /Telephone reporter requirements/);
  assert.throws(() => inspectMunicipalForm('avm-vaux', 'Own offline example'), /complete pinned/);
});

test('Avm failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
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
      verifyAvmSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('avm-vaux', request, {
      places: { municipality: async () => ({ bfs_id: 5650 }) },
    });
    city.cached = { value: avmCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.48, longitude: 6.48 }), /paused/);
    await assert.rejects(
      verifyAvmSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [avmSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Avm exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'avm-vaux',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5653 }) } },
  );
  assert.deepEqual(await city.categories(), avmCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.48, longitude: 6.48 }),
    /municipality|boundary|Avm/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () =>
      new MunicipalFormClient('avm-vaux', undefined, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
});

test('Avm local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'avm-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient('avm-vaux', async () => assert.fail('offline only'), {
    places: { municipality: async () => ({ bfs_id: 5650 }) },
  });
  city.requirements = async () => avmRequirements('avm-vaux');
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.48,
    longitude: 6.48,
    location_confirmed: true,
    location_label: 'Offline actual AVM asset',
    category: 'Eau potable communale AVM',
    description:
      'Le couvercle fictif de l’équipement AVM confirmé est usé, sans fuite ni danger immédiat.',
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
  assert.equal(p.municipality.bfs_id, 5650);
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
    description: 'Le second équipement AVM fictif présente une usure non urgente.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});

test('AVM six exact identities, unique confirmations and family-wide cached-peer stop', async () => {
  const ids = Object.values(avmMunicipalities).map((p) => p.bfsId);
  assert.deepEqual(ids, [5628, 5629, 5634, 5650, 5653, 5656]);
  assert.equal(isAvmMunicipality('avm-yens'), false);
  assert.throws(() => avmScopeFor('avm-yens'), /Unsupported/);
  assert.equal(new Set(Object.keys(avmMunicipalities).map(avmConfirmation)).size, 6);
  let reads = 0;
  const request = async () => {
    reads++;
    return new Response('offline stop', { status: 403 });
  };
  const peers = Object.entries(avmMunicipalities).map(([name, p]) => {
    const city = new MunicipalFormClient(name, request, {
      places: { municipality: async () => ({ bfs_id: p.bfsId }) },
    });
    city.cached = { value: avmCategories, expires: Date.now() + 300000 };
    return city;
  });
  await assert.rejects(
    verifyAvmSources(request, () => {}),
    /paused/,
  );
  for (const [i, city] of peers.entries()) {
    assert.equal(city.bfsId, ids[i]);
    await assert.rejects(city.requirements({ latitude: 46.56, longitude: 6.48 }), /paused/);
    assert.equal(city.submissionMode, 'unverified');
    await assert.rejects(city.submit({}), /verification/);
  }
  assert.equal(reads, 1);
  for (const [name, p] of Object.entries(avmMunicipalities)) {
    let calls = 0;
    const city = new MunicipalFormClient(
      name,
      async () => {
        calls++;
        assert.fail('wrong municipality must stop before GET');
      },
      { places: { municipality: async () => ({ bfs_id: 5657 }) } },
    );
    assert.deepEqual(await city.categories(), avmCategories);
    await assert.rejects(
      city.requirements({ latitude: 46.56, longitude: 6.48 }),
      /municipality|boundary/i,
    );
    assert.equal(calls, 0);
    const r = avmRequirements(name)[avmCategories[0].service_code];
    assert.ok(r.scope.includes(`BFS${p.bfsId}`));
    assert.deepEqual(r.extra_fields[0].values, [avmConfirmation(name)]);
    assert.equal(r.max_photos, 0);
    assert.deepEqual(r.contact_fields, []);
    assert.equal(r.email_supported, false);
    assert.throws(
      () => new MunicipalFormClient(name, undefined, { experimentalSubmission: true }),
      /only implemented/,
    );
  }
});
