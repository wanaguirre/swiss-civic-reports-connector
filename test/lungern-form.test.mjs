import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectLungernPage,
  inspectLungernContract,
  lungernCategories,
  lungernRequirements,
  lungernFormUrl,
  loadLungernCategories,
} from '../dist/lungern-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/lungern-page.html', import.meta.url), 'utf8');
const data = JSON.parse(
  await readFile(new URL('fixtures/lungern-config.json', import.meta.url), 'utf8'),
);
const digest = 'bafa7ccd1cd509c249a947b3580d37179e8c0311c8e036ab48b1f9a79c11c024';
const point = { latitude: 46.78515, longitude: 8.15948 };
const input = {
  ...point,
  location_confirmed: true,
  location_label: 'Offline issue place',
  category: lungernCategories[1],
  description: 'Nur ein fiktiver Offline-Test, niemals übermittelt.',
  email: 'fictional@example.invalid',
  photo_ids: [],
  extra_fields: {
    first_name: 'Fictional',
    last_name: 'Resident',
    location_details: 'Offline affected location',
    public_space_confirmed: 'Public-space issue in Lungern confirmed',
    data_policy_consent: 'I have read and accept the provider privacy notice',
  },
};

test('Lungern embedding pins tenant/resource and rejects ambiguous or executable embedding changes', () => {
  assert.equal(inspectLungernPage(html), '00000000-0000-0000-0000-000000000000');
  for (const bad of [
    html + html,
    html.replace('"lungern"', '"elsewhere"'),
    html.replace('widget/form.js', 'widget/changed.js'),
    html.replace('00000000-0000-0000-0000-000000000000', 'invalid'),
    html.replace('renderMaengelmelderForm(', 'alert(1);renderMaengelmelderForm('),
    'x'.repeat(1_000_001),
  ])
    assert.throws(() => inspectLungernPage(bad), /changed/);
});
test('Lungern full selected configuration and source fingerprint reject category/contact/photo/map/label drift', () => {
  assert.deepEqual(
    inspectLungernContract(digest, data).map((c) => c.service_code),
    [...lungernCategories],
  );
  const edits = [
    (d) => (d[0].city = 'Other'),
    (d) => (d[0].requiredFormfields += '|phone'),
    (d) => (d[0].formfields += '|phone'),
    (d) => (d[0].photoRequiredReportTypes = lungernCategories[1]),
    (d) => (d[0].polygon = [[8, 46]]),
    (d) => (d[0].captcha = true),
    (d) => d[1].options.reverse(),
    (d) => (d[1].options[0].value = 'Other'),
    (d) => d[1].options.push(d[1].options[0]),
    (d) => (d[2] = '0,0'),
    (d) => (d[3].mangel = 'Other'),
  ];
  for (const edit of edits) {
    const d = structuredClone(data);
    edit(d);
    assert.throws(() => inspectLungernContract(digest, d), /changed/);
  }
  assert.throws(() => inspectLungernContract('0'.repeat(64), data), /changed/);
});
test('Lungern rejects changed widget before any POST and never falls through to report creation', async () => {
  const calls = [];
  await assert.rejects(
    loadLungernCategories(
      async (url, init) => {
        calls.push([url, init]);
        return new Response(calls.length === 1 ? html : 'changed widget', {
          headers: { 'content-type': calls.length === 1 ? 'text/html' : 'application/javascript' },
        });
      },
      () => {},
    ),
    /changed/,
  );
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ([, init]) =>
        init.method === 'GET' && init.credentials === 'omit' && init.redirect === 'error',
    ),
  );
});
test('Lungern exact BFS guard precedes every provider query and experimental sends cannot be enabled', async () => {
  let calls = 0;
  const city = new MunicipalFormClient(
    'lungern',
    async () => {
      calls++;
      throw Error('Unexpected');
    },
    { places: { municipality: async () => ({ bfs_id: 1406 }) } },
  );
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls, 0);
  assert.throws(
    () => new MunicipalFormClient('lungern', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Lungern source failures clear caches, enforce cooldown and do not fall back to stale data', async () => {
  let calls = 0;
  const city = new MunicipalFormClient(
    'lungern',
    async () => {
      calls++;
      return new Response('limited', {
        status: 429,
        headers: { 'retry-after': '600', 'content-type': 'text/html' },
      });
    },
    { places: { municipality: async () => ({ bfs_id: 1405 }) } },
  );
  await assert.rejects(city.requirements(point), /changed/);
  await assert.rejects(city.categories(), /changed/);
  assert.equal(calls, 1);
});
test('Lungern source-backed rules freeze contact/photo/consent and retain no-send guards under global enable', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-lungern-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = 0;
  const city = new MunicipalFormClient('lungern', async () => {
    calls++;
    throw Error('Unexpected municipal access');
  });
  // Engine contract test uses the inspected configuration; a separate packaged
  // smoke exercises the full HTTP reader with captured vendor JS, not redistributed vendor code.
  const adapter = Object.assign(Object.create(city), {
    requirements: async () => lungernRequirements(),
    categories: async () => inspectLungernContract(digest, data),
  });
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(adapter, store, { submissionEnabled: true, allowPaths: false });
  assert.equal((await adapter.categories()).length, 11);
  for (const code of [
    'first_name',
    'last_name',
    'location_details',
    'public_space_confirmed',
    'data_policy_consent',
  ])
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, [code]: '' } }),
      /requires|required/,
    );
  await assert.rejects(service.prepare({ ...input, email: '' }), /email/i);
  await assert.rejects(
    service.prepare({ ...input, phone: '+41440000000' }),
    /does not accept|unsupported|phone/i,
  );
  await assert.rejects(service.prepare({ ...input, category: 'Private dispute' }), /category/i);
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#567890' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  const secondPhoto = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#987654' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [photo.metadata.id, secondPhoto.metadata.id] }),
    /at most 1/i,
  );
  const prepared = await service.prepare({ ...input, photo_ids: [photo.metadata.id] });
  assert.equal(prepared.municipality.bfs_id, 1405);
  assert.equal(prepared.submission_enabled, false);
  const frozen = await store.preview(prepared.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 1405, service_id: 'lungern-defect-form' });
  assert.equal(frozen.photos.length, 1);
  assert.equal(
    frozen.input.extra_fields.data_policy_consent,
    input.extra_fields.data_policy_consent,
  );
  const noPhoto = await service.prepare(input);
  assert.equal((await store.preview(noPhoto.preview_id)).photos.length, 0);
  input.extra_fields.location_details = 'Edited after preview';
  assert.equal(
    (await store.preview(prepared.preview_id)).input.extra_fields.location_details,
    'Offline affected location',
  );
  input.extra_fields.location_details = 'Offline affected location';
  await assert.rejects(
    service.prepare({ ...input, description: 'x'.repeat(5001) }),
    /5000|long|length/,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, location_details: 'x'.repeat(501) },
    }),
    /500|long|length/,
  );
  await assert.rejects(city.submit(frozen), /verification/);
  await assert.rejects(city.report('0'), /unverified/);
  assert.equal(calls, 0);
  assert.equal(city.termsUrl, 'https://www.maengelmelder.eu/de/datenschutz/index.php?c=lungern');
});
