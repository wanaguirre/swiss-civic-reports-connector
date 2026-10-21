import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  inspectRabiosaForm,
  rabiosaCategories,
  rabiosaRequirements,
  rabiosaFormUrl,
} from '../dist/rabiosa-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/rabiosa-form.html', import.meta.url), 'utf8');
const trapName = 'OFFLINE_TRAP_NAME_'.repeat(2).slice(0, 22),
  trapValue = 'OFFLINE_TRAP_VALUE_'.repeat(2).slice(0, 22);
test('Rabiosa pins the complete lamp accordion and all clients, discarding shaped technical state without swapping its trap', () => {
  assert.deepEqual(inspectRabiosaForm(html), rabiosaCategories);
  const rotated = html
    .replace(
      '0'.repeat(32) + '.' + 'A'.repeat(43) + '.' + 'B'.repeat(58),
      'f'.repeat(30) + '.' + 'C'.repeat(43) + '.' + 'D'.repeat(58),
    )
    .replaceAll(trapName, 'E'.repeat(22))
    .replaceAll(trapValue, 'F'.repeat(22));
  assert.deepEqual(inspectRabiosaForm(rotated), rabiosaCategories);
  const changes = [
    html + html,
    html.replace('auto_form_1', 'auto_form_2'),
    html.replace('name="Strasse"', 'name="destination"'),
    html.replace('required=""', ''),
    html.replace('method="post"', 'method="get"'),
    html.replace('application/x-www-form-urlencoded', 'multipart/form-data'),
    html.replace('Ich möchte eine defekte Strassenleuchte melden', 'Private fixtures'),
    html.replace('name="Name"', 'name="private_name"'),
    html.replace('name="email"', 'name="other-trap"'),
    html.replaceAll(trapName, 'short'),
    html.replaceAll(trapValue, trapName),
    html.replace('0'.repeat(32) + '.', 'X'.repeat(32) + '.'),
    html.replace('a.value=a.name;a.name=b', "a.value='bypass'"),
    html.replace('jquery.min.js-c31f118d.js', 'new.js'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<template><input name="extra"></template></form>'),
    html.replace('</form>', '<iframe src="https://invalid.example"></iframe></form>'),
    html + '<input form="unexpected" name="outside">',
    html + '<script>unlock()</script>',
    html + '<div class="g-recaptcha"></div>',
  ];
  for (const [i, broken] of changes.entries()) {
    assert.notEqual(broken, html, `mutation${i}`);
    assert.throws(() => inspectRabiosaForm(broken), /changed/, `mutation${i}`);
  }
  assert.deepEqual(
    inspectRabiosaForm('<form><input name="unrelated"></form>' + html),
    rabiosaCategories,
  );
});
test('Rabiosa exact BFS and maintained-asset gates keep contacts private, preserve lamp numbers, exclude photos and block all sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-rabiosa-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 3911;
  const calls = [];
  const city = new MunicipalFormClient(
    'rabiosa-churwalden',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false }),
    point = { latitude: 46.781, longitude: 9.543 };
  bfs = 3901;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 3911;
  assert.deepEqual(await city.requirements(point), rabiosaRequirements());
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Offline public lamp point',
    category: 'Defekte Strassenleuchte',
    description: 'A fictional nonurgent public lamp defect for offline verification.',
    email: '',
    photo_ids: [],
    extra_fields: {
      lighting_street: 'Offline lamp street',
      lighting_locality: 'Churwalden',
      public_lamp_confirmed: 'Public lamp in Churwalden maintained by Rabiosa Energie confirmed',
    },
  };
  for (const code of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[code];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
  }
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, public_lamp_confirmed: 'private lamp' },
    }),
    /public_lamp_confirmed/,
  );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(256) },
    }),
    /255/,
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#334455' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const noContacts = await service.prepare(input);
  assert.equal(noContacts.report.email, '');
  assert.equal(noContacts.submission_enabled, false);
  assert.equal(noContacts.submission_mode, 'unverified');
  await assert.rejects(
    service.submit(noContacts.preview_id, noContacts.confirmation_token, true),
    /verification/,
  );
  const p = await service.prepare({
    ...input,
    name: 'Private Resident',
    phone: '0810000000',
    email: 'private@example.invalid',
    extra_fields: { ...input.extra_fields, lamp_number: '0007-A' },
  });
  assert.equal(p.report.name, 'Private Resident');
  assert.equal(p.report.extra_fields.lamp_number, '0007-A');
  assert.equal(p.attachments.length, 0);
  assert.equal(p.municipality.bfs_id, 3911);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 3911);
  assert.equal(frozen.input.extra_fields.lamp_number, '0007-A');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(point)),
    /REQUEST_TOKEN|FORM_SUBMIT|rsas-field|read-time/,
  );
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('rabiosa-churwalden', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.ok(
    calls.every(
      (c) => c.url === rabiosaFormUrl && c.method === 'GET' && c.redirect === 'error' && !c.body,
    ),
  );
  assert.equal((await store.receipts()).length, 0);
});
test('Rabiosa fresh protection drift invalidates cached rules and cools down without executing the trap', async () => {
  let body = html,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'rabiosa-churwalden',
    async (url, init) => {
      calls.push([String(url), init.method]);
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: 3911 }) } },
  );
  const point = { latitude: 46.781, longitude: 9.543 };
  await city.requirements(point);
  body = html.replace('a.value=a.name;a.name=b', "a.value='changed'");
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  assert.equal(calls.length, 2);
  body = html;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 2);
  now = 300001;
  assert.deepEqual(await city.requirements(point), rabiosaRequirements());
  assert.deepEqual(calls, Array(3).fill([rabiosaFormUrl, 'GET']));
});
