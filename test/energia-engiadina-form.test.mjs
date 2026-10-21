import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  inspectEnergiaEngiadinaForm,
  energiaEngiadinaCategories,
  energiaEngiadinaRequirements,
  energiaEngiadinaFormUrl,
} from '../dist/energia-engiadina-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(
  new URL('fixtures/energia-engiadina-form.html', import.meta.url),
  'utf8',
);
const formId = 'webform-submission-defekte-strassenbeleuchtung-node-47-add-form';
const settings = (change) =>
  html.replace(
    /(<script[^>]*data-drupal-selector="drupal-settings-json"[^>]*>)(.*?)(<\/script>)/s,
    (_, start, body, end) => {
      const c = JSON.parse(body);
      change(c);
      return start + JSON.stringify(c) + end;
    },
  );
test('Energia Engiadina pins the complete form and all clients without executing Antibot; only shaped technical values are discarded', () => {
  assert.deepEqual(inspectEnergiaEngiadinaForm(html), energiaEngiadinaCategories);
  const rotated = settings((c) => {
    c.csp.nonce = 'A'.repeat(22);
    c.antibot.forms[formId].key = 'B'.repeat(43);
    c.ajaxTrustedUrl = { ['form_action_' + 'C'.repeat(43)]: true };
  })
    .replaceAll('OFFLINE_BUILD_ID_'.repeat(3).slice(0, 43), 'D'.repeat(43))
    .replaceAll(
      'OFFLINE_BUILD_ID_'.repeat(3).slice(0, 43).toLowerCase().replaceAll('_', '-'),
      'd'.repeat(43),
    );
  assert.deepEqual(inspectEnergiaEngiadinaForm(rotated), energiaEngiadinaCategories);
  const mutations = [
    html + html,
    html.replace('required="required"', ''),
    html.replace('name="wo_gemeinde"', 'name="destination"'),
    html.replace('maxlength="255"', 'maxlength="1"'),
    html.replace('value="Leuchte aus"', 'value="private"'),
    html.replace('action="/antibot"', 'action="/submit"'),
    html.replace('data-action="/de/defekte-strassenlaterne"', 'data-action="/elsewhere"'),
    html.replace('name="antibot_key" value=""', 'name="antibot_key" value="not-empty"'),
    html.replace('name="form_build_id"', 'name="build"'),
    html.replace(/data-drupal-selector="form-[^"]+"/, 'data-drupal-selector="bad-selector"'),
    html.replace('js-form-required form-required', 'optional'),
    html.replace('form-checkbox form-check-input', 'form-checkbox required form-check-input'),
    html.replace('jquery.min.js?v=4.0.0', 'jquery.min.js?v=5.0.0'),
    html.replace('name="rueckfragen_mail"', 'name="required_mail"'),
    html.replace('</form>', '<input name="photo" type="file"></form>'),
    html.replace('</form>', '<template><input name="extra"></template></form>'),
    html.replace('</form>', '<iframe src="https://invalid.example"></iframe></form>'),
    html + `<input name="extra" form="${formId}">`,
    html + '<script>unlockAntibot()</script>',
    html + '<div class="g-recaptcha"></div>',
    settings((c) => (c.csp.nonce = 'short')),
    settings((c) => (c.antibot.forms[formId].key = 'short')),
    settings((c) => (c.antibot.forms[formId].id = 'another')),
    settings((c) => (c.antibot.forms.other = { id: 'other', key: 'X'.repeat(43) })),
    settings((c) => (c.ajaxTrustedUrl = { ['form_action_' + 'A'.repeat(43)]: false })),
    settings((c) => (c.ajaxPageState.theme = 'another')),
    settings((c) => (c.antibot.newProtection = true)),
    settings((c) => c.webform.xss.allowedTags.push('new-tag')),
  ];
  for (const [i, broken] of mutations.entries()) {
    assert.ok(broken !== html, `mutation${i} must change fixture`);
    assert.throws(() => inspectEnergiaEngiadinaForm(broken), /changed/, `mutation${i}`);
  }
  assert.deepEqual(
    inspectEnergiaEngiadinaForm('<form><input name="unrelated-search"></form>' + html),
    energiaEngiadinaCategories,
  );
});
test('Scuol requires exact BFS before GET, maintained public lamp and separate street; optional contacts remain private and no photos or sending are possible', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-ee-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3762;
  const calls = [];
  const city = new MunicipalFormClient(
    'ee-engiadina-scuol',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 46.797, longitude: 10.299 };
  bfs = 3746;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3762;
  assert.deepEqual(await city.requirements(point), energiaEngiadinaRequirements());
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline public lamp point',
    category: 'Leuchte aus',
    description: 'A fictional nonurgent lamp fault for offline verification.',
    email: '',
    photo_ids: [],
    extra_fields: {
      lighting_municipality: 'Scuol',
      lighting_street: 'Offline lamp street',
      public_lamp_confirmed: 'Public lamp in Scuol maintained by EE Energia Engiadina confirmed',
    },
  };
  for (const code of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, lighting_municipality: 'Zernez' },
    }),
    /lighting_municipality/,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(256) },
    }),
    /255/,
  );
  await assert.rejects(
    service.prepare({ ...input, name: 'unsupported combined name' }),
    /reporter name/,
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#556677' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  for (const c of energiaEngiadinaCategories) {
    const p = await service.prepare({ ...input, category: c.service_code });
    assert.equal(p.report.email, '');
    assert.equal(p.attachments.length, 0);
    assert.equal(p.municipality.bfs_id, 3762);
    assert.equal(p.submission_enabled, false);
    assert.equal(p.submission_mode, 'unverified');
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  }
  const p = await service.prepare({
    ...input,
    email: 'private@example.invalid',
    phone: '0810000000',
    extra_fields: {
      ...input.extra_fields,
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      contact_address: 'Private residence 7',
      contact_postcode: '7550',
      contact_locality: 'Private town',
      near_house_number: '002',
      lamp_number: '0007-A',
      nearby_landmark: 'Offline bridge',
    },
  });
  assert.equal(p.report.extra_fields.lamp_number, '0007-A');
  assert.equal(p.report.extra_fields.contact_address, 'Private residence 7');
  assert.equal(p.report.extra_fields.lighting_street, 'Offline lamp street');
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 3762);
  assert.equal(frozen.input.extra_fields.lamp_number, '0007-A');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(point)),
    /antibot_key|form_build_id|form_action_|nonce/,
  );
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('ee-engiadina-scuol', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(
    calls.every(
      (c) =>
        c.url === energiaEngiadinaFormUrl &&
        c.method === 'GET' &&
        c.redirect === 'error' &&
        !c.body,
    ),
  );
  assert.equal((await store.receipts()).length, 0);
});
test('Scuol fresh protection drift invalidates cached rules and cools down without an Antibot request', async () => {
  let body = html,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'ee-engiadina-scuol',
    async (url, init) => {
      calls.push([String(url), init.method]);
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: 3762 }) } },
  );
  const point = { latitude: 46.797, longitude: 10.299 };
  await city.requirements(point);
  body = html.replace('action="/antibot"', 'action="/new-protection"');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  assert.equal(calls.length, 2);
  body = html;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 2);
  now = 300001;
  assert.deepEqual(await city.requirements(point), energiaEngiadinaRequirements());
  assert.deepEqual(calls, Array(3).fill([energiaEngiadinaFormUrl, 'GET']));
});
