import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectThusisForm,
  thusisCategories,
  thusisRequirements,
  thusisFormUrl,
} from '../dist/thusis-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = JSON.parse(
  await readFile(new URL('fixtures/thusis-form.json', import.meta.url), 'utf8'),
).html;
test('Thusis pins the required photo lifecycle and every selected field/client; only shaped read-time values vary', () => {
  assert.deepEqual(inspectThusisForm(html), thusisCategories);
  assert.deepEqual(
    inspectThusisForm(
      html
        .replace('A'.repeat(55) + '=', 'B'.repeat(55) + '=')
        .replaceAll('0'.repeat(10), 'a'.repeat(10)),
    ),
    thusisCategories,
  );
  const mutations = [
    html + html,
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace('Standort', 'Recipient address'),
    html.replace('Bilder des Schadens', 'Optional picture'),
    html.replace('gfield_contains_required', 'gfield_optional'),
    html.replace('name="input_3"', 'name="comment"'),
    html.replace('A'.repeat(55) + '=', 'invalid-state'),
    html.replace('0'.repeat(10), 'bad-nonce'),
    html.replace('314572800b', '999999999b'),
    html.replace('300 MB', '600 MB'),
    html.replace('&quot;max_files&quot;:0', '&quot;max_files&quot;:1'),
    html.replace('&quot;extensions&quot;:&quot;*&quot;', '&quot;extensions&quot;:&quot;jpg&quot;'),
    html.replace('thusis.ch/?gf_page=', 'other.invalid/?gf_page='),
    html.replace('gravityforms.min.js', 'different-client.js'),
    html.replace('version_hash', 'changed_protection'),
    html.replaceAll('</form>', '<input required name="email" type="email"></form>'),
    html.replaceAll('</form>', '<iframe src="https://example.invalid"></iframe></form>'),
    html.replaceAll('</form>', '<template><input name="new"></template></form>'),
    html + '<input form="gform_36" name="new">',
    html + '<div class="g-recaptcha"></div>',
    html + '<script>newUploadClient()</script>',
  ];
  for (const [i, broken] of mutations.entries()) {
    assert.notEqual(broken, html, `mutation ${i} must change fixture`);
    assert.throws(() => inspectThusisForm(broken), /changed/, `mutation ${i}`);
  }
});
test('Thusis requires a local photo and municipal leisure ownership, rejects contacts, binds BFS before GET and never uploads/sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-thusis-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3663;
  const calls = [];
  const city = new MunicipalFormClient(
    'thusis',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 46.697, longitude: 9.44 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3668;
  assert.deepEqual(await city.requirements(point), thusisRequirements());
  assert.equal(calls[0].url, thusisFormUrl);
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline municipal playground',
    category: thusisCategories[0].service_code,
    description: 'Offline fictional broken municipal playground bench, never sent.',
    email: '',
    photo_ids: [],
    extra_fields: {
      municipal_leisure_asset_confirmed: 'Municipal leisure asset in Thusis confirmed',
    },
  };
  await assert.rejects(service.prepare(input), /photo/i);
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  const withPhoto = { ...input, photo_ids: [photo.metadata.id] };
  for (const field of ['email', 'name', 'phone'])
    await assert.rejects(
      service.prepare({
        ...withPhoto,
        [field]: field === 'email' ? 'resident@example.invalid' : 'private contact',
      }),
      /does not accept/,
    );
  await assert.rejects(
    service.prepare({ ...withPhoto, extra_fields: {} }),
    /municipal_leisure_asset_confirmed/,
  );
  await assert.rejects(
    service.prepare({
      ...withPhoto,
      extra_fields: { municipal_leisure_asset_confirmed: 'Private playground' },
    }),
    /Invalid/,
  );
  await assert.rejects(service.prepare({ ...withPhoto, category: 'Road damage' }), /category/i);
  const p = await service.prepare(withPhoto);
  assert.equal(p.municipality.bfs_id, 3668);
  assert.equal(p.attachments.length, 1);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.submission_mode, 'unverified');
  assert.equal(p.report.email, '');
  assert.equal(p.report.location_label, input.location_label);
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(point)),
    /state_36|gf_page|nonce|gform_uploaded_files/,
  );
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 3668);
  assert.equal(frozen.photos[0].sha256, p.attachments[0].sha256);
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('thusis', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  assert.ok(calls.every((c) => c.url === thusisFormUrl));
});
test('Thusis fresh source drift clears cached rules and cools down without requesting an upload endpoint', async () => {
  let body = html,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'thusis',
    async (url, init) => {
      calls.push([String(url), init.method]);
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: 3668 }) } },
  );
  const point = { latitude: 46.697, longitude: 9.44 };
  await city.requirements(point);
  body = html.replace('314572800b', '1b');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  assert.equal(calls.length, 2);
  body = html;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 2);
  now = 300001;
  assert.deepEqual(await city.requirements(point), thusisRequirements());
  assert.deepEqual(calls, Array(3).fill([thusisFormUrl, 'GET']));
});
