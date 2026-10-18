import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { verifyPublicSourceManifest } from '../dist/public-source-manifest.js';
import { hornetSources, hornetRequirements, hornetCategories } from '../dist/hornet-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const ownBody =
  '<html><script>throw new Error("must never execute")</script>Own offline example</html>';
const pin = {
  url: 'https://example.invalid/public',
  type: 'html',
  maxBytes: 1000,
  sha256: createHash('sha256').update(ownBody).digest('hex'),
};
// These independently authored fixtures exercise the verifier, not copied provider
// bundles. Actual production pins are separately verified against dated captures.
test('source verifier streams exact bytes, omits cookies and refuses drift, wrong media, redirects, oversize and HTTP retry state', async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push([url, init]);
    return new Response(
      new ReadableStream({
        start(c) {
          const b = new TextEncoder().encode(ownBody);
          c.enqueue(b.slice(0, 13));
          c.enqueue(b.slice(13));
          c.close();
        },
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  };
  await verifyPublicSourceManifest(request, [pin], () => assert.fail('unexpected retry'));
  assert.equal(calls.length, 1);
  const init = calls[0][1];
  assert.equal(init.method, 'GET');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.equal(init.body, undefined);
  assert.equal(init.headers.Authorization, undefined);
  assert.equal(init.headers.Cookie, undefined);
  for (const response of [
    () => new Response(ownBody + 'changed', { headers: { 'content-type': 'text/html' } }),
    () => new Response(ownBody, { headers: { 'content-type': 'application/json' } }),
    () =>
      new Response(ownBody, {
        status: 302,
        headers: { Location: 'https://invalid.example', 'content-type': 'text/html' },
      }),
  ])
    await assert.rejects(
      verifyPublicSourceManifest(
        async () => response(),
        [pin],
        () => {},
      ),
      /changed/,
    );
  await assert.rejects(
    verifyPublicSourceManifest(request, [{ ...pin, maxBytes: 10 }], () => {}),
    /changed/,
  );
  const redirected = new Response(ownBody, { headers: { 'content-type': 'text/html' } });
  Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(
    verifyPublicSourceManifest(
      async () => redirected,
      [pin],
      () => {},
    ),
    /changed/,
  );
  const wrongUrl = new Response(ownBody, { headers: { 'content-type': 'text/html' } });
  Object.defineProperty(wrongUrl, 'url', { value: 'https://other.invalid/public' });
  await assert.rejects(
    verifyPublicSourceManifest(
      async () => wrongUrl,
      [pin],
      () => {},
    ),
    /changed/,
  );
  let delay;
  await assert.rejects(
    verifyPublicSourceManifest(
      async () => new Response('', { status: 429, headers: { 'retry-after': '600' } }),
      [pin],
      (v) => (delay = v),
      () => 0,
    ),
    /changed/,
  );
  assert.equal(delay, 600000);
  for (const invalid of [
    { ...pin, url: 'http://example.invalid' },
    { ...pin, sha256: 'invalid' },
    { ...pin, maxBytes: 3000001 },
  ])
    await assert.rejects(
      verifyPublicSourceManifest(
        async () => assert.fail('must reject before GET'),
        [invalid],
        () => {},
      ),
      /Invalid/,
    );
});
test('Aarau source gate checks exact BFS before GET, fails closed and respects provider cooldown without any resident lookup', async () => {
  let bfs = 4003,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'hornet-aarau',
    async (url, init) => {
      calls.push([String(url), init]);
      return new Response('', { status: 429, headers: { 'retry-after': '600' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.392, longitude: 8.045 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 1);
  now = 300001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 1);
  now = 600001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([u, i]) => u === hornetSources[0].url && i.method === 'GET' && !i.body));
  assert.ok(Object.isFrozen(hornetSources) && hornetSources.every(Object.isFrozen));
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  await assert.rejects(city.submit({}), /verification/);
  assert.throws(
    () => new MunicipalFormClient('hornet-aarau', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('hornet preview validates real past dates including leap years and Zurich midnight, private contacts, photo, consent and narrow class', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-hornet-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let now = Date.parse('2026-10-18T22:05:00Z');
  const store = new Store(dir, () => now);
  await store.initialize();
  const city = new MunicipalFormClient(
    'hornet-aarau',
    async () => assert.fail('offline rule boundary test must not access network'),
    { places: { municipality: async () => ({ bfs_id: 4001 }) } },
  );
  // Source-integrity behavior is tested independently above. This deliberate rule
  // double isolates the shared preview boundary from third-party source fixtures.
  city.requirements = async () => hornetRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#334455' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  const input = {
    latitude: 47.392,
    longitude: 8.045,
    location_confirmed: true,
    location_label: 'Offline actual sighting point',
    category: hornetCategories[0].service_code,
    description: 'Fictional offline suspected hornet observation.',
    email: 'private@example.invalid',
    photo_ids: [photo.metadata.id],
    extra_fields: {
      first_name: 'Private',
      last_name: 'Resident',
      observation_date: '2026-10-19',
      hornet_sighting_confirmed: 'Individual suspected hornet sighting in Aarau confirmed',
      data_policy_consent: 'I have read and accept the provider privacy notice',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const date of [
    '2026-02-29',
    '2024-02-30',
    '2026-13-01',
    '2026-10-20',
    '19.10.2026',
    '0000-01-01',
    '2026-1-01',
  ])
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, observation_date: date },
      }),
      /date|format/,
    );
  await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, observation_date: '2024-02-29' },
  });
  await service.prepare(input);
  now = Date.parse('2026-10-18T21:59:00Z');
  await assert.rejects(service.prepare(input), /future/);
  now = Date.parse('2026-10-18T22:05:00Z');
  await assert.rejects(service.prepare({ ...input, photo_ids: [] }), /photo/);
  const photo2 = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 3, height: 3, channels: 3, background: '#112233' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [photo.metadata.id, photo2.metadata.id] }),
    /at most 1/,
  );
  await assert.rejects(service.prepare({ ...input, category: 'Nest' }), /Category/);
  await assert.rejects(service.prepare({ ...input, phone: '1'.repeat(21) }), /20/);
  await assert.rejects(service.prepare({ ...input, name: 'Wrong combined name' }), /name/);
  await assert.rejects(service.prepare({ ...input, description: 'x'.repeat(1001) }), /1000/);
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, first_name: 'x'.repeat(101) },
    }),
    /100/,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, hornet_sighting_confirmed: 'nest' },
    }),
    /choice/,
  );
  const p = await service.prepare({ ...input, phone: '+41 79 000 00 00' });
  assert.equal(p.submission_enabled, false);
  assert.equal(p.municipality.bfs_id, 4001);
  assert.equal(p.report.extra_fields.first_name, 'Private');
  assert.equal(p.attachments.length, 1);
  assert.match(p.terms_url, /bedingungen/);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.service_id, 'hornet-aarau-defect-form');
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  assert.equal((await store.receipts()).length, 0);
});
