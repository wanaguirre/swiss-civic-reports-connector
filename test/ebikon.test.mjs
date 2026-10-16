import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('./fixtures/ebikon-form.html', import.meta.url), 'utf8');
const point = { latitude: 47.083, longitude: 8.34 };
test('Ebikon reads eight exact classes and fails closed on changed limits, choices, protections or first-step controls', () => {
  assert.equal(inspectMunicipalForm('ebikon', html).length, 8);
  for (const value of [
    html.replace('maxlength="400"', 'maxlength="200"'),
    html.replace('Signalisation', 'Unknown category'),
    html.replace('value="Weiter"', 'value="Senden"'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('aria-required=""', ''),
    html.replace('name="duplicate_of"', 'name="other"'),
  ])
    assert.throws(() => inspectMunicipalForm('ebikon', value));
});
test('Ebikon preparation respects class-specific fields, 400-character text, 150-character location and no sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-ebikon-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const city = new MunicipalFormClient(
    'ebikon',
    async (url, init) => {
      calls++;
      assert.equal(url, 'https://www.ebikon.ch/form/schaden-melden');
      assert.equal(init.method, 'GET');
      assert.equal(init.body, undefined);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 1054 }) } },
  );
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_label: 'Fictional public place Ebikon',
    location_confirmed: true,
    category: 'Signalisation',
    description: 'Ein fiktives Schild ist beschädigt.',
    email: 'fictional@example.org',
    photo_ids: [],
    extra_fields: { first_name: 'Fictional', last_name: 'Resident' },
  };
  const rules = await city.requirements(input);
  assert.deepEqual(rules.Signalisation.contact_fields, ['phone']);
  assert.equal(rules.Signalisation.description_max_length, 400);
  assert.equal(rules['Anderer Schaden'].extra_fields.at(-1).code, 'other_damage');
  assert.equal(rules.Signalisation.extra_fields.length, 2);
  assert.match(city.guidance.exclusions[1].next_step, /CKW/);
  const preview = await service.prepare(input);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.municipality.bfs_id, 1054);
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /verification/,
  );
  await assert.rejects(service.prepare({ ...input, description: 'x'.repeat(401) }), /400/);
  await assert.rejects(service.prepare({ ...input, location_label: 'x'.repeat(151) }), /150/);
  await assert.rejects(
    service.prepare({ ...input, extra_fields: { first_name: 'Fictional' } }),
    /last_name/,
  );
  assert.equal(calls, 1);
});
