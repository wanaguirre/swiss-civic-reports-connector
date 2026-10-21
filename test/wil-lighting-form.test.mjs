import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectWilLightingForm,
  wilLightingCategories,
  wilLightingRequirements,
  wilLightingFormUrl,
} from '../dist/wil-lighting-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/wil-lighting-form.html', import.meta.url), 'utf8');
test('Wil pins selected form, required ARIA fields, empty decoy, upload registry prefixes and all client semantics; only shaped CSRF values vary', () => {
  assert.deepEqual(inspectWilLightingForm(html), wilLightingCategories);
  assert.deepEqual(
    inspectWilLightingForm(
      html
        .replaceAll('0'.repeat(64), 'a'.repeat(64))
        .replaceAll('0'.repeat(40), 'b'.repeat(40))
        .replaceAll('.AAAAAA.', '.BBBBBB.'),
    ),
    wilLightingCategories,
  );
  for (const [index, broken] of [
    html + html,
    html.replace('aria-required', ''),
    html.replace('Lampe brennt nicht', 'Changed'),
    html.replace('20000101000000##', 'bad##'),
    html.replace('0'.repeat(64) + '.AAAAAA.', 'bad.AAAAAA.'),
    html.replace(
      'https://www.stadtwil.ch/images/upload.json',
      'https://other.invalid/images/upload.json',
    ),
    html.replace('order_by=name&amp;csrf-token=', 'csrf-token='),
    html.replace('class="lazy-wolves"', 'class="changed-decoy"'),
    html.replace(
      'name="duplicate_of" placeholder="" type="text" value=""',
      'name="duplicate_of" placeholder="" type="text" value="filled"',
    ),
    html.replace('foundation6.bundle.js?9bd84983', 'foundation6.bundle.js?changed'),
    html.replaceAll('</form>', '<input type="file" name="photo"></form>'),
    html + '<input form="main-form" name="new-required" required>',
    html + '<script>newClient()</script>',
    html + '<div class="altcha"></div>',
    html.replaceAll('</form>', '<template><input name="new-field"></template></form>'),
  ].entries()) {
    assert.notEqual(broken, html);
    assert.throws(() => inspectWilLightingForm(broken), /changed/, `mutation ${index}`);
  }
});
test('Wil binds exact BFS before any GET; separate contacts and lamp fields, no invented number/description payload or sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-wil-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3426;
  const calls = [];
  const city = new MunicipalFormClient(
    'wil-lighting',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.4671, longitude: 9.04877 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3427;
  const requirements = await city.requirements(point);
  assert.deepEqual(requirements, wilLightingRequirements());
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(calls[0].url, wilLightingFormUrl);
  assert.equal(city.guidance.verified_on, '2026-10-18');
  assert.doesNotMatch(JSON.stringify(requirements), /csrf|duplicate_of|upload.json/);
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'OfflineLampPlace',
    category: wilLightingCategories[0].service_code,
    description: 'Fictional lamp fault for local offline review only.',
    email: 'resident@example.invalid',
    phone: '0710000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      lighting_street: 'OfflineLampStreet',
      lighting_locality: 'Wil',
      public_lamp_confirmed: 'Municipal public lamp in Wil SG confirmed',
    },
  };
  for (const field of [
    'first_name',
    'last_name',
    'lighting_street',
    'lighting_locality',
    'public_lamp_confirmed',
  ]) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[field];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(field));
  }
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/);
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/);
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 3427);
  assert.equal(p.report.extra_fields.lamp_number, undefined);
  assert.equal(p.report.extra_fields.lighting_house_number, undefined);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const numbered = await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, lamp_number: '0007', lighting_house_number: '12a' },
  });
  assert.equal(numbered.report.extra_fields.lamp_number, '0007');
  assert.equal(numbered.report.extra_fields.lighting_house_number, '12a');
  await assert.rejects(
    service.prepare({ ...input, photo_ids: ['unsupported-photo'] }),
    /photo|attachment/i,
  );
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('wil-lighting', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
