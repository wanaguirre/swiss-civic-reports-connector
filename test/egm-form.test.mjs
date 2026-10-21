import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { egmPageFingerprint, egmSources, verifyEgmSources } from '../dist/egm-source.js';
import { egmCategories, egmRequirements } from '../dist/egm-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const fixtures = Object.fromEntries(
  await Promise.all(
    egmSources.map(async (p) => [
      p.kind,
      gunzipSync(
        await readFile(new URL(`fixtures/egm-${p.kind}.html.gz`, import.meta.url)),
      ).toString('utf8'),
    ]),
  ),
);
test('EGM full-page pins accept only shaped masked inert state; controls, scripts, privacy and mandate drift fail closed', () => {
  for (const p of egmSources) {
    const s = fixtures[p.kind];
    assert.equal(egmPageFingerprint(s, p.kind), p.sha256);
    assert.equal(egmPageFingerprint(s.replaceAll('0123456789', 'abcdef0123'), p.kind), p.sha256);
    assert.notEqual(egmPageFingerprint(s + ' ', p.kind), p.sha256);
    assert.throws(
      () => egmPageFingerprint(s.replace('value=', 'value="bad" value='), p.kind),
      /paused/,
    );
    assert.throws(() => egmPageFingerprint(' '.repeat(1000001), p.kind), /paused/);
  }
  const s = fixtures.form;
  for (const change of [
    (x) => x.replace('aria-required="true"', 'aria-required="false"'),
    (x) => x.replace('input_1.3', 'input_99'),
    (x) => x.replace('jpg,png,pdf', 'jpg,png,exe'),
    (x) => x.replace('16777216b', '33554432b'),
    (x) => x.replace('recaptcha/api.js', 'other/api.js'),
    (x) => x.replace('gf_page=', 'unsafe_page='),
  ])
    assert.notEqual(egmPageFingerprint(change(s), 'form'), egmSources[0].sha256);
  assert.notEqual(
    egmPageFingerprint(
      fixtures.identity.replace('öffentliche Beleuchtung', 'private Beleuchtung'),
      'identity',
    ),
    egmSources[1].sha256,
  );
  assert.notEqual(
    egmPageFingerprint(fixtures.privacy.replace('6.3 Online-Formulare', '6.3 Changed'), 'privacy'),
    egmSources[2].sha256,
  );
  assert.throws(() => inspectMunicipalForm('egm-muelligen', s), /complete checked/);
});
test('EGM fixed successful source verification is three paced GETs only, no challenge, upload, scripts, redirects, cookies or payload', async () => {
  let now = 0;
  const calls = [];
  const request = async (u, i) => {
    calls.push({ u, i, t: now });
    const p = egmSources.find((p) => p.url === u);
    assert.ok(p);
    return new Response(fixtures[p.kind], {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  };
  await verifyEgmSources(
    request,
    () => assert.fail(),
    () => now,
    async (ms) => {
      now += ms;
    },
  );
  assert.deepEqual(
    calls.map((c) => c.t),
    [0, 2000, 4000],
  );
  assert.deepEqual(
    calls.map((c) => c.u),
    egmSources.map((p) => p.url),
  );
  for (const c of calls) {
    assert.equal(c.i.method, 'GET');
    assert.equal(c.i.credentials, 'omit');
    assert.equal(c.i.redirect, 'error');
    assert.equal(c.i.body, undefined);
    assert.equal(c.i.signal.aborted, false);
  }
});
test('EGM source403/429 stop all instances and all pages; no automatic retry even after cooldown', async () => {
  for (const status of [403, 429]) {
    let calls = 0,
      now = 0,
      retry = 0;
    const request = async () => {
      calls++;
      return new Response('', { status, headers: { 'retry-after': '600' } });
    };
    await assert.rejects(
      verifyEgmSources(
        request,
        (ms) => (retry = ms),
        () => now,
      ),
      /paused/,
    );
    assert.equal(retry, 600000);
    now = 900000;
    await assert.rejects(
      verifyEgmSources(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 1);
  }
});
test('EGM MIME, invalidUTF8, size, redirect and late privacy change never expose preparation', async () => {
  for (const kind of ['mime', 'utf8', 'size', 'redirect', 'privacy']) {
    let calls = 0,
      now = 0;
    const request = async (u) => {
      calls++;
      const p = egmSources.find((p) => p.url === u);
      let r = new Response(fixtures[p.kind], { headers: { 'content-type': 'text/html' } });
      if (kind === 'mime')
        r = new Response('{}', { headers: { 'content-type': 'application/json' } });
      if (kind === 'utf8')
        r = new Response(new Uint8Array([0xc0, 0xaf]), {
          headers: { 'content-type': 'text/html' },
        });
      if (kind === 'size')
        r = new Response(' '.repeat(1000001), { headers: { 'content-type': 'text/html' } });
      if (kind === 'redirect') Object.defineProperty(r, 'redirected', { value: true });
      if (kind === 'privacy' && p.kind === 'privacy')
        r = new Response('changed', { headers: { 'content-type': 'text/html' } });
      return r;
    };
    await assert.rejects(
      verifyEgmSources(
        request,
        () => {},
        () => now,
        async (ms) => (now += ms),
      ),
    );
    assert.equal(calls, kind === 'privacy' ? 3 : 1);
  }
});
test('EGM exact BFS4107 gate precedes sources; metadata is GET-free, native sends and external tracking remain unavailable', async () => {
  let bfs = 4093,
    calls = 0;
  const c = new MunicipalFormClient(
    'egm-muelligen',
    async () => {
      calls++;
      return new Response('changed', { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  assert.deepEqual(await c.categories(), egmCategories);
  assert.equal(calls, 0);
  for (const id of [4093, 4100, 4095, 4034, 4045, undefined]) {
    bfs = id;
    await assert.rejects(c.requirements({ latitude: 47.452, longitude: 8.328 }), /outside/);
  }
  assert.equal(calls, 0);
  bfs = 4107;
  await assert.rejects(c.requirements({ latitude: 47.452, longitude: 8.328 }), /paused/);
  assert.equal(calls, 1);
  await assert.rejects(c.requirements({ latitude: 47.452, longitude: 8.328 }), /paused/);
  assert.equal(calls, 1);
  assert.equal(c.submissionMode, 'unverified');
  assert.equal(c.trackingSupported, false);
  assert.equal(c.fallbackPrefilled, false);
  assert.throws(
    () => new MunicipalFormClient('egm-muelligen', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(c.submit({}), /verification/);
  await assert.rejects(c.report('inert'), /unverified/);
});
test('EGM private names/email/consent separate from lamp address; no phone/postal invention or attachments, frozen destination and blocked writes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'egm-inert-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient('egm-muelligen', async () =>
    assert.fail('offline fixture never fetches'),
  );
  city.requirements = async () => egmRequirements();
  const svc = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 47.452,
    longitude: 8.328,
    location_confirmed: true,
    location_label: 'Offline lamp point',
    category: 'Defekte Lampen',
    description: 'Fictional offline defect.',
    email: 'private@example.invalid',
    photo_ids: [],
    extra_fields: {
      first_name: 'Private',
      last_name: 'Resident',
      privacy_acknowledgement: 'Official EGM privacy policy read and agreed',
      lighting_street: 'Actual lamp street',
      lighting_postcode: '5243',
      lighting_locality: 'Mülligen',
      public_lamp_confirmed: 'Public lamp in Mülligen maintained by EGM confirmed',
    },
  };
  for (const key of Object.keys(input.extra_fields)) {
    const extra_fields = { ...input.extra_fields };
    delete extra_fields[key];
    await assert.rejects(svc.prepare({ ...input, extra_fields }), new RegExp(key));
  }
  for (const change of [
    { email: '' },
    { phone: '056 000 00 00' },
    { name: 'Combined name' },
    { category: 'Water' },
    { extra_fields: { ...input.extra_fields, reporter_address: 'Invented' } },
    { extra_fields: { ...input.extra_fields, privacy_acknowledgement: 'yes' } },
  ])
    await assert.rejects(svc.prepare({ ...input, ...change }));
  const p = await svc.prepare(input);
  assert.equal(p.submission_enabled, false);
  assert.equal(p.attachments.length, 0);
  const frozen = await store.preview(p.preview_id);
  assert.equal(frozen.destination.bfs_id, 4107);
  assert.equal(frozen.destination.service_id, 'egm-muelligen-defect-form');
  assert.equal(p.report.phone, undefined);
  const q = await svc.prepare({
    ...input,
    extra_fields: { ...input.extra_fields, company: 'Optional company' },
  });
  assert.equal(q.report.extra_fields.company, 'Optional company');
  const photo = await svc.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abcdef' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    svc.prepare({ ...input, photo_ids: [photo.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  await assert.rejects(
    svc.submit(p.preview_id, p.confirmation_token, true),
    /disabled|verification/i,
  );
});
