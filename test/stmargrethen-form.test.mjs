import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectStmargrethenForm,
  stmargrethenCategory,
  stmargrethenRequirements,
} from '../dist/stmargrethen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/stmargrethen-form.html', import.meta.url), 'utf8');
test('St. Margrethen pins the complete Comet builder and validation, checking but never simulating interaction fields', () => {
  const expected = [{ service_code: stmargrethenCategory, service_name: stmargrethenCategory }];
  assert.deepEqual(inspectStmargrethenForm(html), expected);
  let rotated = html
    .replace('A'.repeat(64), 'B'.repeat(64))
    .replace('A'.repeat(24), 'C'.repeat(24))
    .replace('0000000000000', '1234567890123');
  for (let i = 1; i <= 4; i++)
    rotated = rotated.replace(
      'formfield' + String(i).repeat(10),
      'formfield' + String(i + 4).repeat(10),
    );
  assert.deepEqual(inspectStmargrethenForm(rotated), expected);
  assert.deepEqual(inspectStmargrethenForm('<p>Unrelated navigation</p>' + html), expected);
  for (const body of [
    html + html,
    html.replace('https://www.stmargrethen.ch/route/form-submit', 'https://foreign.invalid/send'),
    html.replace('A'.repeat(64), 'invalid'),
    html.replace('A'.repeat(24), 'invalid'),
    html.replace('0000000000000', 'bad-time'),
    html.replace('class="cffp_mm"', 'class="other"'),
    html.replace('formfield1111111111', 'formfield2222222222'),
    html.replace('name="phone" class="field" required', 'name="phone" class="field"'),
    html.replace(
      '"phone":{"required":{"type":"tel","value":1}}',
      '"phone":{"required":{"type":"tel","value":0}}',
    ),
    html.replace('Beschreibung Standort', 'Reporter address'),
    html.replace('name="town2"', 'name="other"'),
    html.replace('</form>', '<input type="email" name="email"></form>'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html + '<div class="g-recaptcha"></div>',
    html.replace('name="dispatcher" value="', 'name="dispatcher" value="0'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectStmargrethenForm(body), /changed/);
  }
});
test('St. Margrethen binds BFS before reads, separates lamp location from contacts, rejects email and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-stmargrethen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3216;
  const calls = [];
  const city = new MunicipalFormClient(
    'stmargrethen',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.452, longitude: 9.637 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3236;
  const requirements = await city.requirements(point);
  assert.deepEqual(requirements, stmargrethenRequirements());
  const req = requirements[stmargrethenCategory];
  assert.deepEqual(
    req.extra_fields.filter((x) => x.contact).map((x) => x.code),
    ['first_name', 'last_name'],
  );
  assert.equal(req.email_supported, false);
  assert.equal(req.max_photos, 0);
  assert.equal(req.extra_fields.find((x) => x.code === 'lighting_house_number').required, false);
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline public lamp',
    category: stmargrethenCategory,
    description: 'Fictional public lamp damage, tested only offline.',
    email: '',
    phone: '0710000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      lighting_street: 'Offline street',
      lighting_location: 'Lamp beside the offline public path',
    },
  };
  for (const code of ['first_name', 'last_name', 'lighting_street', 'lighting_location']) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/);
  await assert.rejects(service.prepare({ ...input, email: 'private@example.invalid' }), /email/i);
  const p = await service.prepare(input);
  assert.equal(p.municipality.bfs_id, 3236);
  assert.equal(p.report.email, '');
  assert.equal(p.report.extra_fields.lighting_location, input.extra_fields.lighting_location);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.submission_enabled, false);
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('stmargrethen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.equal((await store.receipts()).length, 0);
});
