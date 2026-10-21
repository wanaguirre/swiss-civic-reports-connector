import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  tbseonCategories,
  tbseonCategory,
  tbseonRequirements,
  verifyTbseonSources,
  tbseonSources,
} from '../dist/tbseon-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('TB Seon metadata is read-free, exact Egliswil gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('tbseon-egliswil', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), tbseonCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.35, longitude: 8.18 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4195;
  await assert.rejects(city.requirements({ latitude: 47.35, longitude: 8.18 }), /paused/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, tbseonSources[0].url);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(() => inspectMunicipalForm('tbseon-egliswil', '<form/>'), /complete pinned/);
  assert.throws(
    () => new MunicipalFormClient('tbseon-egliswil', request, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('TB Seon 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
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
      verifyTbseonSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('tbseon-egliswil', request, {
      places: { municipality: async () => ({ bfs_id: 4195 }) },
    });
    city.cached = { value: tbseonCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.35, longitude: 8.18 }), /paused/);
    await assert.rejects(
      verifyTbseonSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('TB Seon telephone-only preparation preserves plate zeros/private contacts, rejects other native branches and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tbseon-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'tbseon-egliswil',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4195 }) } },
  );
  city.requirements = async () => tbseonRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.35,
    longitude: 8.18,
    location_confirmed: true,
    location_label: 'Offline actual Egliswil lamp',
    category: tbseonCategory,
    description: 'Fictional offline lamp defect.',
    email: '',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      reporter_street: 'PrivateRoad 7',
      contact_postcode: '5704',
      contact_locality: 'PrivateTown',
      contact_preference: 'Telefon',
      privacy_acknowledgement: 'TB Seon privacy policy read and understood',
      lamp_plate_line_2: '0007',
      lamp_plate_line_3: '002',
      public_lamp_confirmed: 'Actual EWG public lamp in Egliswil maintained by TB Seon confirmed',
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
    { category: 'Anmeldung & Umzug' },
    { category: 'Zähler ablesen' },
    { description: 'x'.repeat(4001) },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  for (const choice of ['E-Mail', 'gar nicht', 'Telefon & E-Mail'])
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, contact_preference: choice },
      }),
    );
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
  assert.equal(preview.report.extra_fields.lamp_plate_line_2, '0007');
  assert.equal(preview.report.extra_fields.lamp_plate_line_3, '002');
  assert.equal(preview.report.email, '');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 4195, service_id: 'tbseon-egliswil-defect-form' });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
