import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectEwbuchsForm,
  ewbuchsCategories,
  ewbuchsRequirements,
} from '../dist/ewbuchs-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/ewbuchs-form.html', import.meta.url), 'utf8');
test('EWB Buchs pins full HTML, literal form JSON and reviewed immutable client references without executing source code', () => {
  assert.deepEqual(inspectEwbuchsForm(html), ewbuchsCategories);
  assert.deepEqual(inspectEwbuchsForm('<p>Unrelated navigation</p>' + html), ewbuchsCategories);
  for (const body of [
    html + html,
    html.replace('required=""', ''),
    html.replace('name="FORM_ID"', 'name="OTHER_ID"'),
    html.replace('Kanderlaber beschädigt', 'Other defect'),
    html.replace('3s3_8rue27jsd.js', 'new-client.js'),
    html.replace('86650', '86651'),
    html.replace('isConfirmationEmail', 'differentProperty'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html + '<div class="g-recaptcha"></div>',
    html + '<script>window.alteredValidation=true</script>',
    html.replace('self.__next_f.push', 'executeProviderCode'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectEwbuchsForm(body), /changed/);
  }
});
test('EWB Buchs binds exact BFS before GET, separates private reporter address from lamp location, retains optional fields and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-ewbuchs-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 4001;
  const calls = [];
  const city = new MunicipalFormClient(
    'ewbuchs',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.167, longitude: 9.477 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3271;
  const requirements = await city.requirements(point);
  assert.deepEqual(requirements, ewbuchsRequirements());
  const req = requirements[ewbuchsCategories[0].service_code];
  assert.equal(req.email_required, false);
  assert.equal(req.phone_required, true);
  assert.equal(req.max_photos, 0);
  assert.equal(req.extra_fields.find((f) => f.code === 'salutation').required, false);
  assert.equal(req.extra_fields.find((f) => f.code === 'lighting_house_number').required, false);
  assert.ok(
    req.extra_fields
      .filter((f) =>
        [
          'first_name',
          'last_name',
          'contact_address',
          'contact_postcode_locality',
          'salutation',
          'company',
        ].includes(f.code),
      )
      .every((f) => f.contact),
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline municipal lamp',
    category: ewbuchsCategories[0].service_code,
    description: 'Fictional public lamp damage, tested only offline.',
    email: '',
    phone: '0810000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      contact_address: 'PrivateResidence12',
      contact_postcode_locality: 'PrivateTown',
      lighting_street: 'OfflineLampStreet',
      public_lamp_confirmed: 'Municipal public lamp in Buchs SG confirmed',
    },
  };
  for (const code of [
    'first_name',
    'last_name',
    'contact_address',
    'contact_postcode_locality',
    'lighting_street',
    'public_lamp_confirmed',
  ]) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/);
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, public_lamp_confirmed: 'Private lamp' },
    }),
    /public_lamp_confirmed/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 3271);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.salutation, undefined);
  assert.equal(p.report.extra_fields.lighting_house_number, undefined);
  assert.equal(p.submission_enabled, false);
  const optional = await service.prepare({
    ...input,
    email: 'optional@example.invalid',
    extra_fields: {
      ...input.extra_fields,
      salutation: 'Divers',
      company: 'PrivateCompany',
      lighting_house_number: '0007',
    },
  });
  assert.equal(optional.report.email, 'optional@example.invalid');
  assert.equal(optional.report.extra_fields.lighting_house_number, '0007');
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('ewbuchs', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
