import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  rwbSources,
  rwbRequirements,
  rwbCategory,
  rwbPrivacyUrl,
  rwbInvitationUrl,
} from '../dist/rwb-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('RWB pins complete immutable sources and never substitutes a partial inspector for the manifest', () => {
  assert.equal(rwbSources.length, 4);
  assert.ok(Object.isFrozen(rwbSources) && rwbSources.every(Object.isFrozen));
  assert.throws(
    () => inspectMunicipalForm('rwb-ennetbaden', '<form><input required></form>'),
    /complete pinned/,
  );
  const req = rwbRequirements()[rwbCategory];
  assert.equal(req.max_photos, 0);
  assert.equal(req.phone_required, true);
  for (const f of req.extra_fields.filter((f) =>
    [
      'salutation',
      'first_name',
      'last_name',
      'reporter_street',
      'reporter_house_number',
      'contact_postcode',
      'contact_locality',
    ].includes(f.code),
  ))
    assert.ok(f.required && f.contact);
  assert.doesNotMatch(JSON.stringify(req), /__trustedProperties|recaptcha\/api|cHash=|__referrer/);
});
test('RWB Ennetbaden gate precedes GETs, observes cooldown and rejects unverified send under all flags', async () => {
  let bfs = 4027,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'rwb-ennetbaden',
    async (u, i) => {
      calls.push([u, i]);
      return new Response('', { status: 429, headers: { 'retry-after': '600' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const p = { latitude: 47.48, longitude: 8.315 };
  await assert.rejects(city.requirements(p), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4026;
  await assert.rejects(city.requirements(p), /changed/);
  now = 300001;
  await assert.rejects(city.requirements(p), /changed/);
  assert.equal(calls.length, 1);
  now = 600001;
  await assert.rejects(city.requirements(p), /changed/);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ([u, i]) =>
        u === rwbInvitationUrl &&
        i.method === 'GET' &&
        i.credentials === 'omit' &&
        i.redirect === 'error' &&
        !i.body,
    ),
  );
  for (const make of [
    () =>
      new Response('independently authored wrong source', {
        headers: { 'content-type': 'text/html' },
      }),
    () => new Response('', { status: 403 }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => {
      const r = new Response('<form>', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'url', { value: 'https://example.invalid/' });
      return r;
    },
  ]) {
    let n = 0;
    const c = new MunicipalFormClient(
      'rwb-ennetbaden',
      async () => {
        n++;
        return make();
      },
      { places: { municipality: async () => ({ bfs_id: 4026 }) } },
    );
    await assert.rejects(c.requirements(p), /changed/);
    await assert.rejects(c.requirements(p), /changed/);
    assert.equal(n, 1);
  }
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.termsUrl, rwbPrivacyUrl);
  assert.match(city.guidance.scope, /Ennetbaden/);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('rwb-ennetbaden', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('RWB requires private house and consent, preserves actual lamp number and destination, and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rwb-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'rwb-ennetbaden',
    async () => assert.fail('rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4026 }) } },
  );
  city.requirements = async () => rwbRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.48,
    longitude: 8.315,
    location_confirmed: true,
    location_label: 'Offline actual Ennetbaden lamp',
    category: rwbCategory,
    description: 'Fictional offline public lamp defect.',
    email: 'private@example.invalid',
    phone: '0560000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      reporter_street: 'PrivateResidence',
      reporter_house_number: '42A',
      contact_postcode: '5408',
      contact_locality: 'PrivateTown',
      salutation: 'Frau',
      lighting_street: 'ActualLampStreet',
      public_lamp_confirmed: 'Public lamp in Ennetbaden maintained by RWB confirmed',
      data_policy_consent: 'I have read and accept the provider privacy notice',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const [k, v] of [
    ['salutation', 'unspecified'],
    ['contact_postcode', '0000'],
    ['contact_postcode', '100000'],
    ['data_policy_consent', 'automatic'],
    ['public_lamp_confirmed', 'private fixture'],
    ['reporter_house_number', 'x'.repeat(101)],
  ])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, [k]: v } }),
    );
  for (const c of [
    { phone: '' },
    { email: '' },
    { name: 'Combined name' },
    { category: 'Wasser' },
    { description: 'x'.repeat(4001) },
  ])
    await assert.rejects(service.prepare({ ...input, ...c }));
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const p = await service.prepare(input);
  assert.equal(p.report.extra_fields.lamp_number, undefined);
  assert.equal(p.report.extra_fields.reporter_house_number, '42A');
  assert.equal(p.report.extra_fields.lighting_street, 'ActualLampStreet');
  assert.equal(p.municipality.bfs_id, 4026);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const f = await store.preview(p.preview_id);
  assert.equal(f.destination.service_id, 'rwb-ennetbaden-defect-form');
  assert.equal(f.terms_url, rwbPrivacyUrl);
  const q = await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, lamp_number: '0007-A' },
  });
  assert.equal(q.report.extra_fields.lamp_number, '0007-A');
  await assert.rejects(
    service.submit(q.preview_id, q.confirmation_token, true, rwbPrivacyUrl),
    /verification/,
  );
  assert.equal((await store.receipts()).length, 0);
});
