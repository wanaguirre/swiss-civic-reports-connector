import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectWintersingenForm,
  wintersingenCategories,
  wintersingenRequirements,
} from '../dist/wintersingen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/wintersingen-form.html', import.meta.url), 'utf8');
test('Wintersingen pins whole selected Drupal form, accepts only technical rotation and rejects contract/protection drift', () => {
  assert.deepEqual(inspectWintersingenForm(html), wintersingenCategories);
  assert.deepEqual(
    inspectWintersingenForm(
      html
        .replaceAll('form-OFFLINE_CONTRACT_FIXTURE_ONLY', 'form-ANOTHER_OFFLINE_BUILD_IDENTIFIER')
        .replace('form-offline-contract-fixture-only', 'form-another-offline-build-identifier')
        .replace(
          'OFFLINE_TIME_TOKEN_000000000000000000000000',
          'ROTATED_TIME_TOKEN_000000000000000000000000',
        ),
    ),
    wintersingenCategories,
  );
  for (const body of [
    html + html,
    html.replace('name="sm_LampeAdresse"', 'name="other"'),
    html.replace('required="required"', ''),
    html.replace('value="zerstoert"', 'value="private_damage"'),
    html.replace('Strasse / Haus-Nr. in Wintersingen', 'Private information'),
    html.replace(
      'action="/form/stoerungsmeldung-strassenbeleuch"',
      'action="https://elsewhere.invalid/submit"',
    ),
    html.replace('name="homepage"', 'name="filled_honeypot"'),
    html.replace('form-OFFLINE_CONTRACT_FIXTURE_ONLY', 'wrong-build'),
    html.replace('OFFLINE_TIME_TOKEN_000000000000000000000000', 'not-an-opaque-token'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('</form>', '<input type="hidden" name="unknown-contract"></form>'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectWintersingenForm(body), /changed/);
  }
  assert.deepEqual(
    inspectWintersingenForm('<form><input type="password" name="unrelated-login"></form>' + html),
    wintersingenCategories,
  );
});
test('Wintersingen requires separate private postal address, preserves optional lamp identity, checks BFS before GET and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-wintersingen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 2866;
  const calls = [];
  const city = new MunicipalFormClient(
    'wintersingen',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 47.49, longitude: 7.82 };
  const rules = await city.requirements(point);
  assert.deepEqual(rules, wintersingenRequirements());
  for (const req of Object.values(rules)) {
    assert.equal(req.max_photos, 0);
    assert.equal(req.email_required, true);
    assert.equal(req.phone_required, true);
    assert.deepEqual(
      req.extra_fields.filter((f) => f.contact).map((f) => f.code),
      ['first_name', 'last_name', 'contact_street_number', 'contact_postcode_locality'],
    );
  }
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Fictional offline public lamp',
    category: 'Lampe brennt nicht',
    description: 'Fictional lighting fault used only offline.',
    email: 'offline@example.invalid',
    phone: '0610000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'OfflineFirst',
      last_name: 'OfflineLast',
      contact_street_number: 'Private offline residence 7',
      contact_postcode_locality: '4451 Offline town',
      lighting_street_number: 'Different offline lamp street 20',
    },
  };
  for (const code of [
    'first_name',
    'last_name',
    'contact_street_number',
    'contact_postcode_locality',
    'lighting_street_number',
  ]) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/);
  await assert.rejects(service.prepare({ ...input, phone: undefined }), /phone/);
  for (const c of wintersingenCategories) {
    const p = await service.prepare({
      ...input,
      category: c.service_code,
      extra_fields: { ...input.extra_fields, lamp_number: '0007-A' },
    });
    assert.equal(p.report.extra_fields.lamp_number, '0007-A');
    assert.equal(p.report.extra_fields.contact_street_number, 'Private offline residence 7');
    assert.equal(p.report.extra_fields.lighting_street_number, 'Different offline lamp street 20');
    assert.equal(p.municipality.bfs_id, 2866);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  }
  const withoutNumber = await service.prepare(input);
  assert.ok(!withoutNumber.report.extra_fields.lamp_number);
  bfs = 2850;
  const before = calls.length;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, before);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('wintersingen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
