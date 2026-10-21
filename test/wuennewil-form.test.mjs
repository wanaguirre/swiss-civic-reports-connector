import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectWuennewilForm,
  wuennewilFormUrl,
  wuennewilCategories,
  wuennewilRequirements,
} from '../dist/wuennewil-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/wuennewil-lighting.html', import.meta.url), 'utf8');
const point = { latitude: 46.884, longitude: 7.319 };
const input = {
  ...point,
  location_confirmed: true,
  location_label: 'Offline affected street 2',
  category: wuennewilCategories[0],
  description: 'Fiktiver lokaler Test; nie versendet.',
  email: '',
  phone: '+41440000000',
  photo_ids: [],
  extra_fields: {
    salutation: 'Frau',
    first_name: 'Fictional',
    last_name: 'Resident',
    contact_street: 'Offline contact street 99',
    contact_locality: 'Contact town',
    contact_postcode: '0000',
    lighting_location: 'Offline issue street 2',
    lighting_locality: 'Issue town',
    public_lamp_confirmed: 'Municipal public streetlamp confirmed',
  },
};
test('Wünnewil pins all four steps, required contact/location markers, damage choices and conditional configuration', () => {
  assert.deepEqual(
    inspectWuennewilForm(html).map((c) => c.service_code),
    [...wuennewilCategories],
  );
  assert.equal(
    inspectWuennewilForm('<form><div class="g-recaptcha"></div></form>' + html).length,
    4,
  );
  for (const bad of [
    html + html,
    html.replace('method="post"', 'method="get"'),
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('Vorname', 'Other label'),
    html.replace('name="input_8"', 'name="new_phone"'),
    html.replace('name="input_13"', 'name="input_13" required'),
    html.replace('name="input_12.2"', 'name="input_12.2" maxlength="5"'),
    html
      .replace('redacted-dynamic-state', 'changed-state')
      .replace('name="state_30"', 'name="lost_state"'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('"value":"Anderer Defekt"', '"value":"Leuchte zerstört"'),
    html.replace('dependents: { 15: [15] }', 'dependents: { 15: [14] }'),
    html.replace('conditional_logic.js?ver=3.1.3', 'conditional_logic.js?ver=999'),
    'x'.repeat(1_000_001),
  ])
    assert.throws(() => inspectWuennewilForm(bad), /changed/);
});
test('Wünnewil never retains or pins the dynamic signed state value', () => {
  assert.equal(
    inspectWuennewilForm(html.replace('redacted-dynamic-state', 'a-different-opaque-state')).length,
    4,
  );
  assert.ok(!JSON.stringify(inspectWuennewilForm(html)).includes('redacted-dynamic-state'));
});
test('Wünnewil checks exact BFS before provider access and rejects experimental sending', async () => {
  let calls = 0;
  const city = new MunicipalFormClient(
    'wuennewil-flamatt',
    async () => {
      calls++;
      throw Error('unexpected');
    },
    { places: { municipality: async () => ({ bfs_id: 2308 }) } },
  );
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls, 0);
  assert.throws(
    () => new MunicipalFormClient('wuennewil-flamatt', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Wünnewil separates reporter address from affected lamp, keeps email/number optional, excludes photos and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-wuennewil-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const city = new MunicipalFormClient(
    'wuennewil-flamatt',
    async (url, init) => {
      calls.push([url, init.method]);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 2309 }) } },
  );
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const rules = await city.requirements(point);
  assert.deepEqual(rules, wuennewilRequirements());
  for (const f of [
    'salutation',
    'first_name',
    'last_name',
    'contact_street',
    'contact_locality',
    'contact_postcode',
  ])
    assert.equal(rules[input.category].extra_fields.find((x) => x.code === f).contact, true);
  for (const f of Object.keys(input.extra_fields))
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, [f]: '' } }),
      /requires|required/,
    );
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/i);
  await assert.rejects(
    service.prepare({ ...input, extra_fields: { ...input.extra_fields, salutation: 'Divers' } }),
    /Invalid/,
  );
  await assert.rejects(service.prepare({ ...input, category: 'Private lamp' }), /category/i);
  await assert.rejects(
    service.prepare({ ...input, category: 'Anderer Defekt' }),
    /requires|required/,
  );
  const other = await service.prepare({
    ...input,
    category: 'Anderer Defekt',
    extra_fields: { ...input.extra_fields, other_defect: 'Anderer fiktiver Defekt' },
  });
  assert.equal(other.report.extra_fields.other_defect, 'Anderer fiktiver Defekt');
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
    .jpeg()
    .toBuffer();
  const photo = await service.inspectPhoto({ base64: image.toString('base64') });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const preview = await service.prepare(input);
  assert.equal(preview.municipality.bfs_id, 2309);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.submission_mode, 'unverified');
  assert.equal(preview.report.email, '');
  assert.equal(preview.report.extra_fields.lamp_number, undefined);
  assert.equal(preview.attachments.length, 0);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, {
    bfs_id: 2309,
    service_id: 'wuennewil-flamatt-defect-form',
  });
  const mutated = { ...input.extra_fields };
  input.extra_fields.contact_street = 'Changed after preparation';
  assert.equal(
    (await store.preview(preview.preview_id)).input.extra_fields.contact_street,
    mutated.contact_street,
  );
  input.extra_fields.contact_street = mutated.contact_street;
  await assert.rejects(city.submit(frozen), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.deepEqual(calls, [[wuennewilFormUrl, 'GET']]);
});
test('Wünnewil fresh source drift clears cached preparation and applies read cooldown', async () => {
  let body = html,
    count = 0;
  const city = new MunicipalFormClient(
    'wuennewil-flamatt',
    async () => {
      count++;
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 2309 }) } },
  );
  await city.requirements(point);
  body = html.replace('Vorname', 'Changed');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 2);
});
test('Wünnewil rate limiting never retries or serves a stale schema', async () => {
  let count = 0;
  const city = new MunicipalFormClient(
    'wuennewil-flamatt',
    async () => {
      count++;
      return new Response('limited', {
        status: 429,
        headers: { 'retry-after': '600', 'content-type': 'text/html' },
      });
    },
    { places: { municipality: async () => ({ bfs_id: 2309 }) }, now: () => 1000 },
  );
  await assert.rejects(city.requirements(point), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 1);
});
