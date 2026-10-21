import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectSieSource,
  sieSourcePins,
  sieCategories,
  sieRequirements,
  verifySieSources,
} from '../dist/sie-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const bodies = new Map();
for (const [i, slug] of ['robots', 'report', 'faq', 'mandate', 'privacy'].entries()) {
  const file = new URL(`fixtures/sie-${slug}.${i ? 'html.gz' : 'txt'}`, import.meta.url);
  const data = await readFile(file);
  bodies.set(sieSourcePins[i].url, i ? gunzipSync(data).toString('utf8') : data.toString('utf8'));
}
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation =
  'Nonurgent fault of actual SIE-maintained municipal luminaire in Crissier confirmed';

test('Sie complete public captures pin lamp invitation, mandate, conflicting phones and privacy exceptions', () => {
  for (const pin of sieSourcePins) {
    inspectSieSource(pin.url, bodies.get(pin.url));
    for (const change of [
      bodies.get(pin.url) + '\n',
      '\ufeff' + bodies.get(pin.url),
      'x'.repeat(1_000_001),
    ])
      assert.throws(() => inspectSieSource(pin.url, change), /paused/);
  }
  const work = bodies.get(sieSourcePins[1].url);
  for (const [from, to] of [
    ['021 631 51 11', '021 000 00 00'],
    ['Crissier', 'OtherMunicipality'],
    ['15 jours', '150 jours'],
    ['coordonn&eacute;es', 'donn&eacute;es bancaires'],
  ]) {
    const changed = work.replace(from, to);
    assert.ok(changed !== work, `Mutation target missing: ${from}`);
    assert.throws(() => inspectSieSource(sieSourcePins[1].url, changed), /paused/);
  }
  assert.throws(() => inspectSieSource('https://example.invalid/', work), /paused/);
  assert.throws(() => inspectMunicipalForm('sie-crissier', work), /complete pinned/);
  const r = sieRequirements()['Luminaire communal SIE'];
  assert.equal(r.email_supported, false);
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.max_photos, 0);
  assert.equal(r.extra_fields.length, 2);
  assert.match(r.extra_fields[0].values[0], /Nonurgent/);
});

test('Sie concurrent source verification shares ten-second starts and only five fixed credential-free GETs', async () => {
  let clock = 1000;
  const calls = [];
  const request = async (url, init) => {
    assert.ok(bodies.has(url));
    calls.push({ url, init, start: clock });
    return response(bodies.get(url), url.endsWith('/robots.txt'));
  };
  const sleep = async (ms) => {
    clock += ms;
  };
  const values = await Promise.all([
    verifySieSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
    verifySieSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
  ]);
  assert.deepEqual(values, [sieCategories, sieCategories]);
  assert.equal(calls.length, 10);
  calls.forEach((c, i) => {
    assert.equal(new URL(c.url).hostname, 'www.sie.ch');
    assert.equal(c.init.method, 'GET');
    assert.equal(c.init.credentials, 'omit');
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.body, undefined);
    assert.equal(c.init.headers.Cookie, undefined);
    if (i) assert.ok(c.start - calls[i - 1].start >= 10_000);
  });
});

test('Sie failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
  const cases = [
    () => new Response('blocked', { status: 403 }),
    () => new Response('limited', { status: 429, headers: { 'retry-after': '3600' } }),
    () =>
      new Response('redirect', { status: 302, headers: { location: 'https://example.invalid/' } }),
    () =>
      new Response(bodies.get(sieSourcePins[0].url), {
        headers: { 'content-type': 'application/json' },
      }),
    () => response(bodies.get(sieSourcePins[0].url) + 'drift', true),
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
      verifySieSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('sie-crissier', request, {
      places: { municipality: async () => ({ bfs_id: 5583 }) },
    });
    city.cached = { value: sieCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.5518, longitude: 6.5757 }), /paused/);
    await assert.rejects(
      verifySieSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [sieSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Sie later authority/contact drift cannot reuse an earlier successful source or cached peer', async () => {
  for (const bad of [2, 3, 4]) {
    let clock = 1000;
    const calls = [];
    const request = async (url) => {
      calls.push(url);
      return response(
        bodies.get(url) + (url === sieSourcePins[bad].url ? '\n' : ''),
        url.endsWith('/robots.txt'),
      );
    };
    await assert.rejects(
      verifySieSources(
        request,
        () => {},
        () => clock,
        async (ms) => {
          clock += ms;
        },
      ),
      /paused/,
    );
    assert.deepEqual(
      calls,
      sieSourcePins.slice(0, bad + 1).map((p) => p.url),
    );
    const peer = new MunicipalFormClient('sie-crissier', request, {
      places: { municipality: async () => ({ bfs_id: 5583 }) },
    });
    peer.cached = { value: sieCategories, expires: Date.now() + 300_000 };
    await assert.rejects(peer.requirements({ latitude: 46.5518, longitude: 6.5757 }), /paused/);
    assert.equal(calls.length, bad + 1);
  }
});

