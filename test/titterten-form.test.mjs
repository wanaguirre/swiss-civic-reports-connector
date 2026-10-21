import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectTittertenForm,
  tittertenCategory,
  tittertenRequirements,
} from '../dist/titterten-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/titterten-form.html', import.meta.url), 'utf8');
test('Titterten pins full lighting form, salutation choices and contact contract, masking only cached action/session', () => {
  assert.deepEqual(inspectTittertenForm(html), [
    { service_code: tittertenCategory, service_name: tittertenCategory },
  ]);
  assert.deepEqual(
    inspectTittertenForm(
      html
        .replace('cached-0-nsid-offline', 'cached-123-nsid-other')
        .replace('offline-token', 'another-offline-token'),
    ),
    inspectTittertenForm(html),
  );
  for (const body of [
    html + html,
    html.replace('value="Herr"', 'value="automatic"'),
    html.replace('name="lastname"', 'name="unexpected-contact"'),
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('Welche Strassenlampe ist defekt?', 'Private household lights'),
    html.replace('wForm-cached-0-nsid-offline.php', 'wForm-nsid-offline.php'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<input type="email" name="email"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectTittertenForm(body), /changed/);
  }
});
test('Titterten requires resident salutation, isolates contacts, rejects email, binds BFS before GET and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-titterten-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 2894;
  const calls = [];
  const city = new MunicipalFormClient(
    'titterten',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 47.4, longitude: 7.72 };
  assert.deepEqual(await city.requirements(point), tittertenRequirements());
  const req = tittertenRequirements()[tittertenCategory];
  assert.equal(req.email_supported, false);
  assert.equal(req.max_photos, 0);
  assert.deepEqual(
    req.extra_fields.filter((f) => f.contact).map((f) => f.code),
    ['salutation', 'first_name', 'last_name'],
  );
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Fictional offline lamp location',
    category: tittertenCategory,
    description: 'Fictional public lamp fault used only offline.',
    email: '',
    phone: '0610000000',
    photo_ids: [],
    extra_fields: {
      salutation: 'Herr',
      first_name: 'OfflineFirst',
      last_name: 'OfflineLast',
      lighting_location: 'Offline affected lamp street and landmark',
    },
  };
  for (const code of ['salutation', 'first_name', 'last_name', 'lighting_location']) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  for (const salutation of ['', 'automatic', 'Neutral'])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, salutation } }),
      /salutation/,
    );
  await assert.rejects(service.prepare({ ...input, phone: undefined }), /phone/);
  await assert.rejects(service.prepare({ ...input, email: 'private@example.invalid' }), /email/i);
  for (const salutation of ['Herr', 'Frau']) {
    const p = await service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, salutation },
    });
    assert.equal(p.report.email, '');
    assert.equal(p.report.extra_fields.salutation, salutation);
    assert.equal(p.municipality.bfs_id, 2894);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  }
  bfs = 2866;
  const before = calls.length;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, before);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('titterten', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
