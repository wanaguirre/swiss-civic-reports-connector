import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  fingerprintTbgraenichenForm,
  inspectTbgraenichenForm,
  tbgraenichenCategories,
  tbgraenichenRequirements,
  tbgraenichenFormUrl,
  tbgraenichenCmsSource,
} from '../dist/tbgraenichen-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
// Independently authored structural fixture: no provider client, prose, token or production fingerprint.
const html = `<form id="frmGenerator18" method="post"><input name="csrfToken" type="hidden" value="${'a'.repeat(40)}"><input name="frsId" type="hidden" value="12345"><input name="cmsCheckEmptyField" value=""><input name="fel_1142" required><input name="fel_1143"><input name="fel_1150" required><input name="fel_1147" required><input name="fel_1148" required><input type="email" name="fel_1149" required><textarea name="fel_1145"></textarea></form><script src="/offline.example.js"></script>`;
test('TB Gränichen fingerprints retain full fields and scripts while discarding only shaped read-time values', () => {
  const baseline = fingerprintTbgraenichenForm(html);
  assert.deepEqual(
    fingerprintTbgraenichenForm(
      html.replace('a'.repeat(40), 'b'.repeat(40)).replace('12345', '987654'),
    ),
    baseline,
  );
  for (const mutated of [
    html + html,
    html.replace('csrfToken', 'other'),
    html.replace('a'.repeat(40), 'bad'),
    html.replace('12345', 'NaN'),
    html.replace('type="hidden"', 'type="text"'),
    html.replace(
      '</form>',
      '<input name="csrfToken" type="hidden" value="' + 'b'.repeat(40) + '"></form>',
    ),
    html + '<input form="frmGenerator18" name="outside">',
    html.replace('</form>', '<template><input name="inert"></template></form>'),
    html.replace('</form>', '<iframe src="https://invalid.example"></iframe></form>'),
  ])
    assert.throws(() => fingerprintTbgraenichenForm(mutated), /changed/);
  for (const mutated of [
    html.replace('name="fel_1142" required', 'name="fel_1142"'),
    html.replace('method="post"', 'method="get"'),
    html.replace('value=""', 'value="filled"'),
    html.replace('fel_1148', 'telephone'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('offline.example.js', 'changed.js'),
    html + '<script>/* independent offline mutation */</script>',
  ]) {
    assert.notEqual(mutated, html);
    assert.notDeepEqual(fingerprintTbgraenichenForm(mutated), baseline);
    assert.throws(() => inspectTbgraenichenForm(mutated), /changed/);
  }
  assert.throws(() => fingerprintTbgraenichenForm('x'.repeat(1_000_001)), /changed/);
  assert.throws(
    () => inspectTbgraenichenForm(html),
    /changed/,
    'authored fixture is deliberately not the production pin',
  );
  assert.ok(Object.isFrozen(tbgraenichenCmsSource));
});
test('TB Gränichen checks exact BFS before GET and fails closed with provider cooldown; no native client or protection request', async () => {
  let bfs = 4001,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'tbgraenichen',
    async (url, init) => {
      calls.push([String(url), init]);
      return new Response('', { status: 429, headers: { 'retry-after': '600' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.36, longitude: 8.1 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4006;
  await assert.rejects(city.requirements(point), /changed/);
  now = 300001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 1);
  now = 600001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ([u, i]) =>
        u === tbgraenichenFormUrl &&
        i.method === 'GET' &&
        i.credentials === 'omit' &&
        i.redirect === 'error' &&
        !i.body,
    ),
  );
  for (const make of [
    () => new Response(html, { headers: { 'content-type': 'text/html' } }),
    () => new Response(html, { headers: { 'content-type': 'application/json' } }),
    () => new Response('x'.repeat(1_000_001), { headers: { 'content-type': 'text/html' } }),
    () => {
      const r = new Response(html, { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
  ]) {
    let count = 0;
    const adapter = new MunicipalFormClient(
      'tbgraenichen',
      async () => {
        count++;
        return make();
      },
      { places: { municipality: async () => ({ bfs_id: 4006 }) } },
    );
    await assert.rejects(adapter.requirements(point), /changed/);
    await assert.rejects(adapter.requirements(point), /changed/);
    assert.equal(count, 1);
  }
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.termsUrl, undefined, 'blank policy body does not invent native consent');
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('tbgraenichen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('TB Gränichen preview requires private split contacts and maintained public lamp, keeps lamp number optional, excludes photos and all sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-tbgraenichen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'tbgraenichen',
    async () => assert.fail('rule double must not access network'),
    { places: { municipality: async () => ({ bfs_id: 4006 }) } },
  );
  // Isolate the shared preview boundary; actual dated source captures separately exercise production pins.
  city.requirements = async () => tbgraenichenRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.36,
    longitude: 8.1,
    location_confirmed: true,
    location_label: 'Offline actual public lamp point',
    category: tbgraenichenCategories[0].service_code,
    description: 'Fictional offline nonurgent public lamp defect.',
    email: 'private@example.invalid',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      lighting_street: 'Offline lamp street 12',
      public_lamp_confirmed: 'Public lamp in Gränichen maintained by TB Gränichen confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
    { phone: '' },
    { email: '' },
    { name: 'Combined contact' },
    { category: 'Water outage' },
    { description: 'x'.repeat(5001) },
    { phone: '1'.repeat(51) },
    { extra_fields: { ...input.extra_fields, lighting_street: 'x'.repeat(256) } },
    { extra_fields: { ...input.extra_fields, last_name: 'x'.repeat(101) } },
    { extra_fields: { ...input.extra_fields, public_lamp_confirmed: 'private lamp' } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#112233' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const withoutNumber = await service.prepare(input);
  assert.equal(withoutNumber.report.extra_fields.lamp_number, undefined);
  const p = await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, lamp_number: '0007-A' },
  });
  assert.equal(p.report.extra_fields.lamp_number, '0007-A');
  assert.equal(p.report.extra_fields.last_name, 'PrivateSurname');
  assert.equal(p.report.phone, input.phone);
  assert.equal(p.attachments.length, 0);
  assert.equal(p.municipality.bfs_id, 4006);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.submission_mode, 'unverified');
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.service_id, 'tbgraenichen-defect-form');
  assert.equal(frozen.destination.bfs_id, 4006);
  assert.equal(frozen.input.extra_fields.lamp_number, '0007-A');
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(input)),
    /csrfToken|frsId|recaptcha-response|sendMailYN/,
  );
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  assert.equal((await store.receipts()).length, 0);
});
