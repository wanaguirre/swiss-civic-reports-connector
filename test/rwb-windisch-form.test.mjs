import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { rwbCategory, rwbPrivacyUrl } from '../dist/rwb-form.js';
import {
  rwbWindischSources,
  rwbWindischRequirements,
  verifyRwbWindischSources,
} from '../dist/rwb-windisch-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('RWB Windisch requires private house and consent, preserves actual lamp number and destination, and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rwb-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'rwb-windisch',
    async () => assert.fail('rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4123 }) } },
  );
  city.requirements = async () => rwbWindischRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.48,
    longitude: 8.315,
    location_confirmed: true,
    location_label: 'Offline actual Windisch lamp',
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
      contact_postcode: '5210',
      contact_locality: 'PrivateTown',
      salutation: 'Frau',
      lighting_street: 'ActualLampStreet',
      public_lamp_confirmed: 'Public lamp in Windisch maintained by RWB confirmed',
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
  assert.equal(p.municipality.bfs_id, 4123);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const f = await store.preview(p.preview_id);
  assert.equal(f.destination.service_id, 'rwb-windisch-defect-form');
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
test('Windisch exact location gate precedes source GETs; categories are inert and both 403/429 stop shared request contexts permanently', async () => {
  const point = { latitude: 47.48, longitude: 8.22 };
  for (const status of [403, 429]) {
    let now = 0,
      bfs = 4026;
    const calls = [];
    const request = async (url, init) => {
      calls.push({ url, init });
      return new Response('', { status, headers: { 'retry-after': '1' } });
    };
    const options = { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } };
    const city = new MunicipalFormClient('rwb-windisch', request, options);
    assert.equal((await city.categories())[0].service_code, rwbCategory);
    await assert.rejects(city.requirements(point), /outside/);
    assert.equal(calls.length, 0);
    bfs = 4123;
    await assert.rejects(city.requirements(point), /changed/);
    now = 10000000;
    await assert.rejects(city.requirements(point, { fresh: true }), /paused/);
    const second = new MunicipalFormClient('rwb-windisch', request, options);
    await assert.rejects(second.requirements(point), /paused/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, rwbWindischSources[0].url);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.credentials, 'omit');
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(calls[0].init.body, undefined);
    assert.equal(city.submissionMode, 'unverified');
    assert.equal(city.trackingSupported, false);
    await assert.rejects(city.submit({}), /verification/);
    assert.throws(() => inspectMunicipalForm('rwb-windisch', '<form></form>'), /complete pinned/);
  }
});
test('Windisch complete mandate and existing source pins are immutable; drift, wrong MIME and redirects fail closed without reading later pages', async () => {
  assert.equal(rwbWindischSources.length, 5);
  assert.ok(Object.isFrozen(rwbWindischSources) && rwbWindischSources.every(Object.isFrozen));
  for (const make of [
    () => new Response('changed mandate', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => {
      const r = new Response('changed', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
    () => new Response('x'.repeat(1000001), { headers: { 'content-type': 'text/html' } }),
  ]) {
    let calls = 0;
    await assert.rejects(
      verifyRwbWindischSources(
        async () => {
          calls++;
          return make();
        },
        () => {},
        () => 0,
        async () => {},
      ),
      /paused|changed/,
    );
    assert.equal(calls, 1);
  }
  const req = rwbWindischRequirements()[rwbCategory];
  assert.match(req.scope, /BFS4123/);
  assert.doesNotMatch(JSON.stringify(req), /Ennetbaden|BFS4026/);
  assert.equal(
    req.extra_fields.find((f) => f.code === 'public_lamp_confirmed').values[0],
    'Public lamp in Windisch maintained by RWB confirmed',
  );
});