test('Sie exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'sie-crissier',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5591 }) } },
  );
  assert.deepEqual(await city.categories(), sieCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.5518, longitude: 6.5757 }),
    /municipality|boundary|Crissier/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () => new MunicipalFormClient('sie-crissier', undefined, { experimentalSubmission: true }),
    /only implemented/,
  );
});

test('Sie local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'sie-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient('sie-crissier', async () => assert.fail('offline only'), {
    places: { municipality: async () => ({ bfs_id: 5583 }) },
  });
  city.requirements = async () => sieRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.5518,
    longitude: 6.5757,
    location_confirmed: true,
    location_label: 'Offline actual municipal path',
    category: 'Luminaire communal SIE',
    description: 'Le luminaire communal fictif est éteint au point confirmé.',
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
    { extra_fields: { ...input.extra_fields, lamp_number: 'ABC' } },
    { extra_fields: { ...input.extra_fields, lamp_number: '1234567' } },
    { extra_fields: { ...input.extra_fields, lamp_number: '12\n' } },
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
  const numbered = await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, lamp_number: '000123' },
  });
  assert.equal(numbered.report.extra_fields.lamp_number, '000123');
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5583);
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
    description: 'Le second luminaire communal fictif est éteint.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});

const { sieMunicipalities, sieScopeFor, sieConfirmation, isSieMunicipality } =
  await import('../dist/sie-form.js');
const partnerPoints = {
  'sie-crissier': { latitude: 46.5518, longitude: 6.5757 },
  'sie-renens': { latitude: 46.538, longitude: 6.588 },
  'sie-chavannes': { latitude: 46.529, longitude: 6.573 },
  'sie-ecublens': { latitude: 46.528, longitude: 6.563 },
};

test('SIE family rejects every neighbouring profile before source reads and preserves typed destination guidance', async () => {
  for (const [name, identity] of Object.entries(sieMunicipalities)) {
    assert.equal(isSieMunicipality(name), true);
    for (const wrong of [
      ...Object.values(sieMunicipalities)
        .filter((p) => p.bfsId !== identity.bfsId)
        .map((p) => p.bfsId),
      5636,
    ]) {
      let reads = 0;
      const city = new MunicipalFormClient(
        name,
        async () => {
          reads++;
          assert.fail('wrong municipality must not read');
        },
        { places: { municipality: async () => ({ bfs_id: wrong }) } },
      );
      await assert.rejects(city.requirements(partnerPoints[name]), /municipality|boundary/i);
      assert.equal(reads, 0);
      await assert.rejects(city.submit({}), /verification/);
    }
    const city = new MunicipalFormClient(name, async () => assert.fail('cached profile only'), {
      places: { municipality: async () => ({ bfs_id: identity.bfsId }) },
    });
    city.cached = { value: sieCategories, expires: Date.now() + 300000 };
    const requirements = await city.requirements(partnerPoints[name]);
    assert.equal(city.bfsId, identity.bfsId);
    assert.equal(city.serviceId, name + '-defect-form');
    assert.equal(city.submissionMode, 'unverified');
    assert.equal(
      requirements['Luminaire communal SIE'].extra_fields[0].values[0],
      sieConfirmation(name),
    );
    assert.match(requirements['Luminaire communal SIE'].scope, new RegExp('BFS' + identity.bfsId));
    assert.ok(city.guidance.scope.includes(identity.municipality));
    assert.ok(city.reportingService.includes(identity.municipality));
    assert.ok(sieScopeFor(name).includes('this profile is limited to ' + identity.municipality));
    assert.throws(
      () => inspectMunicipalForm(name, bodies.get(sieSourcePins[1].url)),
      /complete pinned/,
    );
    for (const other of Object.values(sieMunicipalities).filter(
      (p) => p.bfsId !== identity.bfsId,
    )) {
      assert.ok(!requirements['Luminaire communal SIE'].scope.includes('BFS' + other.bfsId));
      assert.ok(!requirements['Luminaire communal SIE'].bodies[0].includes(other.municipality));
    }
    if (name !== 'sie-crissier')
      assert.doesNotMatch(JSON.stringify(requirements), /ep@sie.ch|Crissier/);
  }
  for (const name of ['sie-prilly', 'constructor', '__proto__']) {
    assert.equal(isSieMunicipality(name), false);
    assert.throws(() => sieRequirements(name), /Unsupported/);
  }
  assert.deepEqual(sieRequirements(), sieRequirements('sie-crissier'));
});

