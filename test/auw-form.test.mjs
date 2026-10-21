import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  auwCategories,
  auwCategory,
  auwRequirements,
  verifyAuwSources,
  auwSources,
} from '../dist/auw-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('Elektra Auw metadata is read-free, exact Auw gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('elektra-auw', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), auwCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.21, longitude: 8.36 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4223;
  await assert.rejects(city.requirements({ latitude: 47.21, longitude: 8.36 }), /paused/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, auwSources[0].url);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(() => inspectMunicipalForm('elektra-auw', '<form/>'), /complete pinned/);
  assert.throws(
    () => new MunicipalFormClient('elektra-auw', request, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Elektra Auw 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
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
      verifyAuwSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('elektra-auw', request, {
      places: { municipality: async () => ({ bfs_id: 4223 }) },
    });
    city.cached = { value: auwCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.21, longitude: 8.36 }), /paused/);
    await assert.rejects(
      verifyAuwSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('Elektra Auw telephone-only preparation preserves plate zeros/private contacts, rejects other native branches and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'auw-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'elektra-auw',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4223 }) } },
  );
  city.requirements = async () => auwRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.21,
    longitude: 8.36,
    location_confirmed: true,
    location_label: 'Offline actual Auw lamp',
    category: auwCategory,
    description: 'Fictional offline lamp defect.',
    email: '',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      reporter_name: 'Private Fullname',
      reporter_address: 'PrivateStreet 7 / PrivateTown',
      lamp_location: 'ActualOfflineStreet',
      defect_type: 'Light is off',
      lamp_number: '0007',
      privacy_acknowledgement: 'Elektra Auw privacy policy read and understood',
      public_lamp_confirmed: 'Actual public lamp in Auw maintained by Elektra Auw confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
    { phone: '' },
    { email: 'not-supported@example.invalid' },
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
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.lamp_number, '0007');
  assert.equal(preview.report.extra_fields.reporter_name, 'Private Fullname');
  assert.equal(preview.report.extra_fields.defect_type, 'Light is off');
  assert.equal(preview.report.email, '');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 4223, service_id: 'elektra-auw-defect-form' });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
