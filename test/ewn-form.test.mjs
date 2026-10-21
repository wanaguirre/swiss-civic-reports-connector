import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { ewnSources, ewnRequirements, ewnCategories, ewnFormUrl } from '../dist/ewn-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('EWN requires the complete fixed manifest, retains native fault identity and distinguishes optional private address from actual lamp', () => {
  assert.equal(ewnSources.length, 5);
  assert.ok(Object.isFrozen(ewnSources) && ewnSources.every(Object.isFrozen));
  assert.throws(
    () => inspectMunicipalForm('ewn-neuenhof', '<form>independent fixture</form>'),
    /complete pinned/,
  );
  assert.equal(ewnCategories[0].service_code, 'euchte brennt nicht');
  assert.equal(ewnCategories[0].service_name, 'Leuchte brennt nicht');
  const r = ewnRequirements()[ewnCategories[0].service_code];
  for (const code of ['first_name', 'last_name', 'salutation'])
    assert.ok(
      r.extra_fields.find((f) => f.code === code).required &&
        r.extra_fields.find((f) => f.code === code).contact,
    );
  for (const code of ['contact_company', 'reporter_street', 'contact_postcode', 'contact_locality'])
    assert.ok(
      !r.extra_fields.find((f) => f.code === code).required &&
        r.extra_fields.find((f) => f.code === code).contact,
    );
  assert.equal(r.extra_fields.find((f) => f.code === 'contact_postcode').format, undefined);
  assert.ok(!r.extra_fields.some((f) => /captcha|state|consent/.test(f.code)));
});
test('EWN exact Neuenhof gate precedes GETs, fails closed on source mismatch and honors Retry-After with no sending', async () => {
  let bfs = 4033,
    now = 0;
  const calls = [];
  const c = new MunicipalFormClient(
    'ewn-neuenhof',
    async (u, i) => {
      calls.push([u, i]);
      return new Response('', { status: 429, headers: { 'retry-after': '600' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const p = { latitude: 47.449, longitude: 8.324 };
  await assert.rejects(c.requirements(p), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4034;
  await assert.rejects(c.requirements(p), /changed/);
  now = 300001;
  await assert.rejects(c.requirements(p), /changed/);
  assert.equal(calls.length, 1);
  now = 600001;
  await assert.rejects(c.requirements(p), /changed/);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ([u, i]) =>
        u === ewnFormUrl &&
        i.method === 'GET' &&
        i.credentials === 'omit' &&
        i.redirect === 'error' &&
        !i.body,
    ),
  );
  for (const make of [
    () => new Response('own wrong source', { headers: { 'content-type': 'text/html' } }),
    () => new Response('', { status: 403 }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => {
      const r = new Response('<form>', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
  ]) {
    let n = 0;
    const a = new MunicipalFormClient(
      'ewn-neuenhof',
      async () => {
        n++;
        return make();
      },
      { places: { municipality: async () => ({ bfs_id: 4034 }) } },
    );
    await assert.rejects(a.requirements(p), /changed/);
    await assert.rejects(a.requirements(p), /changed/);
    assert.equal(n, 1);
  }
  assert.equal(c.submissionMode, 'unverified');
  assert.equal(c.trackingSupported, false);
  assert.equal(c.fallbackPrefilled, false);
  assert.equal(c.termsUrl, undefined);
  await assert.rejects(c.submit({}), /verification/);
  await assert.rejects(c.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('ewn-neuenhof', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('EWN preserves real number OR precise location, optional postal contacts and frozen destination with zero photos or sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'ewn-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'ewn-neuenhof',
    async () => assert.fail('rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4034 }) } },
  );
  city.requirements = async () => ewnRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.449,
    longitude: 8.324,
    location_confirmed: true,
    location_label: 'Offline Neuenhof lamp point',
    category: ewnCategories[0].service_code,
    description: 'Fictional offline public lamp fault.',
    email: 'private@example.invalid',
    phone: '0560000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      salutation: 'Frau',
      lighting_street: 'ActualLampStreet',
      lamp_identity_or_location: '0007-A',
      public_lamp_confirmed: 'Public lamp in Neuenhof maintained by EWN confirmed',
    },
  };
  for (const code of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  for (const change of [
    { phone: '' },
    { email: '' },
    { name: 'Combined name' },
    { category: 'Water' },
    { phone: '1'.repeat(51) },
    { description: 'x'.repeat(4001) },
    { extra_fields: { ...input.extra_fields, lamp_identity_or_location: 'x'.repeat(251) } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  for (const category of ewnCategories.map((c) => c.service_code))
    await service.prepare({ ...input, category });
  const p = await service.prepare(input);
  assert.equal(p.report.category, 'euchte brennt nicht');
  assert.equal(p.report.extra_fields.lamp_identity_or_location, '0007-A');
  assert.equal(p.report.extra_fields.contact_company, undefined);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.submission_enabled, false);
  const f = await store.preview(p.preview_id);
  assert.equal(f.destination.service_id, 'ewn-neuenhof-defect-form');
  assert.equal(f.destination.bfs_id, 4034);
  const q = await service.prepare({
    ...input,
    extra_fields: {
      ...input.extra_fields,
      lamp_identity_or_location: 'Beside the confirmed public footpath bench',
      contact_company: 'PrivateCompany',
      reporter_street: 'PrivateResidence',
      contact_postcode: 'CH-5432',
      contact_locality: 'PrivateTown',
    },
  });
  assert.equal(q.report.extra_fields.contact_postcode, 'CH-5432');
  assert.equal(q.report.extra_fields.contact_company, 'PrivateCompany');
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  await assert.rejects(service.submit(q.preview_id, q.confirmation_token, true), /verification/);
  assert.equal((await store.receipts()).length, 0);
});
