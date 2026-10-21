import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectCkwForm,
  ckwCategories,
  ckwFormUrl,
  werthensteinLightingRequirements,
  ckwRequirements,
  ckwMunicipalities,
  isCkwMunicipality,
} from '../dist/ckw-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/ckw-lighting.html', import.meta.url), 'utf8');
const point = { latitude: 47.05, longitude: 8.1 };
test('CKW pins the complete selected configuration, historical locality list and component version without executing source', () => {
  assert.equal(inspectCkwForm(html).length, 2);
  for (const body of [
    html + html,
    html.replace('Werthenstein', 'Unreviewed place'),
    html.replace('"sendAPI":true', '"sendAPI":false'),
    html.replace('c3a88c6e', 'unknown'),
    html.replace(
      'incidentreport-baseurl="https://www.ckw.ch/"',
      'incidentreport-baseurl="https://example.invalid/"',
    ),
    html.replace('</section>', '<div class="g-recaptcha"></div></section>'),
    html.replace('</section>', '<input type="file" name="photo"></section>'),
    'x'.repeat(1_000_001),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectCkwForm(body), /changed/);
  }
  // A separate newsletter protection is not this component's reporting control.
  assert.equal(
    inspectCkwForm(html + '<form id="newsletter"><div class="g-recaptcha"></div></form>').length,
    2,
  );
});
test('CKW membership requires an independently qualified own key, not a provider-listed place or inherited property', () => {
  for (const name of Object.keys(ckwMunicipalities)) assert.equal(isCkwMunicipality(name), true);
  for (const name of [
    'alberswil',
    'grosswangen',
    'rickenbach',
    'sempach',
    'wolhusen',
    'altbueron',
    'luthern',
    'Knutwil',
    'constructor',
    'toString',
    '__proto__',
    '',
  ])
    assert.equal(isCkwMunicipality(name), false);
});
test('CKW retains the original Werthenstein requirements export', () => {
  assert.deepEqual(werthensteinLightingRequirements(), ckwRequirements('werthenstein'));
});
for (const [name, config] of Object.entries(ckwMunicipalities))
  test(`${config.name} freezes only independently bound public-lamp preparation; actual number, category and no-photo rules are enforced`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'civic-ckw-offline-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    let bfs = config.bfsId,
      body = html;
    const calls = [];
    const city = new MunicipalFormClient(
      name,
      async (url, init) => {
        calls.push([String(url), init.method]);
        return new Response(body, { headers: { 'Content-Type': 'text/html' } });
      },
      { places: { municipality: async () => ({ bfs_id: bfs }) } },
    );
    const store = new Store(dir);
    await store.initialize();
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    bfs = name === 'werthenstein' ? 1051 : 1009;
    await assert.rejects(city.requirements(point), /outside/);
    assert.equal(calls.length, 0);
    bfs = config.bfsId;
    assert.deepEqual(await city.requirements(point), ckwRequirements(name));
    const input = {
      ...point,
      location_confirmed: true,
      location_label: 'Fictional offline lamp location',
      category: ckwCategories[0],
      description: 'Offline fixture only; never submitted.',
      email: '',
      photo_ids: [],
      extra_fields: { lamp_number: 'K1-12', public_lamp_confirmed: 'Public streetlamp confirmed' },
    };
    for (const lamp of [
      '',
      'K123-2',
      'k1-2',
      'K1-123',
      'K1-2XX',
      'K1-2\n',
      ' K1-2',
      'UNKNOWN',
      'K1-2<script>',
    ])
      await assert.rejects(
        service.prepare({ ...input, extra_fields: { ...input.extra_fields, lamp_number: lamp } }),
        /lamp_number|must not exceed/,
      );
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { lamp_number: 'K1-2' } }),
      /public_lamp_confirmed/,
    );
    await assert.rejects(
      service.prepare({
        ...input,
        category: 'Andere Störung (Mast ist beschädigt, Glas defekt/fehlt etc.)',
      }),
      /Category/,
    );
    await assert.rejects(
      service.prepare({ ...input, email: 'fictional@example.invalid' }),
      /does not accept a reporter email/,
    );
    await assert.rejects(service.prepare({ ...input, name: 'Fictional' }), /reporter name/);
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
          .jpeg()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(
      service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
      /at most 0/,
    );
    for (const category of ckwCategories) {
      const preview = await service.prepare({
        ...input,
        category,
        extra_fields: { ...input.extra_fields, lamp_number: 'S99-99Z' },
      });
      assert.equal(preview.municipality.bfs_id, config.bfsId);
      assert.equal(preview.submission_mode, 'unverified');
      assert.equal(preview.submission_enabled, false);
      const frozen = await store.preview(preview.preview_id);
      assert.deepEqual(frozen.destination, {
        bfs_id: config.bfsId,
        service_id: `${name}-defect-form`,
      });
      assert.equal(frozen.photos.length, 0);
      assert.equal(frozen.input.email, '');
      assert.equal(frozen.input.extra_fields.lamp_number, 'S99-99Z');
      await assert.rejects(city.submit(frozen), /verification/);
    }
    assert.deepEqual(calls, [[ckwFormUrl, 'GET']]);
    assert.equal(city.guidance.verified_on, '2026-10-18');
    assert.equal(city.guidance.sources.length, 3);
    assert.ok(city.guidance.sources.some((source) => source.url === config.referralUrl));
    assert.match(city.guidance.scope, new RegExp(config.name));
    assert.doesNotMatch(
      city.guidance.scope,
      new RegExp(name === 'werthenstein' ? 'Adligenswil' : 'Werthenstein'),
    );
    assert.match(city.guidance.scope, /not independently verify/i);
    assert.throws(
      () => new MunicipalFormClient(name, fetch, { experimentalSubmission: true }),
      /only implemented/,
    );
    body = html.replace('c3a88c6e', 'changed');
    await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
    const count = calls.length;
    await assert.rejects(city.requirements(point), /changed/);
    assert.equal(calls.length, count);
  });
