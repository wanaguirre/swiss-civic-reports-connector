import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectBuchsiForm, buchsiRequirements, buchsiFormUrl } from '../dist/buchsi-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/buchsi-form.html', import.meta.url), 'utf8');
test('Buchsi pins contact, mandatory actual lamp identity, empty field and cached action', () => {
  assert.equal(inspectBuchsiForm(html).length, 1);
  assert.deepEqual(
    inspectBuchsiForm(
      html
        .replace('offline-token', 'rotated-token')
        .replace('cached-0-nsid-offline', 'cached-123-nsid-abc'),
    ),
    inspectBuchsiForm(html),
  );
  for (const body of [
    html + html,
    html.replace('name="nummer-leuchte"', 'name="other"'),
    html.replace('data-validators="required"', 'data-validators=""'),
    html.replace("pregMatch('^$')", 'required'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('/weblication/grid5/tmpHTTP/', 'https://example.invalid/'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectBuchsiForm(body), /changed/);
  }
  const rule = Object.values(buchsiRequirements())[0];
  assert.equal(rule.phone_required, false);
  assert.equal(rule.email_required, true);
  assert.equal(rule.max_photos, 0);
  for (const code of [
    'lamp_number',
    'lighting_street',
    'lighting_house_number',
    'contact_street',
    'contact_house_number',
    'contact_postcode',
    'contact_town',
  ])
    assert.equal(rule.extra_fields.find((x) => x.code === code).required, true);
  assert.equal(
    rule.extra_fields.some((x) => ['subject-b', 'salutation'].includes(x.code)),
    false,
  );
});
test('Buchsi checks BFS before provider fetch and never sends', async () => {
  let bfs = 551,
    calls = 0;
  const city = new MunicipalFormClient(
    'buchsi',
    async (url, init) => {
      calls++;
      assert.equal(url, buchsiFormUrl);
      assert.equal(init.method, 'GET');
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.021, longitude: 7.452 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls, 0);
  bfs = 546;
  assert.deepEqual(await city.requirements(point), buchsiRequirements());
  assert.equal(calls, 1);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.equal(calls, 1);
  assert.throws(
    () => new MunicipalFormClient('buchsi', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
