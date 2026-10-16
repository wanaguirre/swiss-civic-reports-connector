import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  MunicipalFormClient,
  inspectMunicipalForm,
  municipalForms,
} from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const fixtures = Object.fromEntries(
  await Promise.all(
    ['ebikon', 'meggen'].map(async (n) => [
      n,
      await readFile(new URL(`fixtures/${n}-form.html`, import.meta.url), 'utf8'),
    ]),
  ),
);
const pendingId = '11111111111141118111111111111111',
  ticketId = '22222222222242228222222222222222';
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
function input(name) {
  return {
    latitude: 47.05,
    longitude: 8.37,
    location_label: 'Fictional location',
    location_confirmed: true,
    category: name === 'meggen' ? 'Meldung Sicherheitsproblem' : 'Signalisation',
    description: 'Nur ein lokaler, fiktiver Vertrags-Test.',
    email: 'fictional@example.org',
    phone: '000000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'Fictional',
      last_name: 'Resident',
      ...(name === 'meggen' ? { parcel_address: 'Fictional parcel' } : {}),
    },
  };
}
function preview(name, photo = false) {
  const i = input(name),
    bytes = Buffer.from([255, 216, 255, 217]),
    id = randomUUID();
  if (photo) i.photo_ids = [id];
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    confirmation_token: 'fictional',
    fingerprint: 'fictional',
    destination: { bfs_id: municipalForms[name].bfsId, service_id: `${name}-defect-form` },
    input: i,
    photos: photo
      ? [
          {
            id,
            jpeg: bytes.toString('base64'),
            sha256: createHash('sha256').update(bytes).digest('hex'),
          },
        ]
      : [],
  };
}
function review(name, p, origin) {
  const i = p.input;
  const pairs = [
    ['Vorname', i.extra_fields.first_name],
    ['Name', i.extra_fields.last_name],
    ['E-Mail', i.email],
    ['Telefon', i.phone],
  ];
  if (name === 'meggen')
    pairs.push(
      ['Adresse, Grundstücknummer', i.extra_fields.parcel_address],
      ['Standortbeschrieb', i.location_label],
      ['Detailbeschrieb', i.description],
    );
  else
    pairs.push(
      ['Auswahl', i.category],
      ['Beschrieb', i.extra_fields.other_damage],
      ['Strasse, Hausnummer oder genaue Beschreibung des Ortes:', i.location_label],
      ['Beschreiben Sie den Schaden möglichst genau:', i.description],
    );
  if (p.photos.length)
    pairs.push([
      name === 'meggen' ? 'Foto' : 'Ein Foto hilft uns, den Schaden zu beurteilen.',
      'civic-report.jpg (4 Bytes)',
    ]);
  return `<div class="grid-x fieldset-display">${pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<dl class="field-display"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`)
    .join(
      '',
    )}</div><form class="checkout" method="POST" action="${origin}/form-preview/${pendingId}/complete"><input type="checkbox" name="send_by_email" value="yes" checked><input type="submit" value="Abschliessen"></form>`;
}
function harness(name, p, change = {}) {
  const calls = [],
    origin = new URL(municipalForms[name].formUrl).origin,
    form = municipalForms[name].formUrl;
  let post = false;
  const request = async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Origin, origin);
    assert.equal(init.headers.Referer, form);
    if (url === form && init.method === 'GET')
      return new Response(change.initial ?? fixtures[name], {
        headers: {
          'content-type': 'text/html',
          'set-cookie': 'session=fictional; Path=/; Secure; HttpOnly',
        },
      });
    assert.equal(init.headers.Cookie, 'session=fictional');
    if (url === form && init.method === 'POST') {
      post = true;
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get('duplicate_of'), '');
      assert.match(init.body.get('csrf_token'), /^fictional/);
      assert.equal(
        init.body.get(name === 'meggen' ? 'kontaktangaben_e_mail' : 'personalien_e_mail'),
        p.input.email,
      );
      assert.equal(
        init.body.get(
          name === 'meggen'
            ? 'sicherheitsproblem_detailbeschrieb'
            : 'wo_befindet_sich_der_schaden_beschreiben_sie_den_schaden_moglichst_genau_',
        ),
        p.input.description,
      );
      const file = init.body.get(
        name === 'meggen'
          ? 'sicherheitsproblem_foto'
          : 'foto_hochladen_ein_foto_hilft_uns_den_schaden_zu_beurteilen_',
      );
      assert.equal(!!file, !!p.photos.length);
      if (file) {
        assert.equal(file.name, 'civic-report.jpg');
        assert.equal(file.type, 'image/jpeg');
        assert.deepEqual(
          Buffer.from(await file.arrayBuffer()),
          Buffer.from(p.photos[0].jpeg, 'base64'),
        );
      }
      if (change.uploadTimeout) throw new Error('Simulated timeout');
      return new Response(null, {
        status: 303,
        headers: { location: change.redirect ?? `${origin}/form-preview/${pendingId}` },
      });
    }
    if (url === `${origin}/form-preview/${pendingId}` && init.method === 'GET') {
      assert.equal(post, true);
      let value = review(name, p, origin);
      if (change.review) value = change.review(value);
      return new Response(value, { headers: { 'content-type': 'text/html' } });
    }
    if (url === `${origin}/form-preview/${pendingId}/complete` && init.method === 'POST') {
      assert.equal(init.body.toString(), '');
      if (change.finalTimeout) throw new Error('Simulated completion timeout');
      return new Response(null, {
        status: 303,
        headers: { location: `${origin}/ticket/FRM/${ticketId}/status` },
      });
    }
    if (url === `${origin}/ticket/FRM/${ticketId}/status` && init.method === 'GET')
      return new Response(
        change.receipt ??
          `<div class="ticket-number">FRM-1234-5678</div><div class="ticket-title">${name === 'meggen' ? 'Meldung Sicherheitsproblem' : 'Schaden melden'}</div><div class="ticket-state"><div class="ticket-state-open">Eingegangen</div></div>`,
        { headers: { 'content-type': 'text/html' } },
      );
    throw new Error('Unexpected request');
  };
  const city = new MunicipalFormClient(name, request, {
    experimentalSubmission: true,
    places: { municipality: async () => ({ bfs_id: municipalForms[name].bfsId }) },
  });
  // Exercise the write contract separately from the already-covered category GET/cache.
  city.requirements = async () =>
    name === 'meggen'
      ? { 'Meldung Sicherheitsproblem': rule(name) }
      : { Signalisation: rule(name), 'Anderer Schaden': rule(name) };
  return { city, calls };
}
function rule(name) {
  return {
    photo_required: false,
    phone_required: false,
    email_required: true,
    contact_fields: ['phone'],
    description_max_length: name === 'meggen' ? 5000 : 400,
    location_label_max_length: name === 'meggen' ? 250 : 150,
    max_photos: 1,
    max_photo_bytes: 5000000,
    bodies: [name],
    extra_fields: [
      { code: 'first_name', required: true, max_length: 200 },
      { code: 'last_name', required: true, max_length: 200 },
      { code: name === 'meggen' ? 'parcel_address' : 'other_damage', max_length: 250 },
    ],
  };
}
for (const name of ['ebikon', 'meggen']) {
  for (const photo of [false, true])
    test(`${name}: approved upload, exact echoed review, completion and ticket receipt stay on the official origin (${photo ? 'photo' : 'text'})`, async () => {
      const p = preview(name, photo),
        h = harness(name, p);
      assert.deepEqual(await h.city.submit(p), { state: 'accepted', report_id: ticketId });
      assert.deepEqual(
        h.calls.map((c) => c.method),
        ['GET', 'POST', 'GET', 'POST', 'GET'],
      );
      assert.equal(
        h.city.reportUrl(ticketId),
        `${new URL(municipalForms[name].formUrl).origin}/ticket/FRM/${ticketId}/status`,
      );
    });
  test(`${name}: uncertainty and mismatched echo never cause completion/replay`, async () => {
    for (const change of [
      { uploadTimeout: true },
      { redirect: 'https://attacker.invalid/form-preview/' + pendingId },
      { review: (s) => s.replace('Nur ein lokaler', 'Changed') },
      { review: (s) => s.replace('</form>', '<input name="new_required" required></form>') },
      { review: (s) => s.replace('</div>', '<div class="g-recaptcha"></div></div>') },
      { review: (s) => s.replace('civic-report.jpg', 'different.jpg') },
      { finalTimeout: true },
      { receipt: '<p>Danke</p>' },
      {
        receipt:
          '<div class="ticket-number">FRM-1234</div><div class="ticket-title">Wrong form</div><div class="ticket-state"><div class="ticket-state-open"></div></div>',
      },
    ]) {
      const p = preview(name, true),
        h = harness(name, p, change);
      assert.deepEqual(await h.city.submit(p), { state: 'unknown' });
      assert.ok(h.calls.length <= 5);
      if (change.review || change.uploadTimeout || change.redirect)
        assert.equal(h.calls.filter((c) => c.method === 'POST').length, 1);
      await assert.rejects(h.city.submit(p));
    }
  });
  test(`${name}: changed initial form, expired preview and mismatched photo/destination cannot upload`, async () => {
    for (const mutate of [
      (p) => (p.destination.bfs_id = 261),
      (p) => (p.expires_at = 'invalid'),
      (p) => (p.input.extra_fields = { first_name: 'Only' }),
      (p) => (p.photos[0].sha256 = 'wrong'),
      (p) => (p.input.photo_ids = []),
      (p) => (p.input.category = 'Unknown'),
    ]) {
      const p = preview(name, true);
      mutate(p);
      const h = harness(name, p);
      const outcome = await h.city.submit(p).catch((error) => {
        assert.ok(error instanceof Error);
        return { state: 'rejected' };
      });
      assert.deepEqual(outcome, { state: 'rejected' });
      assert.equal(h.calls.filter((c) => c.method === 'POST').length, 0);
    }
    const p = preview(name),
      h = harness(name, p, { initial: fixtures[name].replace('value="Weiter"', 'value="Send"') });
    assert.deepEqual(await h.city.submit(p), { state: 'rejected' });
    assert.equal(h.calls.length, 1);
  });
}
test('Meggen exposes one narrow class and required contact, exact boundary, no default sending', async () => {
  const p = preview('meggen');
  let bfs = 1063;
  const city = new MunicipalFormClient(
    'meggen',
    async () => new Response(fixtures.meggen, { headers: { 'content-type': 'text/html' } }),
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  assert.equal(city.submissionMode, 'unverified');
  await assert.rejects(city.submit(p), /verification/);
  assert.deepEqual(await city.categories(), [
    { service_code: 'sicherheitsproblem', service_name: 'Meldung Sicherheitsproblem' },
  ]);
  const rules = await city.requirements(p.input);
  assert.equal(rules[p.input.category].max_photos, 1);
  assert.equal(rules[p.input.category].extra_fields.filter((f) => f.required).length, 2);
  assert.match(city.guidance.scope, /not general complaints/);
  bfs = 261;
  await assert.rejects(city.requirements(p.input), /outside/);
  for (const html of [
    fixtures.meggen.replace('name="kontaktangaben_name"', 'name="unexpected"'),
    fixtures.meggen.replace('</form>', '<div class="captcha"></div></form>'),
  ])
    assert.throws(() => inspectMunicipalForm('meggen', html));
  assert.throws(() => new MunicipalFormClient('bern', fetch, { experimentalSubmission: true }));
});
test('OneGov goes through durable approval and cannot replay a timed-out completion', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-onegov-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const p = preview('meggen'),
    h = harness('meggen', p, { finalTimeout: true }),
    service = new ReportService(h.city, store, { submissionEnabled: true, allowPaths: false });
  const draft = await service.prepare(p.input);
  await assert.rejects(service.submit(draft.preview_id, draft.confirmation_token, false));
  assert.equal(h.calls.length, 0);
  const result = await service.submit(draft.preview_id, draft.confirmation_token, true);
  assert.equal(result.state, 'unknown');
  const count = h.calls.length;
  const again = await service.submit(draft.preview_id, draft.confirmation_token, true);
  assert.equal(again.state, 'unknown');
  assert.equal(h.calls.length, count);
});

test('OneGov respects long provider Retry-After and discards foreign cookies before any upload', async () => {
  for (const status of [429, 503]) {
    let now = Date.now(),
      calls = 0;
    const city = new MunicipalFormClient(
      'meggen',
      async () => {
        calls++;
        return new Response('Paused', {
          status,
          headers: { 'retry-after': '3600', 'content-type': 'text/html' },
        });
      },
      { experimentalSubmission: true, now: () => now },
    );
    city.requirements = async () => ({ 'Meldung Sicherheitsproblem': rule('meggen') });
    assert.deepEqual(await city.submit(preview('meggen')), { state: 'rejected' });
    now += 600000;
    await assert.rejects(city.submit(preview('meggen')));
    assert.equal(calls, 1);
  }
  let calls = 0,
    cancelled = false;
  const city = new MunicipalFormClient(
    'meggen',
    async () => {
      calls++;
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        {
          headers: {
            'content-type': 'text/html',
            'set-cookie': 'session=value; Domain=foreign.invalid; Path=/',
          },
        },
      );
    },
    { experimentalSubmission: true },
  );
  city.requirements = async () => ({ 'Meldung Sicherheitsproblem': rule('meggen') });
  assert.deepEqual(await city.submit(preview('meggen')), { state: 'rejected' });
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
});
