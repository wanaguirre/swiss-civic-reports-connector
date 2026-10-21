import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectGrandsonSource,
  grandsonSourcePins,
  grandsonCategories,
  grandsonRequirements,
  verifyGrandsonSources,
} from '../dist/grandson-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const bodies = new Map();
for (const [i, slug] of ['robots', 'works', 'municipality', 'contact'].entries()) {
  const file = new URL(`fixtures/grandson-${slug}.${i ? 'html.gz' : 'txt'}`, import.meta.url);
  const data = await readFile(file);
  bodies.set(
    grandsonSourcePins[i].url,
    i ? gunzipSync(data).toString('utf8') : data.toString('utf8'),
  );
}
const response = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const confirmation = 'Nonurgent fault of actual municipal public asset in Grandson confirmed';

test('Grandson complete public captures pin the actual fault invitation, responsibilities, directory and global declarations', () => {
  for (const pin of grandsonSourcePins) {
    inspectGrandsonSource(pin.url, bodies.get(pin.url));
    for (const change of [
      bodies.get(pin.url) + '\n',
      '\ufeff' + bodies.get(pin.url),
      'x'.repeat(1_000_001),
    ])
      assert.throws(() => inspectGrandsonSource(pin.url, change), /paused/);
  }
  const work = bodies.get(grandsonSourcePins[1].url);
  for (const [from, to] of [
    ['Toute perturbation', 'Aucune perturbation'],
    ['(0)79 436 88 63', '(0)79 000 00 00'],
    ['travaux@grandson.ch', 'other@example.invalid'],
    ['éclairage public', 'éclairage privé'],
    ['recaptcha/api.js', 'recaptcha/changed.js'],
  ]) {
    const changed = work.replace(from, to);
    assert.ok(changed !== work, `Mutation target missing: ${from}`);
    assert.throws(() => inspectGrandsonSource(grandsonSourcePins[1].url, changed), /paused/);
  }
  assert.throws(() => inspectGrandsonSource('https://example.invalid/', work), /paused/);
  assert.throws(() => inspectMunicipalForm('grandson-voirie', work), /complete pinned/);
  const r = grandsonRequirements()['Voirie communale'];
  assert.equal(r.email_supported, false);
  assert.deepEqual(r.contact_fields, []);
  assert.equal(r.max_photos, 0);
  assert.equal(r.extra_fields.length, 1);
  assert.match(r.extra_fields[0].values[0], /Nonurgent/);
});

test('Grandson concurrent source verification shares ten-second starts and only four fixed credential-free GETs', async () => {
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
    verifyGrandsonSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
    verifyGrandsonSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
  ]);
  assert.deepEqual(values, [grandsonCategories, grandsonCategories]);
  assert.equal(calls.length, 8);
  calls.forEach((c, i) => {
    assert.equal(c.init.method, 'GET');
    assert.equal(c.init.credentials, 'omit');
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.body, undefined);
    assert.equal(c.init.headers.Cookie, undefined);
    if (i) assert.ok(c.start - calls[i - 1].start >= 10_000);
  });
});

test('Grandson failures, malformed MIME/UTF8/size and redirects stop peers before stale cached requirements without retries', async () => {
  const cases = [
    () => new Response('blocked', { status: 403 }),
    () => new Response('limited', { status: 429, headers: { 'retry-after': '3600' } }),
    () =>
      new Response('redirect', { status: 302, headers: { location: 'https://example.invalid/' } }),
    () =>
      new Response(bodies.get(grandsonSourcePins[0].url), {
        headers: { 'content-type': 'application/json' },
      }),
    () => response(bodies.get(grandsonSourcePins[0].url) + 'drift', true),
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
      verifyGrandsonSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('grandson-voirie', request, {
      places: { municipality: async () => ({ bfs_id: 5561 }) },
    });
    city.cached = { value: grandsonCategories, expires: Date.now() + 300_000 };
    await assert.rejects(city.requirements({ latitude: 46.809, longitude: 6.646 }), /paused/);
    await assert.rejects(
      verifyGrandsonSources(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [grandsonSourcePins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Grandson later authority/contact drift cannot reuse an earlier successful source or cached peer', async () => {
  for (const bad of [2, 3]) {
    let clock = 1000;
    const calls = [];
    const request = async (url) => {
      calls.push(url);
      return response(
        bodies.get(url) + (url === grandsonSourcePins[bad].url ? '\n' : ''),
        url.endsWith('/robots.txt'),
      );
    };
    await assert.rejects(
      verifyGrandsonSources(
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
      grandsonSourcePins.slice(0, bad + 1).map((p) => p.url),
    );
    const peer = new MunicipalFormClient('grandson-voirie', request, {
      places: { municipality: async () => ({ bfs_id: 5561 }) },
    });
    peer.cached = { value: grandsonCategories, expires: Date.now() + 300_000 };
    await assert.rejects(peer.requirements({ latitude: 46.809, longitude: 6.646 }), /paused/);
    assert.equal(calls.length, bad + 1);
  }
});

test('Grandson exact municipality gate precedes all source reads; category metadata and send refusal need no network', async () => {
  let reads = 0;
  const city = new MunicipalFormClient(
    'grandson-voirie',
    async () => {
      reads++;
      assert.fail('read before exact point');
    },
    { places: { municipality: async () => ({ bfs_id: 5560 }) } },
  );
  assert.deepEqual(await city.categories(), grandsonCategories);
  await assert.rejects(
    city.requirements({ latitude: 46.809, longitude: 6.646 }),
    /municipality|boundary|Grandson/i,
  );
  await assert.rejects(city.requirements(), /point|location|required/i);
  await assert.rejects(city.submit({}), /verification/);
  assert.equal(reads, 0);
  assert.throws(
    () => new MunicipalFormClient('grandson-voirie', undefined, { experimentalSubmission: true }),
    /only implemented/,
  );
});

test('Grandson local note rejects reporter contacts, photos, foreign categories and native state; preview stays frozen and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'grandson-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient('grandson-voirie', async () => assert.fail('offline only'), {
    places: { municipality: async () => ({ bfs_id: 5561 }) },
  });
  city.requirements = async () => grandsonRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.809,
    longitude: 6.646,
    location_confirmed: true,
    location_label: 'Offline actual municipal path',
    category: 'Voirie communale',
    description: 'Le chemin communal fictif au point confirmé est endommagé.',
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
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [image.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 5561);
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
    description: 'Le second chemin communal fictif est endommagé.',
  });
  assert.notEqual(q.preview_id, p.preview_id);
  assert.equal(p.report.description, input.description);
  assert.equal(q.submission_enabled, false);
});
