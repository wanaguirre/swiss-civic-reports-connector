import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectOstermundigenForm,
  ostermundigenForms,
  ostermundigenRequirements,
} from '../dist/ostermundigen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const fixtures = Object.fromEntries(
  await Promise.all(
    ['lighting', 'road'].map(async (k) => [
      k,
      await readFile(new URL('fixtures/ostermundigen-' + k + '.html', import.meta.url), 'utf8'),
    ]),
  ),
);
test('Ostermundigen pins distinct forms, terms, validators and empty-field semantics', () => {
  for (const kind of ['lighting', 'road']) {
    const html = fixtures[kind];
    assert.equal(
      inspectOstermundigenForm(kind, html)[0].service_code,
      ostermundigenForms[kind].category,
    );
    assert.deepEqual(
      inspectOstermundigenForm(
        kind,
        html
          .replace('offline-token', 'new-token')
          .replace('cached-0-nsid-offline', 'cached-99-nsid-new'),
      ),
      inspectOstermundigenForm(kind, html),
    );
    for (const body of [
      fixtures[kind === 'lighting' ? 'road' : 'lighting'],
      html + html,
      html.replace('data-validators="required"', 'data-validators=""'),
      html.replace('pregMatch(&#039;^$&#039;)', 'required'),
      html.replace('/de/datenschutz/nutzungsbedingungen.php', '/different-terms'),
      html.replace('name="Telefon_privat"', 'name="phone_optional"'),
      html.replace('</form>', '<input type="file" name="photo"></form>'),
      html.replace('/weblication/grid5/tmpHTTP/', 'https://example.invalid/'),
      html.replace('</form>', '<div class="wglCaptcha"></div></form>'),
    ]) {
      assert.notEqual(body, html);
      assert.throws(() => inspectOstermundigenForm(kind, body), /changed/);
    }
  }
});
test('Ostermundigen binds BFS before fetching both contracts and fails closed on partial failure', async () => {
  let bfs = 360,
    calls = [];
  let fail = false;
  const city = new MunicipalFormClient(
    'ostermundigen',
    async (url, init) => {
      calls.push([url, init.method]);
      return fail && url === ostermundigenForms.road.url
        ? new Response('', { status: 429, headers: { 'retry-after': '600' } })
        : new Response(fixtures[url === ostermundigenForms.road.url ? 'road' : 'lighting'], {
            headers: { 'content-type': 'text/html' },
          });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  await assert.rejects(city.requirements({ latitude: 46.95, longitude: 7.49 }), /outside/);
  assert.equal(calls.length, 0);
  bfs = 363;
  assert.deepEqual(
    await city.requirements({ latitude: 46.95, longitude: 7.49 }),
    ostermundigenRequirements(),
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([, method]) => method === 'GET'));
  for (const f of Object.values(ostermundigenForms))
    assert.equal(city.fallbackUrl({ category: f.category }), f.url);
  fail = true;
  await assert.rejects(city.requirements({ latitude: 46.95, longitude: 7.49 }, { fresh: true }));
  const count = calls.length;
  await assert.rejects(city.categories(), /changed/);
  assert.equal(calls.length, count);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('ostermundigen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
