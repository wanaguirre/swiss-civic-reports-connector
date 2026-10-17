import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBoenigenForm } from '../dist/boenigen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const fields = [
  ['1', 'text'],
  ['3', 'text'],
  ['4', 'text'],
  ['5', 'text'],
  ['6', 'tel'],
  ['7', 'email'],
  ['8', 'textarea'],
  ['9', 'file'],
];
const hidden = {
  MAX_FILE_SIZE: '67108864',
  gform_submission_method: 'postback',
  gform_theme: 'gravity-theme',
  gform_style_settings: '',
  is_submit_31: '1',
  gform_submit: '31',
  gform_currency: 'CHF',
  gform_unique_id: '',
  state_31: 'FICTIONAL',
  gform_target_page_number_31: '0',
  gform_source_page_number_31: '1',
  gform_field_values: '',
};
const html = () =>
  `<form id="gform_31" data-formid="31" method="post" enctype="multipart/form-data" action="/services/schaden-melden/">${fields.map(([id, type]) => (type === 'textarea' ? `<textarea name="input_${id}" aria-required="true"></textarea>` : `<input name="input_${id}" type="${type}" ${type === 'file' ? '' : 'aria-required="true"'}>`)).join('')}${Object.entries(
    hidden,
  )
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
    .join('')}<button type="submit" id="gform_submit_button_31">Senden</button></form>`;
function fixture(bfs = 572) {
  const calls = [];
  const city = new MunicipalFormClient(
    'boenigen',
    async (url, init) => {
      calls.push({ url, method: init.method });
      return new Response(html(), { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  return { city, calls };
}
test('Bönigen fails closed on form drift, protection, attachment changes and duplicate fields', () => {
  assert.deepEqual(inspectBoenigenForm(html()), [
    { service_code: 'schaden-melden', service_name: 'Schaden melden' },
  ]);
  for (const bad of [
    html() + html(),
    html().replace('multipart/form-data', 'text/plain'),
    html().replace('/services/schaden-melden/', 'https://example.org/'),
    html().replace('67108864', '100'),
    html().replace('name="input_6"', 'name="password"'),
    html().replace('aria-required="true"', ''),
    html().replace('type="file"', 'type="file" multiple'),
    html().replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html().replace('</form>', '<input type="text" name="input_1"></form>'),
    'x'.repeat(1000001),
  ])
    assert.throws(() => inspectBoenigenForm(bad), /changed/);
  assert.equal(JSON.stringify(inspectBoenigenForm(html())).includes('FICTIONAL'), false);
});
test('Bönigen enforces exact municipal boundary before any form request', async () => {
  const { city, calls } = fixture(573);
  await assert.rejects(city.requirements({ latitude: 46.688, longitude: 7.895 }), /outside/);
  assert.equal(calls.length, 0);
});
test('Bönigen exposes contact scope and a conservative optional photo; cannot send or track', async () => {
  const { city, calls } = fixture();
  const req = (await city.requirements({ latitude: 46.688, longitude: 7.895 }))['Schaden melden'];
  assert.equal(city.bfsId, 572);
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(req.phone_required, true);
  assert.equal(req.max_photos, 1);
  assert.equal(req.max_photo_bytes, 5000000);
  assert.deepEqual(
    req.extra_fields.map((f) => [f.code, f.contact, f.required]),
    ['first_name', 'last_name', 'reporter_address', 'reporter_postcode_city'].map((code) => [
      code,
      true,
      true,
    ]),
  );
  await city.categories();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.equal(calls.length, 1);
  assert.throws(
    () => new MunicipalFormClient('boenigen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
