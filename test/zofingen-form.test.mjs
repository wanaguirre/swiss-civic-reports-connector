import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  zofingenCategories,
  zofingenRequirements,
  verifyZofingenSources,
  zofingenSources,
} from '../dist/zofingen-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

const zofingenCategory = 'Strasse / Trottoir';

test('Municipal Zofingen metadata is read-free, exact Zofingen gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('zofingen-infrastructure', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), zofingenCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.29, longitude: 7.94 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4289;
  await assert.rejects(city.requirements({ latitude: 47.29, longitude: 7.94 }), /paused/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /meldeformular-schaeden/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(
    () => inspectMunicipalForm('zofingen-infrastructure', '<form/>'),
    /complete pinned/,
  );
  assert.throws(
    () =>
      new MunicipalFormClient('zofingen-infrastructure', request, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Municipal Zofingen 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
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
      verifyZofingenSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('zofingen-infrastructure', request, {
      places: { municipality: async () => ({ bfs_id: 4289 }) },
    });
    city.cached = { value: zofingenCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.29, longitude: 7.94 }), /paused/);
    await assert.rejects(
      verifyZofingenSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('Municipal Zofingen infrastructure preparation preserves actual date and private contacts, rejects other native branches and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'zofingen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'zofingen-infrastructure',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4289 }) } },
  );
  city.requirements = async () => zofingenRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.29,
    longitude: 7.94,
    location_confirmed: true,
    location_label: 'Offline actual Zofingen municipal pavement',
    category: zofingenCategory,
    description: 'Fictional offline pavement damage.',
    email: 'private@example.invalid',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      contact_name: 'Private Fullname',
      observation_date: '2026-01-02',
      asset_street: 'ActualOfflineStreet 7',
      building: 'Municipal building',
      privacy_acknowledgement: 'Zofingen privacy policy read and understood',
      municipal_asset_confirmed: 'Actual municipal infrastructure in Zofingen confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    if (key === 'building') continue;
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
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.photo_id] }), /photo/);
  const noBuilding = { ...input, extra_fields: { ...input.extra_fields } };
  delete noBuilding.extra_fields.building;
  await service.prepare(noBuilding);
  for (const observation_date of ['2026-02-30', '2027-01-01', '02.01.2026', '2026-1-2'])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, observation_date } }),
      /date/i,
    );
  for (const { service_code } of zofingenCategories)
    await service.prepare({ ...input, category: service_code });
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.contact_name, 'Private Fullname');
  assert.equal(preview.report.extra_fields.observation_date, '2026-01-02');
  assert.equal(preview.report.extra_fields.asset_street, 'ActualOfflineStreet 7');
  assert.equal(preview.report.email, 'private@example.invalid');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, {
    bfs_id: 4289,
    service_id: 'zofingen-infrastructure-defect-form',
  });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
