import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ewrCategories,
  ewrRequirements,
  ewrSources,
  ewrMunicipalities,
  paceEwrSourceReads,
  loadEwrCategories,
} from '../dist/ewr-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('EWR preserves three frozen municipalities, required private contacts and genuine pole identity, with no native-state or status fields', () => {
  assert.equal(ewrSources.length, 9);
  assert.ok(Object.isFrozen(ewrSources) && ewrSources.every(Object.isFrozen));
  assert.equal(ewrSources[3].type, 'pdf');
  assert.equal(ewrCategories[3].service_code, 'Masttürchen fehlt');
  for (const name of Object.keys(ewrMunicipalities)) {
    const r = ewrRequirements(name)[ewrCategories[0].service_code];
    assert.equal(r.email_required, true);
    assert.equal(r.phone_required, true);
    assert.equal(r.name_required, true);
    assert.equal(r.max_photos, 0);
    assert.deepEqual(r.contact_fields, ['name', 'phone']);
    assert.equal(r.extra_fields.find((f) => f.code === 'lamp_number').required, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'lighting_street').required, true);
    assert.ok(
      !r.extra_fields.some((f) => /token|captcha|status|quantity|form_fields|nonce/.test(f.code)),
    );
    assert.throws(() => inspectMunicipalForm(name, '<form/>'), /complete pinned/);
  }
});
test('EWR metadata is read-free and exact municipality gate precedes all reads; experimental native sends stay rejected', async () => {
  for (const [name, { bfsId }] of Object.entries(ewrMunicipalities)) {
    let bfs = 261,
      calls = 0;
    const request = async () => {
      calls++;
      return new Response('drift', { headers: { 'content-type': 'text/html' } });
    };
    const city = new MunicipalFormClient(name, request, {
      places: { municipality: async () => ({ bfs_id: bfs }) },
    });
    assert.deepEqual(await city.categories(), ewrCategories);
    for (const wrong of [4411, 4401, bfsId === 4436 ? 4441 : 4436]) {
      bfs = wrong;
      await assert.rejects(city.requirements({ latitude: 47.5, longitude: 9.2 }), /outside/);
    }
    assert.equal(calls, 0);
    bfs = bfsId;
    await assert.rejects(city.requirements({ latitude: 47.5, longitude: 9.2 }), /paused/);
    assert.equal(calls, 1);
    assert.equal(city.submissionMode, 'unverified');
    assert.equal(city.fallbackPrefilled, false);
    assert.equal(city.trackingSupported, false);
    assert.throws(
      () => new MunicipalFormClient(name, request, { experimentalSubmission: true }),
      /only implemented/,
    );
    await assert.rejects(city.submit({}), /verification/);
  }
});
test('EWR shares ten-second pacing and dispatch-time timeout; failures invalidate cached peers permanently without retries', async () => {
  let now = 0;
  const calls = [];
  const aborted = new AbortController();
  aborted.abort();
  const request = async (u, i) => {
    assert.equal(i.signal.aborted, false);
    calls.push(now);
    return new Response('local');
  };
  const sleep = async (ms) => {
    now += ms;
  };
  const a = paceEwrSourceReads(request, () => now, sleep),
    b = paceEwrSourceReads(request, () => now, sleep);
  await Promise.all([
    a('https://ewr.ch/one', { signal: aborted.signal }),
    b('https://ewr.ch/two'),
    a('https://ewr.ch/three'),
  ]);
  assert.deepEqual(calls, [0, 10000, 20000]);
  for (const status of [403, 429, 500, 200]) {
    let count = 0;
    const raw = async () => {
      count++;
      return new Response('changed', {
        status,
        headers: {
          'content-type': status === 200 ? 'application/json' : 'text/html',
          'retry-after': '600',
        },
      });
    };
    await assert.rejects(
      loadEwrCategories(raw, () => {}),
      /paused/,
    );
    for (const name of Object.keys(ewrMunicipalities)) {
      const city = new MunicipalFormClient(name, raw, {
        places: { municipality: async () => ({ bfs_id: ewrMunicipalities[name].bfsId }) },
      });
      city.cached = { value: ewrCategories, expires: Date.now() + 60000 };
      await assert.rejects(city.requirements({ latitude: 47.5, longitude: 9.2 }), /paused/);
    }
    await assert.rejects(
      loadEwrCategories(raw, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});
test('EWR local preparation requires private contacts and real pole identity, separates leading-zero pole from reporter name, rejects photos and freezes each target without sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'ewr-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  for (const [name, c] of Object.entries(ewrMunicipalities)) {
    const city = new MunicipalFormClient(
      name,
      async () => assert.fail('offline metadata fixture must not fetch'),
      { places: { municipality: async () => ({ bfs_id: c.bfsId }) } },
    );
    city.requirements = async () => ewrRequirements(name);
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      latitude: 47.5,
      longitude: 9.2,
      location_confirmed: true,
      location_label: 'Offline actual lamp point',
      category: ewrCategories[0].service_code,
      description: 'Fictional offline lamp fault.',
      name: 'Private Fullname',
      phone: '0710000000',
      email: 'private@example.invalid',
      photo_ids: [],
      extra_fields: {
        lighting_street: 'Offline actual lamp street 7',
        lamp_number: '00042',
        public_lamp_confirmed: `One EWR public lamp in ${c.municipality} confirmed`,
        privacy_acknowledgement: 'EWR storage and processing consent confirmed',
      },
    };
    for (const code of [
      'lamp_number',
      'lighting_street',
      'public_lamp_confirmed',
      'privacy_acknowledgement',
    ]) {
      const extra_fields = { ...input.extra_fields };
      delete extra_fields[code];
      await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
    }
    const first = await service.prepare(input);
    assert.equal(first.report.extra_fields.lamp_number, '00042');
    assert.equal(first.report.email, 'private@example.invalid');
    for (const field of ['name', 'phone', 'email'])
      await assert.rejects(service.prepare({ ...input, [field]: '' }));
    const p = await service.prepare({
      ...input,
      name: 'Private Fullname',
      email: 'private@example.invalid',
      phone: '0710000000',
      extra_fields: { ...input.extra_fields, lighting_house_number: '7' },
    });
    assert.equal(p.report.name, 'Private Fullname');
    assert.equal(p.report.extra_fields.lamp_number, '00042');
    const frozen = await store.preview(p.preview_id);
    assert.deepEqual(frozen.destination, { bfs_id: c.bfsId, service_id: `${name}-defect-form` });
    assert.equal(p.submission_enabled, false);
    await assert.rejects(
      service.submit(p.preview_id, p.confirmation_token, true),
      /disabled|verification/i,
    );
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, lighting_house_number: 'x'.repeat(401) },
      }),
    );
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(401) },
      }),
    );
    for (const category of ['Stromausfall', 'Kandelaber angefahren', 'Kandelaber umgefahren'])
      await assert.rejects(service.prepare({ ...input, category }));
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
          .jpeg()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(service.prepare({ ...input, photo_ids: [photo.photo_id] }), /photo/);
  }
});