test('one SIE partner source failure permanently stops all four cached peers without municipal-host access', async () => {
  let clock = 1000,
    fail = false;
  const calls = [];
  const request = async (url, init) => {
    calls.push(url);
    assert.equal(new URL(url).hostname, 'www.sie.ch');
    assert.equal(init.method, 'GET');
    return response(
      bodies.get(url) + (fail && url === sieSourcePins[2].url ? 'drift' : ''),
      url.endsWith('/robots.txt'),
    );
  };
  const sleep = async (ms) => {
    clock += ms;
  };
  await verifySieSources(
    request,
    () => {},
    () => clock,
    sleep,
  );
  assert.equal(calls.length, 5);
  const peers = Object.entries(sieMunicipalities).map(([name, identity]) => {
    const city = new MunicipalFormClient(name, request, {
      places: { municipality: async () => ({ bfs_id: identity.bfsId }) },
    });
    city.cached = { value: sieCategories, expires: Date.now() + 300000 };
    return { name, city };
  });
  fail = true;
  await assert.rejects(
    verifySieSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
    /paused/,
  );
  assert.equal(calls.length, 8);
  await Promise.all(
    peers.map(({ name, city }) => assert.rejects(city.requirements(partnerPoints[name]), /paused/)),
  );
  assert.equal(calls.length, 8);
});

for (const [name, identity] of Object.entries(sieMunicipalities))
  test(`${identity.municipality} SIE note freezes its destination and rejects foreign confirmations, contacts, photos and sends`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'sie-family-offline-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const store = new Store(dir);
    await store.initialize();
    const city = new MunicipalFormClient(
      name,
      async () => assert.fail('no live source or native access'),
      { places: { municipality: async () => ({ bfs_id: identity.bfsId }) } },
    );
    city.requirements = async () => sieRequirements(name);
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      ...partnerPoints[name],
      location_confirmed: true,
      location_label: 'Offline exact municipal lamp location',
      category: 'Luminaire communal SIE',
      description: 'Le luminaire communal fictif est éteint au point confirmé.',
      email: '',
      photo_ids: [],
      extra_fields: { public_asset_confirmed: sieConfirmation(name) },
    };
    for (const other of Object.keys(sieMunicipalities).filter((k) => k !== name))
      await assert.rejects(
        service.prepare({
          ...input,
          extra_fields: { public_asset_confirmed: sieConfirmation(other) },
        }),
      );
    for (const change of [
      { name: 'PrivateName' },
      { email: 'private@example.invalid' },
      { phone: '0210000000' },
      { extra_fields: {} },
      { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
      { extra_fields: { ...input.extra_fields, lamp_number: '1234567' } },
      { extra_fields: { ...input.extra_fields, lamp_number: '1\n' } },
      { extra_fields: { ...input.extra_fields, lamp_number: 'abc' } },
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
    const p = await service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, lamp_number: '000123' },
    });
    assert.equal(p.municipality.bfs_id, identity.bfsId);
    assert.equal(p.report.extra_fields.lamp_number, '000123');
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    const stored = await store.confirmed(p.preview_id, p.confirmation_token);
    assert.deepEqual(stored.destination, {
      bfs_id: identity.bfsId,
      service_id: name + '-defect-form',
    });
    await assert.rejects(
      service.submit(p.preview_id, p.confirmation_token, true),
      /verification|unverified|disabled/i,
    );
    const q = await service.prepare({
      ...input,
      description: 'Le second luminaire communal fictif est éteint.',
    });
    assert.notEqual(q.preview_id, p.preview_id);
    assert.equal(p.report.description, input.description);
    assert.equal(q.submission_enabled, false);
  });
