import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  fingerprintTbsForm,
  inspectTbsForm,
  tbsRequirements,
  tbsCategory,
  tbsFormUrl,
  tbsSources,
} from '../dist/tbs-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
// Independently authored markup; no provider client/prose or actual read-time state.
const html = `<div class="form-builder js-form-builder"><form method="POST"><input name="formId" value="11" type="hidden"><input class="cffp_mm" name="formfield0000000001" type="hidden" value=""><input class="cffp_kp" name="formfield0000000002" type="hidden" value=""><input name="formfield0000000003" type="hidden" value="1700000000000"><input id="cffp_ef" name="formfield0000000004" type="text" value=""><input name="token" type="hidden" value="${'A'.repeat(64)}"><input name="submitionKey" type="hidden" value="${'B'.repeat(24)}"><input name="firstname" required><input name="street1" required><input type="date" name="Datum" required><input type="time" name="Zeit" required></form><script>/* independently authored validation fixture */</script></div><script src="/offline.js"></script>`;
test('TBS fingerprints the full builder and all scripts, discarding shaped technical state without executing or simulating it', () => {
  const pin = fingerprintTbsForm(html);
  let rotated = html
    .replace('A'.repeat(64), 'C'.repeat(64))
    .replace('B'.repeat(24), 'D'.repeat(24))
    .replace('1700000000000', '1800000000000');
  for (let i = 1; i <= 4; i++)
    rotated = rotated.replace('formfield000000000' + i, 'formfield111111111' + i);
  assert.deepEqual(fingerprintTbsForm(rotated), pin);
  for (const x of [
    html + html,
    html.replace('1700000000000', 'bad'),
    html.replace('A'.repeat(64), 'invalid'),
    html.replace('B'.repeat(24), 'short'),
    html.replace('id="cffp_ef"', 'id="other"'),
    html.replace('class="cffp_mm"', 'class="changed"'),
    html.replace('formfield0000000004', 'formfield0000000001'),
    html.replace(
      'id="cffp_ef" name="formfield0000000004" type="text" value=""',
      'id="cffp_ef" name="formfield0000000004" type="text" value="filled"',
    ),
    html + '<input form="foreign" name="injected">',
  ])
    assert.throws(() => fingerprintTbsForm(x), /changed/);
  for (const x of [
    html.replace('name="street1" required', 'name="street1"'),
    html.replace('POST', 'GET'),
    html.replace('name="firstname"', 'name="private_name"'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('validation fixture', 'changed native rules'),
    html.replace('/offline.js', '/changed.js'),
    html + '<script>/* added */</script>',
  ]) {
    assert.notEqual(x, html);
    assert.notDeepEqual(fingerprintTbsForm(x), pin);
    assert.throws(() => inspectTbsForm(x), /changed/);
  }
  assert.throws(() => fingerprintTbsForm(html + '<div class="g-recaptcha"></div>'), /changed/);
  assert.throws(() => fingerprintTbsForm('x'.repeat(1_000_001)), /changed/);
  assert.throws(
    () => inspectTbsForm(html),
    /changed/,
    'own fixture deliberately differs from the production pin',
  );
  assert.ok(Object.isFrozen(tbsSources) && tbsSources.every(Object.isFrozen));
});
test('TBS exact Suhr gate precedes all GETs, respects provider cooldown and leaves sending unavailable', async () => {
  let bfs = 4009,
    now = 0;
  const calls = [];
  const city = new MunicipalFormClient(
    'tbs-suhr',
    async (url, init) => {
      calls.push([String(url), init]);
      return new Response('', { status: 429, headers: { 'retry-after': '600' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.372, longitude: 8.079 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 4012;
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
        u === tbsFormUrl &&
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
    const c = new MunicipalFormClient(
      'tbs-suhr',
      async () => {
        count++;
        return make();
      },
      { places: { municipality: async () => ({ bfs_id: 4012 }) } },
    );
    await assert.rejects(c.requirements(point), /changed/);
    await assert.rejects(c.requirements(point), /changed/);
    assert.equal(count, 1);
  }
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.termsUrl, undefined);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('tbs-suhr', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('TBS preview separates private reporter addresses from the fault, requires real date/time and bounded postcodes, excludes photos and all sending', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-tbs-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir, () => Date.parse('2026-10-19T00:00:00Z'));
  await store.initialize();
  const city = new MunicipalFormClient(
    'tbs-suhr',
    async () => assert.fail('rule double must not access network'),
    { places: { municipality: async () => ({ bfs_id: 4012 }) } },
  );
  // Production source pins are checked separately with the actual dated captures.
  city.requirements = async () => tbsRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.372,
    longitude: 8.079,
    location_confirmed: true,
    location_label: 'Offline actual Suhr public lamp',
    category: tbsCategory,
    description: 'Fictional offline public lamp fault.',
    email: 'private@example.invalid',
    phone: '0620000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateSurname',
      reporter_street: 'PrivateResidenceStreet',
      contact_postcode: '5034',
      contact_locality: 'PrivateTown',
      contact_method: 'viaE-Mail',
      lighting_street: 'OfflineLampStreet',
      lighting_postcode: '5034',
      lighting_locality: 'Suhr',
      fault_date: '2024-02-29',
      fault_time: '21:45',
      priority: 'Niedrig',
      public_lamp_confirmed: 'Public lamp in Suhr maintained by TBS confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const [key, values] of Object.entries({
    fault_time: ['24:00', '12:60', '1:00', '12:00:00', 'noon', '00:00Z'],
    fault_date: ['2026-02-29', '2024-02-30', '2026-10-20'],
    contact_postcode: ['0', '999', '0000', '01234', '100000', 'abcd'],
    lighting_postcode: ['999', '0000', '100000'],
    priority: ['Hoch'],
    contact_method: ['automatic'],
    public_lamp_confirmed: ['private lamp'],
  }))
    for (const v of values)
      await assert.rejects(
        service.prepare({ ...input, extra_fields: { ...input.extra_fields, [key]: v } }),
        undefined,
        `${key}:${v}`,
      );
  for (const time of ['00:00', '23:59'])
    await service.prepare({ ...input, extra_fields: { ...input.extra_fields, fault_time: time } });
  for (const postcode of ['1000', '99999'])
    await service.prepare({
      ...input,
      extra_fields: {
        ...input.extra_fields,
        contact_postcode: postcode,
        lighting_postcode: postcode,
      },
    });
  for (const change of [
    { phone: '' },
    { email: '' },
    { name: 'Combined name' },
    { category: 'Wasser' },
    { phone: '1'.repeat(51) },
    { description: 'x'.repeat(5001) },
    { extra_fields: { ...input.extra_fields, reporter_street: 'x'.repeat(251) } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  const p = await service.prepare(input);
  assert.equal(p.report.extra_fields.contact_house_number, undefined);
  assert.equal(p.report.extra_fields.lighting_house_number, undefined);
  assert.equal(p.report.extra_fields.reporter_street, 'PrivateResidenceStreet');
  assert.equal(p.report.extra_fields.lighting_street, 'OfflineLampStreet');
  assert.equal(p.report.extra_fields.fault_time, '21:45');
  assert.equal(p.attachments.length, 0);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.municipality.bfs_id, 4012);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.service_id, 'tbs-suhr-defect-form');
  assert.equal(frozen.input.extra_fields.contact_method, 'viaE-Mail');
  assert.doesNotMatch(
    JSON.stringify(await city.requirements(input)),
    /submitionKey|formfield|cffp|dispatcher/,
  );
  await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  assert.equal((await store.receipts()).length, 0);
});
