import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectLangenthalForm, langenthalCategories } from '../dist/langenthal-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const schema = JSON.parse(
  await readFile(new URL('fixtures/langenthal-schema.json', import.meta.url), 'utf8'),
);
const html = (s = schema) =>
  `<div id="nf-form-15-cont"></div><script>var form=[];form.id='15';form.settings=${JSON.stringify(s.settings)};form.fields=${JSON.stringify(s.fields)};nfForms.push(form);</script>`;
test('Langenthal reads only literal JSON and rejects contact, category and access drift', () => {
  assert.deepEqual(
    inspectLangenthalForm(html()).map((c) => c.service_code),
    langenthalCategories.map((c) => c[0]),
  );
  for (const mutate of [
    (s) => (s.settings.logged_in = 1),
    (s) => s.settings.conditions.push({ hide: true }),
    (s) => s.fields.push({ type: 'recaptcha' }),
    (s) => (s.fields[0].required = 0),
    (s) => (s.fields[4].options[0].value = 'different'),
    (s) => (s.fields[11].label = 'Issue address'),
    (s) => (s.fields[5].type = 'file'),
  ]) {
    const s = structuredClone(schema);
    mutate(s);
    assert.throws(() => inspectLangenthalForm(html(s)), /changed/);
  }
  for (const body of [
    html() + html(),
    html().replace('nfForms.push(form);', "nfForms.push(form);form.id='15';"),
    html().replace("form.id='15'", "form.id='16'"),
    html().replace('form.fields=[', 'form.fields=(()=>['),
    '<script>throw new Error("never execute")</script>',
  ])
    assert.throws(() => inspectLangenthalForm(body), /changed/);
});
test('Langenthal requires separate issue/contact addresses, enforces BFS and blocks all writes', async () => {
  const calls = [];
  let bfs = 329;
  const city = new MunicipalFormClient(
    'langenthal',
    async (url, init) => {
      calls.push(init.method);
      return new Response(html(), { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const req = await city.requirements({ latitude: 47.212, longitude: 7.789 });
  for (const r of Object.values(req)) {
    assert.equal(r.max_photos, 0);
    assert.equal(r.phone_required, true);
    assert.equal(r.email_required, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'contact_street').contact, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'lighting_street').contact, false);
    assert.equal(r.extra_fields.find((f) => f.code === 'lamp_number').required, false);
  }
  bfs = 332;
  await assert.rejects(city.requirements({ latitude: 47.212, longitude: 7.789 }), /outside/);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('langenthal', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.deepEqual(calls, ['GET']);
  assert.equal(city.trackingSupported, false);
});
