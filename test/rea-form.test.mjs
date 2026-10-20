import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  reaCategories,
  reaRequirements,
  reaSources,
  reaMunicipalities,
  paceReaSourceReads,
  loadReaCategories,
} from '../dist/rea-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';

test('REA preserves two frozen localities, optional contacts, distinct lamp identity and private postcode, with no native-state or status fields', () => {
  assert.equal(reaSources.length, 11);
  assert.ok(Object.isFrozen(reaSources) && reaSources.every(Object.isFrozen));
  assert.equal(reaSources[1].type, 'pdf');
  assert.equal(reaCategories[3].service_code, 'Masstürchen fehlt');
  for (const name of Object.keys(reaMunicipalities)) {
    const r = reaRequirements(name)[reaCategories[0].service_code];
    assert.equal(r.email_required, false);
    assert.equal(r.phone_required, false);
    assert.equal(r.name_required, false);
    assert.equal(r.max_photos, 0);
    assert.deepEqual(r.contact_fields, ['name', 'phone']);
    assert.equal(r.extra_fields.find((f) => f.code === 'contact_postcode').contact, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'lamp_number').required, false);
    assert.equal(r.extra_fields.find((f) => f.code === 'lighting_location').required, true);
    assert.ok(
      !r.extra_fields.some((f) => /token|captcha|status|quantity|form_fields|nonce/.test(f.code)),
    );
    assert.throws(() => inspectMunicipalForm(name, '<form/>'), /complete pinned/);
  }
});
test('REA metadata is read-free and exact municipality gate precedes all reads; experimental native sends stay rejected', async () => {
  for (const [name, { bfsId }] of Object.entries(reaMunicipalities)) {
    let bfs = 261,
      calls = 0;
    const request = async () => {
      calls++;
      return new Response('drift', { headers: { 'content-type': 'text/html' } });
    };
    const city = new MunicipalFormClient(name, request, {
      places: { municipality: async () => ({ bfs_id: bfs }) },
    });
    assert.deepEqual(await city.categories(), reaCategories);
    for (const wrong of [4411, 4401, bfsId === 4416 ? 4461 : 4416]) {
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
test('REA shares ten-second pacing and dispatch-time timeout; failures invalidate cached peers permanently without retries', async () => {
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
  const a = paceReaSourceReads(request, () => now, sleep),
    b = paceReaSourceReads(request, () => now, sleep);
  await Promise.all([
    a('https://rea.swiss/one', { signal: aborted.signal }),
    b('https://rea.swiss/two'),
    a('https://rea.swiss/three'),
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
      loadReaCategories(raw, () => {}),
      /paused/,
    );
    for (const name of Object.keys(reaMunicipalities)) {
      const city = new MunicipalFormClient(name, raw, {
        places: { municipality: async () => ({ bfs_id: reaMunicipalities[name].bfsId }) },
      });
      city.cached = { value: reaCategories, expires: Date.now() + 60000 };
      await assert.rejects(city.requirements({ latitude: 47.5, longitude: 9.2 }), /paused/);
    }
    await assert.rejects(
      loadReaCategories(raw, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});
test('REA local preparation permits empty optional contacts, separates leading-zero pole identity from reporter name, rejects photos and freezes each target without sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rea-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  for (const [name, c] of Object.entries(reaMunicipalities)) {
    const city = new MunicipalFormClient(
      name,
      async () => assert.fail('offline metadata fixture must not fetch'),
      { places: { municipality: async () => ({ bfs_id: c.bfsId }) } },
    );
    city.requirements = async () => reaRequirements(name);
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      latitude: 47.5,
      longitude: 9.2,
      location_confirmed: true,
      location_label: 'Offline actual lamp point',
      category: reaCategories[0].service_code,
      description: 'Fictional offline lamp fault.',
      name: '',
      phone: '',
      email: '',
      photo_ids: [],
      extra_fields: {
        lighting_location: 'Offline actual lamp street 7',
        lamp_number: '00042',
        public_lamp_confirmed: `One REA public lamp in locality ${c.locality} confirmed`,
        privacy_acknowledgement: 'REA privacy policy read and understood',
      },
    };
    for (const code of ['lighting_location', 'public_lamp_confirmed', 'privacy_acknowledgement']) {
      const extra_fields = { ...input.extra_fields };
      delete extra_fields[code];
      await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
    }
    const first = await service.prepare(input);
    assert.equal(first.report.extra_fields.lamp_number, '00042');
    assert.equal(first.report.email, '');
    const p = await service.prepare({
      ...input,
      name: 'Private Fullname',
      email: 'private@example.invalid',
      phone: '0710000000',
      extra_fields: { ...input.extra_fields, contact_postcode: '8580' },
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
        extra_fields: { ...input.extra_fields, contact_postcode: 'x'.repeat(21) },
      }),
    );
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, lighting_location: 'x'.repeat(251) },
      }),
    );
    await assert.rejects(service.prepare({ ...input, category: 'Stromausfall' }));
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
