import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectEwsennwaldForm,
  ewsennwaldCategories,
  ewsennwaldRequirements,
  ewsennwaldVillages,
} from '../dist/ewsennwald-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/ewsennwald-form.html', import.meta.url), 'utf8');
test('EW Sennwald pins full selected form, signed-field prefixes, honeypot, validation and client references without provider execution', () => {
  assert.deepEqual(inspectEwsennwaldForm(html), ewsennwaldCategories);
  assert.deepEqual(
    inspectEwsennwaldForm(html.replaceAll('0'.repeat(40), 'a'.repeat(40))),
    ewsennwaldCategories,
  );
  for (const b of [
    html + html,
    html.replace('required="required"', ''),
    html.replace('YTowOnt9', 'YTowOnt8'),
    html.replace('0'.repeat(40), 'bad-signature'),
    html.replace('&quot;__hp&quot;:1', '&quot;photo&quot;:1'),
    html.replace('name="tx_powermail_pi1[field][__hp]"', 'name="unexpected"'),
    html.replace('Masttürchen fehlt', 'Other'),
    html.replace('data-validate="html5"', 'data-validate="new"'),
    html.replace('Form.min.js?1726669271', 'Changed.js'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html + '<script>altered()</script>',
    html + '<div class="g-recaptcha"></div>',
  ]) {
    assert.notEqual(b, html);
    assert.throws(() => inspectEwsennwaldForm(b), /changed/);
  }
  assert.throws(() => ewsennwaldVillages(3271), /Outside/);
});
for (const [key, bfs, other, villages, point] of [
  ['ewsennwald-sennwald', 3274, 3251, ['Sennwald', 'Salez'], { latitude: 47.26, longitude: 9.5 }],
  ['ewsennwald-altstaetten', 3251, 3274, ['Lienz', 'Plona'], { latitude: 47.29, longitude: 9.52 }],
])
  test(`${key}: exact BFS before GET and restricted village choice, separate contact address, optional date/mast/phone and no sending`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'civic-ews-offline-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const store = new Store(dir);
    await store.initialize();
    let actual = other;
    const calls = [];
    const city = new MunicipalFormClient(
      key,
      async (url, init) => {
        calls.push({ url: String(url), ...init });
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      },
      { places: { municipality: async () => ({ bfs_id: actual }) } },
    );
    await assert.rejects(city.requirements(point), /outside/);
    assert.equal(calls.length, 0);
    actual = bfs;
    const requirements = await city.requirements(point);
    assert.deepEqual(requirements, ewsennwaldRequirements(bfs));
    assert.deepEqual(
      requirements[ewsennwaldCategories[0].service_code].extra_fields.find(
        (f) => f.code === 'lighting_village',
      ).values,
      villages,
    );
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      ...point,
      location_confirmed: true,
      location_label: 'Offline public lamp',
      category: ewsennwaldCategories[0].service_code,
      description: 'Fictional municipal lamp fault; offline only.',
      email: 'resident@example.invalid',
      phone: '',
      photo_ids: [],
      extra_fields: {
        first_name: 'PrivateFirst',
        last_name: 'PrivateLast',
        contact_address: 'PrivateResidence12',
        contact_postcode_locality: 'PrivateTown',
        lighting_street: 'OfflineLampStreet',
        lighting_village: villages[0],
        public_lamp_confirmed: 'Municipal public lamp in selected EW Sennwald village confirmed',
      },
    };
    for (const code of [
      'first_name',
      'last_name',
      'contact_address',
      'contact_postcode_locality',
      'lighting_street',
      'lighting_village',
      'public_lamp_confirmed',
    ]) {
      const extra_fields = { ...input.extra_fields };
      delete extra_fields[code];
      await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
    }
    await assert.rejects(service.prepare({ ...input, email: '' }), /email/);
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: {
          ...input.extra_fields,
          lighting_village: other === 3251 ? 'Lienz' : 'Salez',
        },
      }),
      /lighting_village/,
    );
    const p = await service.prepare(input);
    assert.equal(p.municipality.bfs_id, bfs);
    assert.equal(p.report.phone, '');
    assert.equal(p.report.extra_fields.noticed_date, undefined);
    assert.equal(p.report.extra_fields.lamp_number, undefined);
    assert.equal(p.submission_enabled, false);
    const optional = await service.prepare({
      ...input,
      phone: '0810000000',
      extra_fields: {
        ...input.extra_fields,
        lighting_village: villages[1],
        noticed_date: '18.10.2026',
        lamp_number: '0007',
      },
    });
    assert.equal(optional.report.extra_fields.lamp_number, '0007');
    assert.equal(optional.report.extra_fields.noticed_date, '18.10.2026');
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
    await assert.rejects(city.report('offline'), /unverified/);
    assert.throws(
      () => new MunicipalFormClient(key, fetch, { experimentalSubmission: true }),
      /only implemented/,
    );
    assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
    assert.equal((await store.receipts()).length, 0);
  });
