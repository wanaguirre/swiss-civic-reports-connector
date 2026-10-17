import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectDotzigenForm, dotzigenRequirements } from '../dist/dotzigen-form.js';
import { inspectWohlenBeForm } from '../dist/wohlen-be-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/dotzigen-form.html', import.meta.url), 'utf8');
test('Dotzigen pins noncached form, consent, technical empty field and rejects cached action substitution', async () => {
  assert.equal(inspectDotzigenForm(html).length, 1);
  assert.deepEqual(
    inspectDotzigenForm(
      html.replace('0'.repeat(32), 'a'.repeat(32)).replace('offline-token', 'new-token'),
    ),
    inspectDotzigenForm(html),
  );
  for (const body of [
    html + html,
    html.replace('wForm-nsid-', 'wForm-cached-0-nsid-'),
    html.replace("pregMatch('^$')", 'required'),
    html.replace('data-validators="required"', 'data-validators=""'),
    html.replace('name="email"', 'name="email_optional"'),
    html.replace('datenschutz-akzeptiert[]', 'privacy'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('/weblication/grid5/tmpHTTP/', 'https://example.invalid/'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectDotzigenForm(body), /changed/);
  }
  const wohlen = await readFile(new URL('fixtures/wohlen-be-form.html', import.meta.url), 'utf8');
  assert.throws(
    () =>
      inspectWohlenBeForm(
        wohlen.replace('wForm-cached-0-nsid-offline', 'wForm-nsid-' + '0'.repeat(32)),
      ),
    /changed/,
  );
});
test('Dotzigen checks BFS386 and keeps contact form lighting-only without sends', async () => {
  let bfs = 386,
    calls = 0;
  const city = new MunicipalFormClient(
    'dotzigen',
    async (url, init) => {
      calls++;
      assert.equal(init.method, 'GET');
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const req = await city.requirements({ latitude: 47.12, longitude: 7.34 });
  assert.deepEqual(req, dotzigenRequirements());
  const rule = Object.values(req)[0];
  assert.equal(rule.phone_required, true);
  assert.equal(rule.email_required, true);
  assert.equal(rule.max_photos, 0);
  assert.equal(
    rule.extra_fields.some((f) => f.code === 'subject-3'),
    false,
  );
  bfs = 383;
  await assert.rejects(city.requirements({ latitude: 47.12, longitude: 7.34 }), /outside/);
  assert.equal(calls, 1);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('dotzigen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
