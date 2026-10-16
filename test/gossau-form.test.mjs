import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { inspectGossauForm, gossauRequirements } from '../dist/gossau-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
// Synthetic public configuration: no session data, real contacts or municipal writes.
const fields = [
  [72, 'betreff_1664481426515', 'textbox', 1],
  [73, 'beschreibung_1664481452816', 'textarea', 1],
  [66, 'strasse_nr_1664481497350', 'address', 1],
  [67, 'plz_ort_1664479171697', 'zip', 1],
  [74, 'html_1664481515179', 'html', 0],
  [449, 'anrede_1709277317814', 'listselect', 1],
  [63, 'name_1664479095999', 'lastname', 1],
  [64, 'firstname_1664479089798', 'firstname', 1],
  [68, 'telefon_1664479187397', 'phone', 1],
  [69, 'email_1664479206514', 'email', 1],
  [75, 'bild_hochladen_1664481566101', 'file_upload', 0],
  [239, 'bestaetigung_1680025635932', 'checkbox', 1],
  [240, 'html_1680025645928', 'html', 0],
  [71, 'submit_1664479234146', 'submit', 0],
].map(([id, key, type, required]) => ({ id, key, type, required }));
Object.assign(fields[5], { options: ['Frau', 'Herr', 'Divers'].map((value) => ({ value })) });
Object.assign(fields[8], {
  input_limit: 10,
  input_limit_type: 'characters',
  mask: 'custom',
  custom_mask: '9999999999',
});
Object.assign(fields[10], {
  upload_multi_count: 1,
  upload_types: '.jpg,.jpeg,.png,.gif',
  max_file_size: 0,
  min_file_size: 0,
  save_to_server: 1,
  media_library: 'false',
});
Object.assign(fields[11], { default_value: 'unchecked' });
Object.assign(fields[12], {
  default:
    '<a href="https://gossau-zh.ch/agb/">Terms</a><a href="https://gossau-zh.ch/Datenschutz/">Privacy</a>',
});
const config = () => ({
  fields: structuredClone(fields),
  settings: { title: 'Problem melden', logged_in: '', conditions: [] },
  front: {
    adminAjax: 'https://www.gossau-zh.ch/wp-admin/admin-ajax.php',
    nonce: 'FICTIONAL_TOKEN_NOT_RETAINED',
  },
});
function html(c = config()) {
  return `<script src="https://www.gossau-zh.ch/wp-content/plugins/ninja-forms/assets/js/min/front-end.js?ver=3.15.5"></script><script src="https://www.gossau-zh.ch/wp-content/plugins/ninja-forms-uploads/assets/js/front-end/controllers/fieldFile.js?ver=3.3.35"></script><script>form.id='7';form.settings=${JSON.stringify(c.settings)};form.fields=${JSON.stringify(c.fields)};var nfFrontEnd=${JSON.stringify(c.front)};</script>`;
}
const point = { latitude: 47.305, longitude: 8.758 };
function fixture(bfs = 115) {
  const calls = [];
  const city = new MunicipalFormClient(
    'gossau',
    async (url, init) => {
      calls.push({ url, ...init });
      return new Response(html(), { headers: { 'Content-Type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  return { city, calls };
}
test('Gossau reads only public scope and field metadata and rejects form drift', () => {
  assert.deepEqual(inspectGossauForm(html()), [
    { service_code: 'problem-melden', service_name: 'Problem melden' },
  ]);
  for (const change of [
    (c) => (c.settings.logged_in = '1'),
    (c) => c.settings.conditions.push({}),
    (c) => c.fields.push({ type: 'recaptcha' }),
    (c) => (c.fields[0].required = 0),
    (c) => (c.fields[0].input_limit = 20),
    (c) => (c.fields[8].custom_mask = '999'),
    (c) => (c.fields[10].upload_multi_count = 2),
    (c) => (c.fields[11].default_value = 'checked'),
    (c) => (c.fields[12].default = '<a href="https://example.org">Terms</a>'),
    (c) => c.fields[5].options.push({ value: 'Other' }),
    (c) => (c.front.adminAjax = 'https://example.org/collect'),
    (c) => c.fields.reverse(),
  ]) {
    const c = config();
    change(c);
    assert.throws(() => inspectGossauForm(html(c)), /changed/);
  }
  for (const changed of [
    html() + html(),
    html().replace('ver=3.15.5', 'ver=3.16.0'),
    html().replace('form.settings=', 'form.settings=evil();'),
    html().replace("form.id='7'", "form.id='8'"),
    'x'.repeat(1000001),
  ])
    assert.throws(() => inspectGossauForm(changed), /changed/);
  assert.doesNotMatch(
    JSON.stringify(inspectGossauForm(html())) + JSON.stringify(gossauRequirements()),
    /FICTIONAL_TOKEN/,
  );
  const rules = gossauRequirements();
  rules['Problem melden'].extra_fields[2].values.push('Tampered');
  assert.equal(gossauRequirements()['Problem melden'].extra_fields[2].values.length, 3);
});
test('Gossau preparation binds correct municipality, private fields, one photo and terms; sending stays impossible', async (t) => {
  const { city, calls } = fixture(),
    dir = await mkdtemp(join(tmpdir(), 'civic-gossau-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Fictional issue address',
    category: 'Problem melden',
    description: 'Fictional defect for local testing only.',
    email: 'fictional@example.org',
    phone: '0790000000',
    photo_ids: [],
    extra_fields: {
      report_title: 'Fictional title',
      issue_postcode_city: '8625 Test',
      salutation: 'Divers',
      first_name: 'Fictional',
      last_name: 'Resident',
    },
  };
  for (const code of Object.keys(input.extra_fields)) {
    const extras = { ...input.extra_fields };
    delete extras[code];
    await assert.rejects(service.prepare({ ...input, extra_fields: extras }), new RegExp(code));
  }
  for (const phone of [
    '',
    '079 000 00 00',
    '+41790000000',
    '079000000',
    '07900000000',
    'abcdefghij',
  ])
    await assert.rejects(service.prepare({ ...input, phone }), /phone/i);
  await assert.rejects(
    service.prepare({ ...input, extra_fields: { ...input.extra_fields, salutation: 'Inferred' } }),
    /salutation/,
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#556677' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  const second = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#112233' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [photo.metadata.id, second.metadata.id] }),
    /at most 1/,
  );
  const p = await service.prepare({ ...input, photo_ids: [photo.metadata.id] });
  assert.equal(p.submission_enabled, false);
  assert.equal(p.submission_mode, 'unverified');
  assert.equal(p.municipality.bfs_id, 115);
  assert.equal(p.terms_url, 'https://www.gossau-zh.ch/problem-melden/');
  assert.equal(p.attachments.length, 1);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 115);
  assert.equal(frozen.input.extra_fields.salutation, 'Divers');
  assert.equal(frozen.photos[0].sha256, p.attachments[0].sha256);
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true, p.terms_url),
    /verification/,
  );
  await assert.rejects(city.submit(frozen), /verification/);
  assert.equal((await store.receipts()).length, 0);
  assert.equal(calls.length, 1);
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.throws(
    () =>
      new MunicipalFormClient(
        'gossau',
        async () => {
          throw Error('Unexpected network');
        },
        { experimentalSubmission: true },
      ),
    /only|unsupported|verified/i,
  );
  const wrong = fixture(3443);
  await assert.rejects(wrong.city.requirements(point), /outside/);
  assert.equal(wrong.calls.length, 0);
});
