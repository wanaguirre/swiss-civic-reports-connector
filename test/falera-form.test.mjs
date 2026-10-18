import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectFaleraForm,
  faleraCategories,
  faleraRequirements,
  faleraFormUrl,
} from '../dist/falera-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/falera-form.html', import.meta.url), 'utf8');
test('Falera pins all selected fields, ARIA, empty Akismet controls and 37 scripts; only shaped read-time state and matched slider IDs vary', () => {
  assert.deepEqual(inspectFaleraForm(html), faleraCategories);
  assert.deepEqual(
    inspectFaleraForm(
      html
        .replace('A'.repeat(55) + '=', 'B'.repeat(55) + '=')
        .replace('value="000"', 'value="123"')
        .replaceAll('layerslider_2_aaaaaaaaaaaa', 'layerslider_2_bbbbbbbbbbbbb'),
    ),
    faleraCategories,
  );
  for (const [i, broken] of [
    html + html,
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('Vorname, Name', 'Changed name'),
    html.replace('name="input_5"', 'name="changed"'),
    html.replace('A'.repeat(55) + '=', 'bad-state'),
    html.replace('value="000"', 'value="client-value"'),
    html.replace('name="ak_hp_textarea"', 'name="changed-trap"'),
    html.replace(
      'name="ak_hp_textarea" cols="45" rows="8" maxlength="100"></textarea>',
      'name="ak_hp_textarea" cols="45" rows="8" maxlength="100">filled</textarea>',
    ),
    html.replaceAll('</form>', '<input type="file" name="photo"></form>'),
    html + '<input form="gform_2" required name="new">',
    html + '<div class="g-recaptcha"></div>',
    html + '<script>newClient()</script>',
    html.replace('akismet-frontend.js', 'changed-client.js'),
    html.replace('getTime()', 'getMilliseconds()'),
    html.replace("'#layerslider_2_aaaaaaaaaaaa'", "'#layerslider_2_bbbbbbbbbbbb'"),
    html.replaceAll('</form>', '<template><input name="new"></template></form>'),
    html.replace('maxlength="100"', 'maxlength="101"'),
  ].entries()) {
    assert.notEqual(broken, html, `mutation ${i}`);
    assert.throws(() => inspectFaleraForm(broken), /changed/, `mutation ${i}`);
  }
});
test('Falera binds BFS before GET, keeps source contacts separate from issue/location, rejects photos and cannot send or track under switches', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-falera-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3575;
  const calls = [];
  const city = new MunicipalFormClient(
    'falera',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 46.801, longitude: 9.231 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3572;
  assert.deepEqual(await city.requirements(point), faleraRequirements());
  assert.equal(calls[0].url, faleraFormUrl);
  assert.equal(city.guidance.verified_on, '2026-10-18');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(point)),
    /state_2|ak_js|ak_hp_textarea|SecurityID/,
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline public path location',
    category: faleraCategories[0].service_code,
    description: 'Offline fictional municipal path defect for local testing only.',
    email: 'resident@example.invalid',
    photo_ids: [],
    extra_fields: {
      contact_name: 'Private Name',
      municipal_works_confirmed: 'Municipal works responsibility in Falera confirmed',
    },
  };
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/);
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { municipal_works_confirmed: input.extra_fields.municipal_works_confirmed },
    }),
    /contact_name/,
  );
  await assert.rejects(
    service.prepare({ ...input, extra_fields: { contact_name: 'Private Name' } }),
    /municipal_works_confirmed/,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, municipal_works_confirmed: 'Other municipality' },
    }),
    /municipal_works_confirmed/,
  );
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 3572);
  assert.equal(p.report.phone, undefined);
  assert.equal(p.report.extra_fields.contact_address, undefined);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const optional = await service.prepare({
    ...input,
    phone: '0810000000',
    extra_fields: {
      ...input.extra_fields,
      contact_address: 'Private address',
      contact_postal_locality: '0000 Private place',
    },
  });
  assert.equal(optional.report.extra_fields.contact_postal_locality, '0000 Private place');
  assert.equal(optional.report.location_label, input.location_label);
  await assert.rejects(
    service.prepare({ ...input, photo_ids: ['unsupported'] }),
    /photo|attachment/i,
  );
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('falera', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
