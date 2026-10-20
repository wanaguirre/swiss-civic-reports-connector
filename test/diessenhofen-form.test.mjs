import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { inspectDiessenhofenForm } from '../dist/diessenhofen-form.js';
import {
  diessenhofenCategories,
  diessenhofenCategory,
  diessenhofenRequirements,
  verifyDiessenhofenSources,
  diessenhofenSources,
} from '../dist/diessenhofen-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('Municipal Diessenhofen metadata is read-free, exact Diessenhofen gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('diessenhofen-stadtmelder', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), diessenhofenCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.689, longitude: 8.751 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4545;
  await assert.rejects(city.requirements({ latitude: 47.689, longitude: 8.751 }), /paused/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /stadtmelder/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(
    () => inspectMunicipalForm('diessenhofen-stadtmelder', '<form/>'),
    /complete pinned/,
  );
  assert.throws(
    () =>
      new MunicipalFormClient('diessenhofen-stadtmelder', request, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Municipal Diessenhofen 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
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
      verifyDiessenhofenSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('diessenhofen-stadtmelder', request, {
      places: { municipality: async () => ({ bfs_id: 4545 }) },
    });
    city.cached = { value: diessenhofenCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.689, longitude: 8.751 }), /paused/);
    await assert.rejects(
      verifyDiessenhofenSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('Municipal Diessenhofen text preparation keeps optional contacts separate, rejects foreign fields and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'diessenhofen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'diessenhofen-stadtmelder',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4545 }) } },
  );
  city.requirements = async () => diessenhofenRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.689,
    longitude: 8.751,
    location_confirmed: true,
    location_label: 'Offline actual Diessenhofen lamp',
    category: diessenhofenCategory,
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
      privacy_acknowledgement: 'Diessenhofen privacy policy read and understood',
      public_asset_confirmed: 'Actual municipal road or public space in Diessenhofen confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    if (key === 'contact_house_number') continue;
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
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
  const optional = { ...input, phone: '', extra_fields: { ...input.extra_fields } };
  delete optional.extra_fields.contact_house_number;
  await service.prepare(optional);
  for (const contact_postcode of ['04324', '999', '100000'])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, contact_postcode } }),
      /postcode/i,
    );
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.first_name, 'Private');
  assert.equal(preview.report.email, 'private@example.invalid');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, {
    bfs_id: 4545,
    service_id: 'diessenhofen-stadtmelder-defect-form',
  });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});

test('Diessenhofen full captured form validates without client execution and rejects field, script, protection and attachment drift', async () => {
  const html = await readFile(new URL('./fixtures/diessenhofen.html', import.meta.url), 'utf8');
  assert.deepEqual(inspectDiessenhofenForm(html), diessenhofenCategories);
  for (const altered of [
    html.replace('name="lastname"', 'name="changed"'),
    html.replace('value="3"', 'value="4"'),
    html.replace('cffp_mm', 'cffp_new'),
    html.replace('name="comment"', 'type="file" name="photo"'),
    html.replace('form.min.js?ver=1.8.117_1', 'other.js'),
    html + '<script>alert(1)</script>',
    html + '<input form="foreign">',
    html + 'captcha',
  ])
    assert.throws(() => inspectDiessenhofenForm(altered), /paused/);
  assert.equal(diessenhofenRequirements()[diessenhofenCategory].phone_required, false);
  assert.equal(
    diessenhofenRequirements()[diessenhofenCategory].extra_fields.find(
      (f) => f.code === 'contact_house_number',
    ).required,
    false,
  );
});
