import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectTherwilForm,
  therwilCategories,
  therwilRequirements,
} from '../dist/therwil-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/therwil-form.html', import.meta.url), 'utf8');
test('Therwil pins required contact/street/number, three choices, technical empty field and noncached action', () => {
  assert.deepEqual(
    inspectTherwilForm(html).map((c) => c.service_name),
    therwilCategories,
  );
  assert.deepEqual(
    inspectTherwilForm(
      html.replace('0'.repeat(32), 'b'.repeat(32)).replace('offline-token', 'rotated-token'),
    ),
    inspectTherwilForm(html),
  );
  for (const body of [
    html + html,
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('name="element_444859043"', 'name="unverified-number"'),
    html.replace('type="number"', 'type="text"'),
    html.replace('Lampe brennt nicht', 'Private Stromstörung'),
    html.replace('name="subject-f"', 'name="changed-technical-field"'),
    html.replace('wForm-nsid-', 'wForm-cached-0-nsid-'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectTherwilForm(body), /changed/);
  }
});
test('Therwil retains numeric identity exactly, requires other details, checks BFS before GET and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-therwil-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 2775;
  const calls = [];
  const city = new MunicipalFormClient(
    'therwil',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 47.5, longitude: 7.55 };
  assert.deepEqual(await city.requirements(point), therwilRequirements());
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Fictional offline lamp location',
    category: therwilCategories[0],
    description: 'Fictional lamp fault used only in offline tests.',
    email: 'offline@example.invalid',
    phone: '0610000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'OfflineFirst',
      last_name: 'OfflineSurname',
      lighting_street: 'Offline street',
      lamp_number: '000042',
    },
  };
  for (const lamp_number of ['', '4.2', '+42', '-42', '4e2', '０４２', '42\n', '42 extra'])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, lamp_number } }),
      /lamp_number|format/,
    );
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/);
  await assert.rejects(service.prepare({ ...input, phone: undefined }), /phone/);
  await assert.rejects(
    service.prepare({ ...input, category: therwilCategories[2] }),
    /other_defect_details/,
  );
  for (const category of therwilCategories) {
    const p = await service.prepare({
      ...input,
      category,
      extra_fields: {
        ...input.extra_fields,
        ...(category === therwilCategories[2]
          ? { other_defect_details: 'Offline other lighting defect details.' }
          : {}),
      },
    });
    assert.equal(p.report.extra_fields.lamp_number, '000042');
    assert.equal(p.municipality.bfs_id, 2775);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  }
  bfs = 2773;
  const before = calls.length;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, before);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('therwil', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
