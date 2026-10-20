import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectTbwForm,
  fingerprintTbwForm,
  tbwCategories,
  tbwRequirements,
  tbwCategory,
  verifyTbwSources,
  assertTbwSourcesAvailable,
} from '../dist/tbw-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const html = await readFile(new URL('./fixtures/tbw.html', import.meta.url), 'utf8');
test('TBW captured full form and all scripts recognize only preparation contract, without executing native state', () => {
  assert.deepEqual(inspectTbwForm(html), tbwCategories);
  assert.doesNotMatch(html, /TzozOToiVFlQT/);
  const rotated = html
    .replaceAll('OFFLINE-OPAQUE-NOT-USABLE', 'DIFFERENT-OPAQUE-OFFLINE')
    .replaceAll('UJvhQH40pCxybLWPEjMt', 'ABCDEFGHIJKLMNOPQRST');
  assert.deepEqual(fingerprintTbwForm(rotated), fingerprintTbwForm(html));
});
test('TBW contract fails closed on mandatory mobile drift, optional phone drift, script, upload, external controls and trap changes', () => {
  for (const changed of [
    html.replace('name="tx_form_formframework[kontakt-715][telephone-1]"', 'name="changed"'),
    html.replace(
      'id="kontakt-715-telephone-2"',
      'required="required" id="kontakt-715-telephone-2"',
    ),
    html.replace('id="kontakt-715-telephone-1"', 'id="kontakt-715-telephone-1" type="file"'),
    html.replace('tabindex="-1"', 'tabindex="0"'),
    html.replace('main.js?1785307871', 'other.js'),
    html + '<script>newCode()</script>',
    html + '<input form="kontakt-715">',
    html + 'captcha',
    html + '<div class="js-koch-component" data-modules="ajax-submit"></div>',
    html.replace('data-modules="panel"', 'data-modules="ajax-submit"'),
  ])
    assert.throws(() => inspectTbwForm(changed), /paused/);
});
test('TBW private mobile is mandatory; private phone and postbox optional; no photos; all contacts remain private', () => {
  const r = tbwRequirements()[tbwCategory];
  assert.equal(r.phone_required, false);
  assert.equal(r.email_required, true);
  assert.equal(r.max_photos, 0);
  for (const code of [
    'salutation',
    'first_name',
    'last_name',
    'reporter_street',
    'contact_postcode',
    'contact_locality',
    'contact_mobile_phone',
    'privacy_acknowledgement',
  ]) {
    const f = r.extra_fields.find((f) => f.code === code);
    assert.equal(f.required, true, code);
    assert.equal(f.contact, true, code);
  }
  assert.equal(r.extra_fields.find((f) => f.code === 'contact_postbox').required, false);
  assert.match(r.scope, /4946/);
  assert.match(r.scope, /00:15/);
});
test('TBW failed source permanently stops shared context and all later peers before new reads', async () => {
  for (const status of [403, 429, 302, 200]) {
    let calls = 0;
    const request = async () => {
      calls++;
      return new Response('changed', {
        status,
        headers: { 'content-type': status === 200 ? 'application/json' : 'text/html' },
      });
    };
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    assert.throws(() => assertTbwSourcesAvailable(request), /paused/);
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    assert.equal(calls, 1);
  }
});
test('Municipal TBW Weinfelden metadata is read-free, exact TBW Weinfelden gate precedes reads, sending and native fallback remain unavailable', async () => {
  let bfs = 4208;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return new Response('source drift', { headers: { 'content-type': 'text/html' } });
  };
  const city = new MunicipalFormClient('tbw-weinfelden', request, {
    places: { municipality: async () => ({ bfs_id: bfs }) },
  });
  assert.deepEqual(await city.categories(), tbwCategories);
  for (const other of [4208, 4209, 4145, 261]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 47.566, longitude: 9.108 }), /outside/);
  }
  assert.equal(calls.length, 0);
  bfs = 4946;
  await assert.rejects(city.requirements({ latitude: 47.566, longitude: 9.108 }), /paused/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /kontakt/);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.fallbackPrefilled, false);
  assert.equal(city.trackingSupported, false);
  assert.throws(() => inspectMunicipalForm('tbw-weinfelden', '<form/>'), /complete pinned/);
  assert.throws(
    () =>
      new MunicipalFormClient('tbw-weinfelden', request, {
        experimentalSubmission: true,
      }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Municipal TBW Weinfelden 403/429 and malformed sources stop shared request context before another client cached requirements', async () => {
  for (const status of [403, 429, 302, 200]) {
    let count = 0;
    const request = async () => {
      count++;
      return new Response('changed', {
        status,
        headers: { 'content-type': status === 200 ? 'application/json' : 'text/html' },
      });
    };
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    const city = new MunicipalFormClient('tbw-weinfelden', request, {
      places: { municipality: async () => ({ bfs_id: 4946 }) },
    });
    city.cached = { value: tbwCategories, expires: Date.now() + 60_000 };
    await assert.rejects(city.requirements({ latitude: 47.566, longitude: 9.108 }), /paused/);
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
  }
});

test('Municipal TBW Weinfelden text preparation keeps required mobile and optional contacts separate, rejects foreign fields and photos, freezes destination and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'diessenhofen-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'tbw-weinfelden',
    async () => assert.fail('offline rule double must not fetch'),
    { places: { municipality: async () => ({ bfs_id: 4946 }) } },
  );
  city.requirements = async () => tbwRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.566,
    longitude: 9.108,
    location_confirmed: true,
    location_label: 'Offline actual TBW Weinfelden lamp',
    category: tbwCategory,
    description: 'Fictional offline lamp defect.',
    email: 'private@example.invalid',
    phone: '+41 62 000 00 00',
    photo_ids: [],
    extra_fields: {
      first_name: 'Private',
      last_name: 'Fullname',
      reporter_street: 'PrivateStreet',
      salutation: 'Frau',
      contact_mobile_phone: '+41 79 000 00 00',
      contact_postbox: 'PrivatePostbox',
      contact_postcode: '4324',
      contact_locality: 'PrivateTown',
      privacy_acknowledgement: 'TBW privacy policy read and understood',
      public_lamp_confirmed: 'TBW-maintained city streetlight in Weinfelden confirmed',
      outside_shutdown_confirmed: 'Unlit lamp observed outside normal 00:15–05:15 shutdown',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    if (key === 'contact_postbox') continue;
    delete extra_fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
    { email: '' },
    { name: 'Combined Name' },
    { category: 'Stromausfall' },
    { category: 'Zähler ablesen' },
    { description: 'x'.repeat(4001) },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, kunden_nr: 'foreign-field' },
    }),
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.photo_id] }), /photo/);
  const optional = { ...input, phone: '', extra_fields: { ...input.extra_fields } };
  delete optional.extra_fields.contact_postbox;
  await service.prepare(optional);
  // Native postcode is free text, unlike Diessenhofen's native numeric format.
  await service.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, contact_postcode: 'CH-8570' },
  });
  for (const code of ['contact_mobile_phone', 'reporter_street'])
    await assert.rejects(
      service.prepare({
        ...input,
        extra_fields: { ...input.extra_fields, [code]: 'x'.repeat(251) },
      }),
    );
  const preview = await service.prepare(input);
  assert.equal(preview.report.extra_fields.first_name, 'Private');
  assert.equal(preview.report.email, 'private@example.invalid');
  assert.equal(preview.submission_enabled, false);
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, {
    bfs_id: 4946,
    service_id: 'tbw-weinfelden-defect-form',
  });
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /disabled|verification/i,
  );
});
