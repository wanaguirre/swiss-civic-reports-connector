import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  swlCategories,
  swlCategory,
  swlRequirements,
  verifySwlSources,
  swlLightingFormUrl,
} from '../dist/swl-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('SWL metadata is read-free, exact Staufen gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('swl-staufen', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), swlCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.38, longitude: 8.16 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4210;
  await assert.rejects(city.requirements({ latitude: 47.38, longitude: 8.16 }), /paused/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, swlLightingFormUrl);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(() => inspectMunicipalForm('swl-staufen', '<form/>'), /complete pinned/);
  assert.throws(
    () => new MunicipalFormClient('swl-staufen', request, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('SWL 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
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
      verifySwlSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('swl-staufen', request, {
      places: { municipality: async () => ({ bfs_id: 4210 }) },
    });
    city.cached = { value: swlCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.38, longitude: 8.16 }), /paused/);
    await assert.rejects(
      verifySwlSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('SWL telephone-only preparation preserves plate zeros/private contacts, rejects other native branches and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'swl-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'swl-staufen',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4210 }) } },
  );
  city.requirements = async () => swlRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.38,
    longitude: 8.16,
    location_confirmed: true,
    location_label: 'Offline actual Staufen lamp',
    category: swlCategory,
    description: 'Fictional offline lamp defect.',
    email: '',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      salutation: 'Divers',
      contact_preference: 'Telefon',
      privacy_acknowledgement: 'SWL privacy policy and protection discrepancy read and understood',
      lamp_street: 'OfflineLampRoad',
      nearest_house_number: '02a',
      lamp_number: '0007',
      public_lamp_confirmed: 'Actual public lamp in Staufen maintained by SWL confirmed',
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
    { category: 'Strom' },
    { category: 'Gas' },
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
      extra_fields: { ...input.extra_fields, reporter_street: 'unnecessary-private-address' },
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
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.lamp_number, '0007');
  assert.equal(preview.report.extra_fields.nearest_house_number, '02a');
  assert.equal(preview.report.email, '');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 4210, service_id: 'swl-staufen-defect-form' });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
