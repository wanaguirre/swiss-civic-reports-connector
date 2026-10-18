import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectErstfeldForm,
  erstfeldCategory,
  erstfeldFormUrl,
  erstfeldRequirements,
} from '../dist/erstfeld-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/erstfeld-lighting.html', import.meta.url), 'utf8');
const point = { latitude: 46.822, longitude: 8.65 };
const input = {
  ...point,
  location_confirmed: true,
  location_label: 'Offline issue location 2',
  category: erstfeldCategory,
  description: 'Nur ein fiktiver lokaler Test, nie übermittelt.',
  email: 'fictional@example.invalid',
  phone: '+41440000000',
  photo_ids: [],
  extra_fields: {
    first_name: 'Fictional',
    last_name: 'Resident',
    contact_street: 'Offline contact address 99',
    contact_postcode_locality: '0000 Contact town',
    lighting_location: 'Offline issue location 2',
    public_lamp_confirmed: 'Public streetlamp confirmed',
  },
};
test('Erstfeld pins selected Avia labels, required markers, validation and empty honeypot; unrelated protection is ignored', () => {
  assert.equal(inspectErstfeldForm(html).length, 1);
  assert.equal(
    inspectErstfeldForm('<form><div class="g-recaptcha"></div></form>' + html).length,
    1,
  );
  for (const bad of [
    html + html,
    html.replace('method="post"', 'method="get"'),
    html.replace(erstfeldFormUrl, 'https://example.invalid/'),
    html.replace('text_input is_empty', 'text_input'),
    html.replace('text_input is_email', 'text_input is_empty'),
    html.replace('Vorname', 'Different label'),
    html.replace('title="benötigt"', 'title="optional"'),
    html.replace('name="avia_8_1"', 'name="new_field"'),
    html.replace('</fieldset>', '<input name="photo" type="file"></fieldset>'),
    html.replace('</fieldset>', '<div class="g-recaptcha"></div></fieldset>'),
    html.replace('name="avia_1_1"', 'name="avia_1_1" maxlength="5"'),
    html.replace('name="avia_1_1"', 'name="avia_1_1" readonly'),
    'x'.repeat(1_000_001),
  ])
    assert.throws(() => inspectErstfeldForm(bad), /changed/);
});
test('Erstfeld rejects other municipalities before provider access and cannot enable experimental sending', async () => {
  let count = 0;
  const city = new MunicipalFormClient(
    'erstfeld',
    async () => {
      count++;
      throw Error('Unexpected read');
    },
    { places: { municipality: async () => ({ bfs_id: 1205 }) } },
  );
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(count, 0);
  assert.throws(
    () => new MunicipalFormClient('erstfeld', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Erstfeld requires separate reporter contact and actual issue location; photos are rejected and lamp number stays optional', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-erstfeld-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const city = new MunicipalFormClient(
    'erstfeld',
    async (url, init) => {
      calls.push([url, init.method]);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 1206 }) } },
  );
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const rules = (await city.requirements(point))[erstfeldCategory];
  assert.deepEqual(rules, erstfeldRequirements()[erstfeldCategory]);
  for (const field of ['first_name', 'last_name', 'contact_street', 'contact_postcode_locality'])
    assert.equal(rules.extra_fields.find((f) => f.code === field).contact, true);
  assert.equal(rules.extra_fields.find((f) => f.code === 'lighting_location').contact, undefined);
  for (const field of [
    'first_name',
    'last_name',
    'contact_street',
    'contact_postcode_locality',
    'lighting_location',
    'public_lamp_confirmed',
  ])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, [field]: '' } }),
      /requires|required/,
    );
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/i);
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/i);
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, public_lamp_confirmed: 'Private light' },
    }),
    /Invalid/,
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const preview = await service.prepare(input);
  assert.equal(preview.municipality.bfs_id, 1206);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.submission_mode, 'unverified');
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 1206, service_id: 'erstfeld-defect-form' });
  assert.equal(frozen.photos.length, 0);
  assert.equal(frozen.input.extra_fields.lamp_number, undefined);
  input.extra_fields.contact_street = 'Changed after preparation';
  assert.equal(
    (await store.preview(preview.preview_id)).input.extra_fields.contact_street,
    'Offline contact address 99',
  );
  input.extra_fields.contact_street = 'Offline contact address 99';
  await assert.rejects(city.submit(frozen), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.equal(city.guidance.verified_on, '2026-10-18');
  assert.equal(city.guidance.sources.length, 3);
  assert.deepEqual(calls, [[erstfeldFormUrl, 'GET']]);
});
test('Erstfeld fresh contract drift invalidates cached categories and enforces read cooldown', async () => {
  let body = html,
    count = 0;
  const city = new MunicipalFormClient(
    'erstfeld',
    async () => {
      count++;
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 1206 }) } },
  );
  await city.requirements(point);
  body = html.replace('Vorname', 'Different');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 2);
});
test('Erstfeld honors rate-limit cooldown without retrying or retaining a usable stale schema', async () => {
  let count = 0;
  const city = new MunicipalFormClient(
    'erstfeld',
    async () => {
      count++;
      return new Response('limited', {
        status: 429,
        headers: { 'retry-after': '600', 'content-type': 'text/html' },
      });
    },
    { places: { municipality: async () => ({ bfs_id: 1206 }) }, now: () => 1000 },
  );
  await assert.rejects(city.requirements(point), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 1);
});
