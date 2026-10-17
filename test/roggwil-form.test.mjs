import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRoggwilForm, roggwilRequirements } from '../dist/roggwil-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/roggwil-form.html', import.meta.url), 'utf8');
test('Roggwil accepts only selected YForm schema and tolerates fresh session tokens', () => {
  assert.equal(inspectRoggwilForm(html).length, 4);
  assert.deepEqual(
    inspectRoggwilForm(html.replace('offline-token', 'new-session-token')),
    inspectRoggwilForm(html),
  );
  for (const body of [
    html + html,
    html.replace('Lampennummer*', 'Lampennummer'),
    html.replace('E-Mail-Adresse*', 'E-Mail-Adresse'),
    html.replace('type="email"', 'type="file"'),
    html.replace('Lampe brennt nicht', 'Changed category'),
    html.replace('method="post"', 'method="get"'),
    html.replace('multipart/form-data', 'text/plain'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('</form>', '<input name="login"/></form>'),
    html.replace('FORM[formular][16]', 'FORM[formular][99]'),
  ])
    assert.throws(() => inspectRoggwilForm(body), /changed/);
});
test('Roggwil binds BFS337 before reads and blocks submission and tracking', async () => {
  let bfs = 337;
  const calls = [];
  const city = new MunicipalFormClient(
    'roggwil',
    async (url, init) => {
      calls.push(init.method);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const req = await city.requirements({ latitude: 47.24, longitude: 7.82 });
  assert.deepEqual(req, roggwilRequirements());
  for (const r of Object.values(req)) {
    assert.equal(r.max_photos, 0);
    assert.equal(r.email_required, true);
    assert.equal(r.phone_required, false);
    assert.equal(r.extra_fields.find((f) => f.code === 'lamp_number').required, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'lighting_street').contact, false);
    assert.equal(r.extra_fields.find((f) => f.code === 'contact_street').contact, true);
  }
  bfs = 329;
  await assert.rejects(city.requirements({ latitude: 47.24, longitude: 7.82 }), /outside/);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('roggwil', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.equal(city.trackingSupported, false);
  assert.deepEqual(calls, ['GET']);
});
