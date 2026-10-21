import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { ibwCategories, ibwRequirements } from '../dist/ibw-form.js';
import { ibwFormUrl } from '../dist/ibw-source.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('ibw exact Wohlen AG gate precedes source GET; metadata is GET-free, experiments and sends unavailable', async () => {
  let bfs = 360;
  const calls = [];
  const c = new MunicipalFormClient(
    'ibw-wohlen-ag',
    async (u, i) => {
      calls.push({ u, i });
      return new Response('changed', { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  assert.deepEqual(await c.categories(), ibwCategories);
  assert.equal(calls.length, 0);
  for (const n of [360, 4064]) {
    bfs = n;
    await assert.rejects(c.requirements({ latitude: 47.35, longitude: 8.28 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4082;
  await assert.rejects(c.requirements({ latitude: 47.35, longitude: 8.28 }), /changed/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].u, ibwFormUrl);
  assert.equal(calls[0].i.method, 'GET');
  await assert.rejects(c.requirements({ latitude: 47.35, longitude: 8.28 }), /paused/);
  assert.equal(calls.length, 1);
  assert.equal(c.termsUrl, undefined);
  assert.equal(c.submissionMode, 'unverified');
  assert.equal(c.trackingSupported, false);
  assert.equal(c.fallbackPrefilled, false);
  assert.throws(
    () => inspectMunicipalForm('ibw-wohlen-ag', '<form>own fixture</form>'),
    /complete checked/,
  );
  assert.throws(
    () => new MunicipalFormClient('ibw-wohlen-ag', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(c.submit({}), /verification/);
  await assert.rejects(c.report('offline'), /unverified/);
});
test('ibw private fields, real numeric lamp zeros and frozen destination; mandatory privacy, optional salutation/phone, no photos or sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'ibw-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'ibw-wohlen-ag',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4082 }) } },
  );
  city.requirements = async () => ibwRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.35,
    longitude: 8.28,
    location_confirmed: true,
    location_label: 'Offline actual lamp point',
    category: 'Defekte Strassenbeleuchtung',
    description: 'Fictional offline lamp fault.',
    email: 'private@example.invalid',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      privacy_acknowledgement: 'Official ibw privacy policy read and understood',
      lighting_street: 'Actual lamp street',
      lamp_number: '0007',
      public_lamp_confirmed: 'Public lamp in Wohlen AG maintained by ibw confirmed',
    },
  };
  for (const k of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[k];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(k));
  }
  for (const change of [
    { email: '' },
    { email: 'a'.repeat(40) + '@example.invalid' },
    { phone: '1'.repeat(51) },
    { name: 'Combined name' },
    { category: 'Water' },
    { extra_fields: { ...input.extra_fields, lamp_number: '00A7' } },
    { extra_fields: { ...input.extra_fields, lamp_number: '1'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, first_name: 'x'.repeat(51) } },
    { extra_fields: { ...input.extra_fields, reporter_street: 'Invented private address' } },
    { extra_fields: { ...input.extra_fields, privacy_acknowledgement: 'yes' } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const p = await service.prepare(input);
  assert.equal(p.report.extra_fields.lamp_number, '0007');
  assert.equal(p.report.phone, undefined);
  assert.equal(p.report.extra_fields.salutation, undefined);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 4082);
  assert.equal(frozen.destination.service_id, 'ibw-wohlen-ag-defect-form');
  assert.equal(p.municipality.name, 'Wohlen (AG)');
  const q = await service.prepare({
    ...input,
    phone: '056 000 00 00',
    extra_fields: {
      ...input.extra_fields,
      salutation: 'Frau',
      lamp_house_number: '7a',
      multiple_lamps: 'Several lamps on the same street are affected',
    },
  });
  assert.equal(q.report.extra_fields.lamp_house_number, '7a');
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true),
    /disabled|verification/i,
  );
});
