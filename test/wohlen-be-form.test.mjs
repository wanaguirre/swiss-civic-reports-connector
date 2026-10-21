import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectWohlenBeForm, wohlenBeRequirements } from '../dist/wohlen-be-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/wohlen-be-form.html', import.meta.url), 'utf8');
test('Wohlen pins validators and consent without executing scripts or retaining ephemeral tokens', () => {
  assert.equal(inspectWohlenBeForm(html).length, 5);
  assert.deepEqual(
    inspectWohlenBeForm(
      html
        .replace('offline-token', 'fresh-token')
        .replace('cached-0-nsid-offline', 'cached-123-nsid-abcdef'),
    ),
    inspectWohlenBeForm(html),
  );
  for (const body of [
    html + html,
    html.replace('data-validators="required"', 'data-validators=""'),
    html.replace('pregMatch(&#039;^$&#039;)', 'required'),
    html.replace('datenschutz-akzeptiert[]', 'privacy-optional'),
    html.replace('Lampe brennt nicht', 'Unknown fault'),
    html.replace('name="ort"', 'name="town"'),
    html.replace('/weblication/grid5/tmpHTTP/', 'https://example.invalid/'),
    html.replace('method="POST"', 'method="GET"'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('type="file"', 'type="password"'),
  ]) {
    assert.notEqual(body, html, 'mutation must change fixture');
    assert.throws(() => inspectWohlenBeForm(body), /changed/);
  }
});
test('Wohlen requires road confirmation and consent; BFS360 rejects other destinations before reads', async () => {
  let bfs = 360;
  const calls = [];
  const city = new MunicipalFormClient(
    'wohlen-be',
    async (url, init) => {
      calls.push(init.method);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const req = await city.requirements({ latitude: 46.97, longitude: 7.35 });
  assert.deepEqual(req, wohlenBeRequirements());
  for (const r of Object.values(req)) {
    assert.equal(r.max_photos, 0);
    assert.equal(r.email_required, true);
    assert.equal(r.phone_required, false);
    assert.deepEqual(r.extra_fields.find((f) => f.code === 'municipal_road_confirmed').values, [
      'Municipal road confirmed',
    ]);
    assert.equal(r.extra_fields.find((f) => f.code === 'privacy_consent').required, true);
    assert.equal(
      r.extra_fields.some((f) => f.code === 'subject-8'),
      false,
    );
  }
  bfs = 329;
  await assert.rejects(city.requirements({ latitude: 46.97, longitude: 7.35 }), /outside/);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('wohlen-be', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.equal(city.trackingSupported, false);
  assert.deepEqual(calls, ['GET']);
  assert.equal(city.termsUrl, 'https://www.wohlen-be.ch/de/datenschutz/');
});
