import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectMarthalenForm,
  marthalenCategories,
  marthalenTermsUrl,
} from '../dist/marthalen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const fields = [
  ['name', 'text', true],
  ['field_bb2dbe6', 'text', true],
  ['email', 'email', true],
  ['field_891898f', 'tel', false],
  ['field_e2ac3bf', 'text', false],
  ['field_a1f5b62', 'text', false],
  ['message', 'textarea', false],
  ['field_e037bf7', 'checkbox', true],
];
export function html() {
  return `<form class="elementor-form" method="post">${Object.entries({
    post_id: '2236',
    form_id: 'a1a202b',
    referer_title: 'Online Schalter',
    queried_id: '14',
  })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`)
    .join(
      '',
    )}${fields.map(([code, type, required]) => (type === 'textarea' ? `<textarea name="form_fields[${code}]"></textarea>` : `<input type="${type}" name="form_fields[${code}]" ${required ? 'required' : ''}>`)).join('')}<select name="form_fields[field_0819583]">${['bitte auswählen', ...marthalenCategories].map((value) => `<option value="${value}">${value}</option>`).join('')}</select><a href="${marthalenTermsUrl}">Datenschutz</a><button type="submit">Meldung senden</button></form>`;
}
test('Marthalen inspects only its exact lighting form, ignoring an unrelated protected popup', () => {
  const unrelated =
    '<form><input type="password" name="password"><div class="g-recaptcha"></div></form>';
  assert.deepEqual(
    inspectMarthalenForm(unrelated + html()),
    marthalenCategories.map((name) => ({ service_code: name, service_name: name })),
  );
  for (const bad of [
    html() + html(),
    html().replace('2236', '9999'),
    html().replace('a1a202b', 'other'),
    html().replace('method="post"', 'method="get"'),
    html().replace('method="post"', 'method="post" action="https://other.invalid/"'),
    html().replace('name="form_fields[name]" required', 'name="form_fields[name]"'),
    html().replace('</form>', '<input name="form_fields[new]" required></form>'),
    html().replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html().replace('type="checkbox"', 'type="checkbox" checked'),
    html().replace('type="tel"', 'type="file"'),
    html().replace('name="form_fields[message]"', 'name="form_fields[message]" maxlength="10"'),
    html().replace('Mechanischer Defekt', 'new category'),
    html().replace(marthalenTermsUrl, 'https://other.invalid/privacy'),
    html().replace('name="form_fields[email]"', 'name="form_fields[email]" readonly'),
  ])
    assert.throws(() => inspectMarthalenForm(bad), /changed/);
});
function fixture(bfs = 35) {
  const calls = [];
  const city = new MunicipalFormClient(
    'marthalen',
    async (url, init) => {
      calls.push({ url, method: init.method });
      return new Response(html(), { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  return { city, calls };
}
test('Marthalen enforces boundary before reads and cannot enable writes experimentally', async () => {
  const { city, calls } = fixture(34);
  await assert.rejects(city.requirements({ latitude: 47.629, longitude: 8.651 }), /outside/);
  assert.equal(calls.length, 0);
  assert.throws(
    () => new MunicipalFormClient('marthalen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Marthalen exposes text-only contact and location requirements, with no submission or tracking', async () => {
  const { city, calls } = fixture();
  const req = await city.requirements({ latitude: 47.629, longitude: 8.651 });
  assert.equal(city.bfsId, 35);
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.termsUrl, marthalenTermsUrl);
  for (const rule of Object.values(req)) {
    assert.equal(rule.max_photos, 0);
    assert.equal(rule.email_required, true);
    assert.equal(rule.phone_required, false);
    assert.deepEqual(
      rule.extra_fields.map((f) => [f.code, f.required]),
      [
        ['first_name', true],
        ['last_name', true],
        ['lamp_number', false],
      ],
    );
  }
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});
test('Marthalen form drift blocks requirements and does not use stale cached schema', async () => {
  let body = html(),
    count = 0;
  const city = new MunicipalFormClient(
    'marthalen',
    async () => {
      count++;
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 35 }) } },
  );
  await city.categories();
  body = html().replace('a1a202b', 'changed');
  await assert.rejects(
    city.requirements({ latitude: 47.629, longitude: 8.651 }, { fresh: true }),
    /changed/,
  );
  await assert.rejects(city.categories(), /changed/);
  assert.equal(count, 2);
});
