import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { inspectNetzulgForm, netzulgCategory, netzulgRequirements } from '../dist/netzulg-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';

const html = await readFile(new URL('fixtures/netzulg-form.html', import.meta.url), 'utf8');
const point = { latitude: 46.75, longitude: 7.68 };

test('NetZulg pins the entire five-area form and fails closed on routing or protection changes', () => {
  assert.deepEqual(inspectNetzulgForm(html), [
    { service_code: netzulgCategory, service_name: netzulgCategory },
  ]);
  for (const body of [
    html + html,
    html.replace('contactForm20', 'contactForm21'),
    html.replace('value=" Oberhofen"', 'value=" Heimberg"'),
    html.replace('value=" Oberhofen"', 'value="Oberhofen"'),
    html.replace('name="contactFormField_621"', 'name="otherEmail"'),
    html.replace('required="required"', ''),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('"csrf":false', '"csrf":true'),
    html.replace('"mode":"frontend"', '"mode":"backend"'),
    html.replace("'contrexx'", "'unrelated'"),
    html.replace('"language":"de"', '"language":"fr"'),
    html + '<div class="g-recaptcha"></div>',
    html + '<script src="https://www.google.com/recaptcha/api.js"></script>',
    html.replace(
      'action="/kundenservice/notfall/defekte-strassenbeleuchtung"',
      'action="https://example.invalid/"',
    ),
    'x'.repeat(1_000_001),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectNetzulgForm(body), /changed/);
  }
});

for (const [name, expectedBfs] of [
  ['oberhofen', 934],
  ['steffisburg', 939],
]) {
  test(`${name}: public lamp preparation is municipality-bound, text-only and cannot send`, async (t) => {
    let bfs = expectedBfs;
    const calls = [];
    const city = new MunicipalFormClient(
      name,
      async (url, init) => {
        calls.push([String(url), init.method]);
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      },
      { places: { municipality: async () => ({ bfs_id: bfs }) } },
    );
    const directory = await mkdtemp(join(tmpdir(), 'civic-netzulg-contract-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const store = new Store(directory);
    await store.initialize();
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    // The shared provider also lists Blumenstein. Its area is not this destination.
    bfs = 922;
    await assert.rejects(city.requirements(point), /outside/);
    assert.equal(calls.length, 0);
    bfs = expectedBfs;
    const requirements = await city.requirements(point);
    assert.deepEqual(requirements, netzulgRequirements(name));
    const rule = requirements[netzulgCategory];
    assert.equal(rule.max_photos, 0);
    assert.equal(rule.email_required, true);
    assert.equal(rule.phone_required, false);
    assert.equal(
      rule.extra_fields.find((field) => field.code === 'lamp_number').required,
      name === 'steffisburg',
    );
    assert.match(rule.scope, /periodic maintenance/);
    const input = {
      ...point,
      location_confirmed: true,
      location_label: 'Fictional local test location',
      category: netzulgCategory,
      description: 'Offline fixture only.',
      email: 'fictional@example.org',
      photo_ids: [],
      extra_fields: {
        salutation: 'keine Angabe',
        first_name: 'Fictional',
        last_name: 'Resident',
        lighting_location: 'Fictional local test location',
        public_lamp_confirmed: 'Public streetlamp confirmed',
        ...(name === 'steffisburg' ? { lamp_number: 'OFFLINE-LAMP-ONLY' } : {}),
      },
    };
    const missing = structuredClone(input);
    delete missing.extra_fields.public_lamp_confirmed;
    await assert.rejects(service.prepare(missing), /public_lamp_confirmed/);
    if (name === 'steffisburg') {
      const noLamp = structuredClone(input);
      delete noLamp.extra_fields.lamp_number;
      await assert.rejects(service.prepare(noLamp), /lamp_number/);
    }
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
          .png()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(
      service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
      /at most 0/,
    );
    const preview = await service.prepare(input);
    assert.equal(preview.municipality.bfs_id, expectedBfs);
    assert.equal(preview.submission_mode, 'unverified');
    assert.equal(preview.submission_enabled, false);
    const frozen = await store.preview(preview.preview_id);
    assert.equal(frozen.destination.bfs_id, expectedBfs);
    assert.equal(frozen.destination.service_id, `${name}-defect-form`);
    assert.equal(frozen.photos.length, 0);
    assert.match(city.reportingService, /NetZulg/);
    assert.equal(city.guidance.verified_on, '2026-10-18');
    assert.equal(city.guidance.sources.length, 2);
    await assert.rejects(city.submit(frozen), /verification/);
    assert.throws(
      () => new MunicipalFormClient(name, fetch, { experimentalSubmission: true }),
      /only implemented/,
    );
    assert.equal(city.trackingSupported, false);
    assert.equal(city.fallbackPrefilled, false);
    assert.ok(calls.length > 0);
    assert.ok(
      calls.every(
        ([url, method]) =>
          url === 'https://www.netzulg.ch/kundenservice/notfall/defekte-strassenbeleuchtung' &&
          method === 'GET',
      ),
    );
  });
}
