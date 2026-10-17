import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectEvbForm, evbRequirements } from '../dist/evb-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/evb-form.html', import.meta.url), 'utf8');
test('EVB pins lighting form, bot controls and consent while discarding only opaque technical values', () => {
  assert.equal(inspectEvbForm(html).length, 4);
  assert.deepEqual(
    inspectEvbForm(
      html
        .replaceAll('0'.repeat(32), 'a'.repeat(32))
        .replaceAll('offline-token', 'fresh-token')
        .replace('offline-technical-value', 'fresh-opaque-value'),
    ),
    inspectEvbForm(html),
  );
  for (const body of [
    html + html,
    html.replace('lbwpForm-2266-2', 'lbwpForm-6055-1'),
    html.replace('required="required"', ''),
    html.replace('data-use-botcheck="1"', 'data-use-botcheck="0"'),
    html.replace('to_recept_' + '0'.repeat(32), 'to_recept_' + 'a'.repeat(32)),
    html.replace('name="form-nonce"', 'name="other-token"'),
    html.replace('https://www.ev-bueren.ch/datenschutz/', 'https://example.invalid/'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('Lampe zerstört', 'Another class'),
    html.replace('action="/online-schalter/#message-2266-2"', 'action="https://example.invalid/"'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectEvbForm(body), /changed/);
  }
});
test('EVB checks BFS383 before provider reads and never executes nonce POSTs or sends', async () => {
  let bfs = 383;
  const calls = [];
  const city = new MunicipalFormClient(
    'bueren',
    async (url, init) => {
      calls.push([url, init.method]);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const req = await city.requirements({ latitude: 47.14, longitude: 7.37 });
  assert.deepEqual(req, evbRequirements());
  for (const r of Object.values(req)) {
    assert.equal(r.email_required, false);
    assert.equal(r.phone_required, true);
    assert.equal(r.max_photos, 0);
    assert.equal(r.extra_fields.find((f) => f.code === 'first_name').required, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'last_name').required, false);
    assert.equal(r.extra_fields.find((f) => f.code === 'lamp_number').required, false);
    assert.equal(
      r.extra_fields.some((f) => /nonce|token|recept/.test(f.code)),
      false,
    );
  }
  bfs = 372;
  await assert.rejects(city.requirements({ latitude: 47.14, longitude: 7.37 }), /outside/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'GET');
  assert.equal(calls[0][0], 'https://www.ev-bueren.ch/online-schalter/');
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.equal(city.trackingSupported, false);
  assert.throws(
    () => new MunicipalFormClient('bueren', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
