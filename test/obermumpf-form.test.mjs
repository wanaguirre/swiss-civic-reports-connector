import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  obermumpfCategories,
  obermumpfCategory,
  obermumpfRequirements,
  verifyObermumpfSources,
  obermumpfSources,
} from '../dist/obermumpf-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('Municipal Obermumpf metadata is read-free, exact Obermumpf gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('obermumpf-lighting', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), obermumpfCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.53, longitude: 7.93 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4256;
  await assert.rejects(city.requirements({ latitude: 47.53, longitude: 7.93 }), /paused/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /defekte-strassenlampen/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(() => inspectMunicipalForm('obermumpf-lighting', '<form/>'), /complete pinned/);
  assert.throws(
    () => new MunicipalFormClient('obermumpf-lighting', request, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Municipal Obermumpf 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
  for (const status of [403, 429, 302, 200]) {
    let count = 0;
    const request = async () => {
      count++;
      return new Response('changed', {
        status,
        headers: { 'content-type': status === 200 ? 'application/json' : 'text/html' },
      });
    };
    await assert.rejects(
      verifyObermumpfSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('obermumpf-lighting', request, {
      places: { municipality: async () => ({ bfs_id: 4256 }) },
    });
    city.cached = { value: obermumpfCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.53, longitude: 7.93 }), /paused/);
    await assert.rejects(
      verifyObermumpfSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('Municipal Obermumpf email-and-phone preparation preserves plate zeros/private contacts, rejects other native branches and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'obermumpf-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'obermumpf-lighting',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4256 }) } },
  );
  city.requirements = async () => obermumpfRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.53,
    longitude: 7.93,
    location_confirmed: true,
    location_label: 'Offline actual Obermumpf lamp',
    category: obermumpfCategory,
    description: 'Fictional offline lamp defect.',
    email: 'private@example.invalid',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      first_name: 'Private',
      last_name: 'Fullname',
      reporter_street: 'PrivateStreet',
      contact_house_number: '7',
      contact_postcode: '4324',
      contact_locality: 'PrivateTown',
      lamp_street: 'ActualOfflineStreet',
      defect_type: 'Lampe brennt nicht',
      lamp_number: '0007',
      privacy_acknowledgement: 'Obermumpf privacy policy read and understood',
      public_lamp_confirmed: 'Actual municipal public lamp in Obermumpf confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    if (key === 'lamp_number') continue;
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
    { phone: '' },
    { email: '' },
    { name: 'Combined Name' },
    { category: 'Stromausfall' },
    { category: 'Zähler ablesen' },
    { description: 'x'.repeat(4001) },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, kunden_nr: 'foreign-field' },
    }),
  );
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
  const noPlate = { ...input, extra_fields: { ...input.extra_fields } };
  delete noPlate.extra_fields.lamp_number;
  await service.prepare(noPlate);
  for (const contact_postcode of ['04324', '999', '100000'])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, contact_postcode } }),
      /postcode/i,
    );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, defect_type: 'Stromausfall' },
    }),
    /defect_type/,
  );
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.lamp_number, '0007');
  assert.equal(preview.report.extra_fields.first_name, 'Private');
  assert.equal(preview.report.extra_fields.defect_type, 'Lampe brennt nicht');
  assert.equal(preview.report.email, 'private@example.invalid');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, {
    bfs_id: 4256,
    service_id: 'obermumpf-lighting-defect-form',
  });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
