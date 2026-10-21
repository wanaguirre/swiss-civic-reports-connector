import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { ewwCategories, ewwRequirements } from '../dist/eww-form.js';
import { ewwFormUrl } from '../dist/eww-source.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('Wettingen metadata is GET-free and exact BFS gate precedes all source checks; no experimental write/tracking/completion', async () => {
  let bfs = 4044;
  const calls = [];
  const c = new MunicipalFormClient(
    'eww-wettingen',
    async (u, i) => {
      calls.push({ u, i });
      return new Response('changed official source', { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  assert.deepEqual(await c.categories(), ewwCategories);
  assert.equal(calls.length, 0);
  await assert.rejects(c.requirements({ latitude: 47.466, longitude: 8.326 }), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4045;
  await assert.rejects(c.requirements({ latitude: 47.466, longitude: 8.326 }), /changed/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].u, ewwFormUrl);
  assert.equal(calls[0].i.method, 'GET');
  await assert.rejects(c.requirements({ latitude: 47.466, longitude: 8.326 }), /paused/);
  assert.equal(calls.length, 1);
  assert.equal(c.termsUrl, undefined);
  assert.equal(c.submissionMode, 'unverified');
  assert.equal(c.trackingSupported, false);
  assert.equal(c.fallbackPrefilled, false);
  assert.throws(
    () => inspectMunicipalForm('eww-wettingen', '<form>own fixture</form>'),
    /complete checked/,
  );
  assert.throws(
    () => new MunicipalFormClient('eww-wettingen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(c.submit({}), /verification/);
  await assert.rejects(c.report('offline'), /unverified/);
  const r = ewwRequirements()[ewwCategories[0].service_code];
  assert.equal(r.phone_required, false);
  assert.equal(r.max_photos, 0);
  for (const code of ['reporter_street', 'contact_postcode', 'contact_locality']) {
    const f = r.extra_fields.find((f) => f.code === code);
    assert.equal(f.required, false);
    assert.equal(f.contact, true);
  }
  assert.ok(!r.extra_fields.some((f) => /company|consent|token|captcha/.test(f.code)));
});
test('Wettingen freezes BFS4045, keeps phone/postal optional and private, preserves real lamp zeros and rejects attachments/sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'eww-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, cfg] of Object.entries({
    'eww-wettingen': { bfsId: 4045, municipality: 'Wettingen' },
  })) {
    const store = new Store(join(dir, name));
    await store.initialize();
    const city = new MunicipalFormClient(
      name,
      async () => assert.fail('offline rule double must not fetch'),
      { places: { municipality: async () => ({ bfs_id: cfg.bfsId }) } },
    );
    city.requirements = async () => ewwRequirements();
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      latitude: cfg.bfsId === 4038 ? 47.487 : 47.505,
      longitude: cfg.bfsId === 4038 ? 8.327 : 8.255,
      location_confirmed: true,
      location_label: 'Offline actual lamp point',
      category: ewwCategories[1].service_code,
      description: 'Fictional offline lamp fault.',
      email: 'private@example.invalid',
      photo_ids: [],
      extra_fields: {
        first_name: 'PrivateFirst',
        last_name: 'PrivateSurname',
        salutation: 'Frau',
        lighting_street: 'Actual lamp address at confirmed point',
        public_lamp_confirmed: 'Public lamp in Wettingen maintained by Energie Wettingen confirmed',
      },
    };
    for (const code of Object.keys(input.extra_fields)) {
      const extra_fields = { ...input.extra_fields };
      delete extra_fields[code];
      await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
    }
    for (const change of [
      { email: '' },
      { name: 'Combined name' },
      { category: 'Water' },
      { phone: '1'.repeat(51) },
      { description: 'x'.repeat(4001) },
      { extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(251) } },
      { extra_fields: { ...input.extra_fields, contact_company: 'Invented private field' } },
      { extra_fields: { ...input.extra_fields, contact_postcode: '54-30' } },
      { extra_fields: { ...input.extra_fields, contact_postcode: '1'.repeat(21) } },
    ])
      await assert.rejects(service.prepare({ ...input, ...change }));
    const p = await service.prepare(input);
    assert.equal(p.report.category, 'Lampe flackert');
    assert.equal(p.report.phone, undefined);
    assert.equal(p.report.extra_fields.contact_postcode, undefined);
    assert.equal(p.report.extra_fields.lamp_number, undefined);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    const f = await store.preview(p.preview_id);
    assert.equal(f.destination.bfs_id, cfg.bfsId);
    assert.equal(f.destination.service_id, name + '-defect-form');
    const q = await service.prepare({
      ...input,
      extra_fields: {
        ...input.extra_fields,
        lamp_number: '0007-A',
        reporter_street: 'PrivateStreet',
        contact_postcode: '005430',
        contact_locality: 'PrivateTown',
      },
    });
    assert.equal(q.report.extra_fields.lamp_number, '0007-A');
    assert.equal(q.report.extra_fields.reporter_street, 'PrivateStreet');
    assert.equal(q.report.extra_fields.contact_postcode, '005430');
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
          .jpeg()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(
      service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
      /at most 0/,
    );
    await assert.rejects(service.submit(q.preview_id, q.confirmation_token, true), /verification/);
    assert.equal((await store.receipts()).length, 0);
  }
});
