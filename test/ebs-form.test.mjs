import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { inspectEbsForm, ebsCategory, ebsFormUrl, ebsRequirements } from '../dist/ebs-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/ebs-lighting.html', import.meta.url), 'utf8');
const point = { latitude: 47.02, longitude: 8.654 };
const input = {
  ...point,
  location_confirmed: true,
  location_label: 'Offline issue location 2',
  category: ebsCategory,
  description: 'Nur ein fiktiver lokaler Test, nie übermittelt.',
  email: 'fictional@example.invalid',
  phone: '+41440000000',
  photo_ids: [],
  extra_fields: {
    first_name: 'Fictional',
    last_name: 'Resident',
    lighting_street: 'Offline issue street',
    nearby_house_number: '2',
    additional_remarks: 'Additional fictional remarks',
    public_lamp_confirmed: 'Public streetlamp confirmed',
  },
};
test('ebs pins municipalities, validation, remarks and protection while allowing generated honeypot IDs', () => {
  assert.equal(inspectEbsForm(html).length, 1);
  assert.equal(inspectEbsForm('<form><div class="g-recaptcha"></div></form>' + html).length, 1);
  const ids = new Map(
    [...html.matchAll(/wpcf7-([a-f0-9]{13})-(?:field|wrapper)/g)].map((m) => [m[1], '']),
  );
  let index = 1;
  for (const key of ids.keys()) ids.set(key, String(index++).padStart(13, 'a'));
  assert.equal(
    inspectEbsForm(
      html.replace(
        /wpcf7-([a-f0-9]{13})-(field|wrapper)/g,
        (_, id, suffix) => `wpcf7-${ids.get(id)}-${suffix}`,
      ),
    ).length,
    1,
  );

  for (const bad of [
    html + html,
    html.replace('method="post"', 'method="get"'),
    html.replace(
      '/privatkunden/service/kundendienst/strassenlampen/#wpcf7-f1628-o1',
      'https://example.invalid/#wpcf7-f1628-o1',
    ),
    html.replace('value="Schwyz"', 'value="Elsewhere"'),
    html.replace('name="lampen-bemerkungen"', 'name="new-remarks"'),
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('maxlength="2000"', 'maxlength="2001"'),
    html.replace('Bemerkungen', 'Other purpose'),
    html.replace('name="street"', 'name="contact-address"'),
    html.replace(/for="wpcf7-[a-f0-9]{13}-field"/, 'for="missing-label"'),
    html.replace('name="art"', 'name="art" disabled'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    'x'.repeat(1_000_001),
  ])
    assert.throws(() => inspectEbsForm(bad), /changed/);
});
test('Ebs rejects other municipalities before provider access and cannot enable experimental sending', async () => {
  let count = 0;
  const city = new MunicipalFormClient(
    'schwyz',
    async () => {
      count++;
      throw Error('Unexpected read');
    },
    { places: { municipality: async () => ({ bfs_id: 1373 }) } },
  );
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(count, 0);
  assert.throws(
    () => new MunicipalFormClient('schwyz', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Ebs requires required contact, defect description and remarks with actual street and house number; photos are rejected and lamp number stays optional', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-ebs-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const city = new MunicipalFormClient(
    'schwyz',
    async (url, init) => {
      calls.push([url, init.method]);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 1372 }) } },
  );
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const rules = (await city.requirements(point))[ebsCategory];
  assert.deepEqual(rules, ebsRequirements('schwyz')[ebsCategory]);
  for (const field of ['first_name', 'last_name'])
    assert.equal(rules.extra_fields.find((f) => f.code === field).contact, true);
  assert.equal(rules.extra_fields.find((f) => f.code === 'lighting_street').contact, undefined);
  for (const field of [
    'first_name',
    'last_name',
    'lighting_street',
    'nearby_house_number',
    'additional_remarks',
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
  assert.equal(preview.municipality.bfs_id, 1372);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.submission_mode, 'unverified');
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 1372, service_id: 'schwyz-defect-form' });
  assert.equal(frozen.photos.length, 0);
  assert.equal(frozen.input.extra_fields.lamp_number, undefined);
  input.extra_fields.additional_remarks = 'Changed after preparation';
  assert.equal(
    (await store.preview(preview.preview_id)).input.extra_fields.additional_remarks,
    'Additional fictional remarks',
  );
  input.extra_fields.additional_remarks = 'Additional fictional remarks';
  await assert.rejects(
    service.prepare({ ...input, description: 'x'.repeat(2001) }),
    /2000|long|length/i,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, additional_remarks: 'x'.repeat(501) },
    }),
    /500|long|length/i,
  );
  await assert.rejects(city.submit(frozen), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.equal(city.guidance.verified_on, '2026-10-18');
  assert.equal(city.guidance.sources.length, 3);
  assert.deepEqual(calls, [[ebsFormUrl, 'GET']]);
});
test('Ebs fresh contract drift invalidates cached categories and enforces read cooldown', async () => {
  let body = html,
    count = 0;
  const city = new MunicipalFormClient(
    'schwyz',
    async () => {
      count++;
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 1372 }) } },
  );
  await city.requirements(point);
  body = html.replace('Bemerkungen', 'Different');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 2);
});
test('Ebs honors rate-limit cooldown without retrying or retaining a usable stale schema', async () => {
  let count = 0;
  const city = new MunicipalFormClient(
    'schwyz',
    async () => {
      count++;
      return new Response('limited', {
        status: 429,
        headers: { 'retry-after': '600', 'content-type': 'text/html' },
      });
    },
    { places: { municipality: async () => ({ bfs_id: 1372 }) }, now: () => 1000 },
  );
  await assert.rejects(city.requirements(point), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 1);
});
