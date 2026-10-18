import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectWaldstattForm,
  waldstattCategory,
  waldstattRequirements,
} from '../dist/waldstatt-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/waldstatt-form.html', import.meta.url), 'utf8');
test('Waldstatt pins the complete selected DynPG form and masks only checked rotating read-time fields', () => {
  assert.deepEqual(inspectWaldstattForm(html), [
    { service_code: waldstattCategory, service_name: waldstattCategory },
  ]);
  assert.deepEqual(
    inspectWaldstattForm(
      html.replace('A'.repeat(32), 'B'.repeat(32)).replace('0000000000', '1234567890'),
    ),
    inspectWaldstattForm(html),
  );
  for (const body of [
    html + html,
    html.replace('/cms/formulars_check.php', 'https://foreign.invalid/send'),
    html.replace('A'.repeat(32), 'not-a-token'),
    html.replace('0000000000', 'expired'),
    html.replace('Name oder Firma*', 'Anonymous*'),
    html.replace('F200_Adresse-21268951-/required', 'F200_Adresse-21268951-'),
    html.replace('name="from_ts"', 'name="time"'),
    html.replace('</form>', '<input name="email" type="email"></form>'),
    html.replace('</form>', '<input name="photo" type="file"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectWaldstattForm(body), /changed/);
  }
});
test('Waldstatt isolates reporter address/date, rejects email, binds BFS before reads and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-waldstatt-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3007;
  const calls = [];
  const city = new MunicipalFormClient(
    'waldstatt',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 47.356, longitude: 9.284 };
  assert.deepEqual(await city.requirements(point), waldstattRequirements());
  const req = waldstattRequirements()[waldstattCategory];
  assert.equal(req.email_supported, false);
  assert.equal(req.max_photos, 0);
  assert.deepEqual(
    req.extra_fields.filter((x) => x.contact).map((x) => x.code),
    ['reporter_name', 'contact_address', 'form_date'],
  );
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline public lamp',
    category: waldstattCategory,
    description: 'Fictional public lamp damage, only tested offline.',
    email: '',
    phone: '0710000000',
    photo_ids: [],
    extra_fields: {
      reporter_name: 'PrivateOfflineName',
      contact_address: 'PrivateResidence 12',
      form_date: '18.10.2026',
      lighting_location: 'Offline lamp beside public path',
    },
  };
  for (const code of ['reporter_name', 'contact_address', 'form_date', 'lighting_location']) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(service.prepare({ ...input, phone: undefined }), /phone/);
  await assert.rejects(service.prepare({ ...input, email: 'private@example.invalid' }), /email/i);
  const p = await service.prepare(input);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.contact_address, 'PrivateResidence 12');
  assert.equal(p.report.extra_fields.form_date, '18.10.2026');
  assert.equal(p.report.extra_fields.lighting_location, 'Offline lamp beside public path');
  assert.equal(p.municipality.bfs_id, 3007);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.submission_enabled, false);
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  bfs = 3004;
  const before = calls.length;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, before);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('waldstatt', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
