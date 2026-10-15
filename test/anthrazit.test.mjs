import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { AnthrazitClient, anthrazitTenants } from '../dist/anthrazit.js';
import { CityClient } from '../dist/city.js';
import { ReportService } from '../dist/service.js';
import { Store, fingerprint } from '../dist/store.js';
import { hash } from '../dist/photos.js';

// Minimal reconstructions of inspected form contracts (2026-10-15), not recordings
// of successful uploads/sends. All report content and transport outcomes below are synthetic.
const escape = (v) =>
  String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const input = (name, type = 'hidden', value = '') =>
  `<input name="${name}" type="${type}" value="${escape(value)}">`;
const pageForm = (tenant, step, html) =>
  `<form method="POST" enctype="multipart/form-data" action="/index.php?apid=${tenant.apid}&do=add&step=${step}">${input('stepback')}${html}</form>`;
const next = input('submit', 'submit', 'Weiter');
const record = (name = 'winterthur') => ({
  latitude: Number(anthrazitTenants[name].clat),
  longitude: Number(anthrazitTenants[name].clong),
  location_label: 'Synthetic issue location',
  location_confirmed: true,
  category:
    name === 'winterthur'
      ? 'Abfall/Sammelstellen'
      : name === 'schlieren'
        ? 'Abfallentsorgung'
        : 'Abfall',
  description: 'Synthetic report: a damaged bin.',
  email: 'test@example.org',
  ...(['winterthur', 'schlieren'].includes(name)
    ? { name: 'Test person', phone: '+41 00 000 00 00' }
    : {}),
  photo_ids: [],
  extra_fields: {
    report_title: 'Synthetic title',
    street: 'Synthetic street',
    postcode: '0000',
    place: 'Synthetic locality',
  },
});
function fixture(tenant, step, saved = {}) {
  if (step === 2)
    return pageForm(
      tenant,
      2,
      input('foo', 'search') +
        input('latitude') +
        input('longitude') +
        (tenant.deviceCoordinates ? input('devicecoords[lat]') + input('devicecoords[long]') : '') +
        next,
    );
  if (step === 3)
    return (
      pageForm(
        tenant,
        3,
        `${saved.image ? '<div class="wrapperImages"><div class="image"><img src="/synthetic.jpg"></div></div>' : ''}${next}${input('submit', 'submit', 'autosubmit')}`,
      ) +
      `<script>new Dropzone('div#dropzone',{url:'/appl/api.php?do=userContentHandleImageUpload&usmid=${tenant.usmid}&usid=${tenant.usid}&outputType=json',paramName:'img',maxFiles:1,maxFilesize:15});</script>`
    );
  if (step === 4)
    return pageForm(
      tenant,
      4,
      `${input('objekttitel', 'text')}<textarea name="objekttext"></textarea>${input('addresse1', 'text', 'Unapproved default street')}${input('plz', 'text', '9999')}${input('ort', 'text', 'Default town')}${tenant.contactText ? '<textarea name="telefon"></textarea>' : ''}${input('email', 'email')}${input('notification', 'checkbox', '1')}${next}`,
    );
  if (step === 5)
    return pageForm(
      tenant,
      5,
      `<p>${escape(saved.objekttitel ?? '')} ${escape(saved.objekttext ?? '')} ${tenant.bfsId === 230 ? 'Abfall/Sammelstellen' : 'Abfall'}</p><a href="/index.php?apid=${tenant.terms}">Terms</a><input type="submit" value="Absenden">${input('proceed', 'hidden', tenant.proceed)}`,
    );
  throw new Error('Unexpected fixture step');
}
async function setup(
  t,
  {
    name = 'winterthur',
    enabled = true,
    experimental = true,
    mutate,
    handle,
    bfs,
    locationResult,
  } = {},
) {
  const tenant = anthrazitTenants[name];
  const calls = [];
  const sessions = new Map();
  const dir = await mkdtemp(join(tmpdir(), 'civic-anthrazit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  let count = 0;
  const request = async (raw, init = {}) => {
    const url = new URL(raw);
    const method = init.method ?? 'GET';
    const cookie = init.headers?.Cookie;
    calls.push({ url, method, init });
    assert.equal(url.origin, tenant.origin);
    assert.equal(init.redirect, 'manual');
    if (method === 'POST') {
      const receipts = await store.receipts();
      assert.equal(receipts.length, 1, 'durable claim precedes location, upload, details and send');
      assert.equal(receipts[0].state, 'sending');
      assert.equal(receipts[0].tracking_available, false);
    }
    const custom = await handle?.(url, init);
    if (custom) return custom;
    if (url.searchParams.get('do') === 'usercontentCheckRadius')
      return Response.json(
        locationResult ??
          (name === 'stgallen'
            ? { inbfs: true }
            : name === 'schaffhausen'
              ? { distance: 0 }
              : { msg: '' }),
      );
    if (!url.searchParams.has('step') && url.pathname === '/index.php') {
      assert.equal(cookie, undefined, 'each operation starts with an isolated anonymous jar');
      const id = String(++count);
      sessions.set(`PHPSESSID=${id}`, {});
      return new Response(
        `<div id="catSelect"><div class="theRow" data-action="/index.php?apid=${tenant.apid}&do=add&step=1&rid=${name === 'winterthur' ? '1456260331' : '9111504'}"><div class="td colDescription">${record(name).category}</div></div></div>`,
        { headers: { 'set-cookie': `PHPSESSID=${id}; Path=/; Secure; HttpOnly` } },
      );
    }
    const saved = sessions.get(cookie);
    assert.ok(saved, 'wizard reuses its own session');
    if (url.searchParams.get('do') === 'userContentHandleImageUpload') {
      assert.equal(method, 'POST');
      assert.equal(url.searchParams.get('usmid'), tenant.usmid);
      assert.equal(url.searchParams.get('usid'), tenant.usid);
      const photo = init.body.get('img');
      assert.equal(photo.type, 'image/jpeg');
      assert.equal(photo.name, 'report.jpg');
      assert.equal([...init.body.keys()].length, 1);
      saved.image = true;
      return Response.json({ error: '' });
    }
    const step = Number(url.searchParams.get('step'));
    if (step === 1 || (method === 'POST' && step < 5)) {
      if (method === 'POST') Object.assign(saved, Object.fromEntries(init.body));
      return new Response(null, {
        status: 303,
        headers: { location: `/index.php?apid=${tenant.apid}&do=add&step=${step + 1}` },
      });
    }
    if (method === 'POST' && step === 5) {
      assert.deepEqual(Object.fromEntries(init.body), { stepback: '', proceed: tenant.proceed });
      return new Response(
        '<p>Synthetic response, deliberately not an evidenced success marker.</p>',
      );
    }
    const html = fixture(tenant, step, saved);
    return new Response(mutate?.(step, html, saved) ?? html);
  };
  const city = new AnthrazitClient(name, request, {
    experimentalSubmission: experimental,
    places: {
      municipality: async () => ({
        bfs_id: bfs ?? tenant.bfsId,
        name: tenant.municipality,
        canton: 'ZH',
      }),
    },
  });
  const service = new ReportService(city, store, { submissionEnabled: enabled, allowPaths: false });
  return {
    city,
    service,
    store,
    dir,
    calls,
    request,
    posts: () => calls.filter((c) => c.method === 'POST'),
  };
}
const send = (f, p, terms = p.terms_url) =>
  f.service.submit(p.preview_id, p.confirmation_token, true, terms);

for (const name of ['winterthur', 'schlieren', 'stgallen', 'schaffhausen'])
  test(`${name}: live-shaped categories, exact BFS and radius rules; preparation never uploads`, async (t) => {
    const f = await setup(t, { name });
    const p = await f.service.prepare(record(name));
    assert.equal(p.municipality.bfs_id, anthrazitTenants[name].bfsId);
    assert.equal(p.submission_enabled, name !== 'schlieren');
    assert.equal(p.fallback_prefilled, false);
    assert.equal(p.duplicate_search_available, false);
    assert.equal(p.requirements.max_photos, 1);
    assert.equal(f.posts().length, 0);
    assert.match(p.nearby_reports.coverage, /unavailable/);
    const stored = await f.store.preview(p.preview_id);
    assert.equal(stored.destination.service_id, `anthrazit-${f.city.bfsId}`);
    const radius = f.calls.find((c) => c.url.pathname === '/appl/api.php').url;
    assert.equal(radius.searchParams.get('lat'), String(record(name).latitude));
    assert.equal(radius.searchParams.get('usid'), anthrazitTenants[name].usid);
  });
test('Winterthur writes are opt-in; Schlieren cannot be enabled while final guest flow is unverified', async (t) => {
  for (const opts of [
    { experimental: false },
    { enabled: false },
    { name: 'schlieren' },
    { name: 'stgallen', experimental: false },
    { name: 'schaffhausen', experimental: false },
  ]) {
    const f = await setup(t, opts);
    const p = await f.service.prepare(record(opts.name));
    await assert.rejects(() => send(f, p), /disabled|unavailable/);
    assert.equal(f.posts().length, 0);
    assert.equal((await f.store.receipts()).length, 0);
  }
});
test('required title, notification choice, unknown extras and exact municipality are validated', async (t) => {
  const f = await setup(t);
  for (const extra of [
    {},
    { report_title: 'x'.repeat(101) },
    { report_title: 'Title', notify_updates: 'maybe' },
    { report_title: 'Title', proceed: '1' },
  ])
    await assert.rejects(() => f.service.prepare({ ...record(), extra_fields: extra }));
  const wrong = await setup(t, { bfs: 261 });
  await assert.rejects(() => wrong.service.prepare(record()), /outside/);
  assert.equal(wrong.calls.length, 0);
  const invalid = await setup(t, { locationResult: { msg: 'outside' } });
  await assert.rejects(() => invalid.service.prepare(record()), /location check/);
  assert.equal(f.posts().length, 0);
});
test('explicit preview approval and matching terms are required before any municipal POST', async (t) => {
  const f = await setup(t);
  const p = await f.service.prepare(record());
  await assert.rejects(
    () => f.service.submit(p.preview_id, p.confirmation_token, false, p.terms_url),
    /Explicit approval/,
  );
  await assert.rejects(() => send(f, p, 'https://example.org/wrong'), /acceptance/);
  await assert.rejects(
    () => f.service.submit(p.preview_id, p.confirmation_token, true),
    /acceptance/,
  );
  assert.equal(f.posts().length, 0);
  assert.equal((await f.store.receipts()).length, 0);
});
test('full mocked Winterthur wizard sends exact approved fields once and records unknown, never inferred acceptance', async (t) => {
  const f = await setup(t);
  const p = await f.service.prepare(record());
  const receipt = await send(f, p);
  assert.equal(receipt.state, 'unknown');
  assert.equal(receipt.tracking_available, false);
  assert.equal(receipt.destination.bfs_id, 230);
  assert.equal(receipt.report_id, undefined);
  assert.deepEqual(
    f.posts().map((c) => c.url.searchParams.get('step')),
    ['2', '3', '4', '5'],
  );
  const details = Object.fromEntries(f.posts()[2].init.body);
  assert.deepEqual(details, {
    stepback: '',
    objekttitel: record().extra_fields.report_title,
    objekttext: record().description,
    addresse1: 'Synthetic street',
    plz: '0000',
    ort: 'Synthetic locality',
    telefon: 'Test person\n+41 00 000 00 00',
    email: 'test@example.org',
    submit: 'Weiter',
  });
  const again = await f.service.prepare(record());
  const repeated = await send(f, again);
  assert.equal(repeated.already_attempted, true);
  assert.equal(f.posts().length, 4);
  const restarted = new ReportService(f.city, new Store(f.dir), {
    submissionEnabled: true,
    allowPaths: false,
  });
  assert.equal(
    (await restarted.submit(p.preview_id, p.confirmation_token, true, p.terms_url))
      .already_attempted,
    true,
  );
  await f.service.receipts(true);
  assert.equal(f.posts().length, 4);
});
test('approved normalized photo uploads once after claim; notifications only with explicit yes', async (t) => {
  const f = await setup(t);
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = await f.service.inspectPhoto({ base64: bytes.toString('base64') });
  const r = {
    ...record(),
    photo_ids: [photo.metadata.id],
    extra_fields: { report_title: 'Synthetic title', notify_updates: 'yes' },
  };
  const p = await f.service.prepare(r);
  assert.equal(f.posts().length, 0);
  await send(f, p);
  assert.equal(
    f.posts().filter((c) => c.url.searchParams.get('do') === 'userContentHandleImageUpload').length,
    1,
  );
  const details = Object.fromEntries(
    f.posts().find((c) => c.url.searchParams.get('step') === '4').init.body,
  );
  assert.equal(details.notification, '1');
  assert.equal(details.addresse1, '');
  assert.equal(details.plz, '');
  assert.equal(details.ort, '');
  const uploaded = f
    .posts()
    .find((c) => c.url.pathname === '/appl/api.php')
    .init.body.get('img');
  assert.equal(
    hash(Buffer.from(await uploaded.arrayBuffer())),
    (await f.store.preview(p.preview_id)).photos[0].sha256,
  );
  const second = await f.service.inspectPhoto({ base64: bytes.toString('base64') });
  await assert.rejects(
    () => f.service.prepare({ ...r, photo_ids: [photo.metadata.id, second.metadata.id] }),
    /at most 1/,
  );
});
for (const [name, change] of [
  [
    'unknown details field',
    (step, html) =>
      step === 4 ? html.replace('</form>', input('new_required') + '</form>') : html,
  ],
  [
    'login at final step',
    (step, html) =>
      step === 5 ? '<form id="loginRegForm"><input type="password" name="pwd"></form>' : html,
  ],
  [
    'changed preview',
    (step, html) => (step === 5 ? html.replace('Synthetic title', 'Changed title') : html),
  ],
  ['changed terms', (step, html) => (step === 5 ? html.replace('1873279288', '1234') : html)],
  [
    'validation error',
    (step, html) => (step === 5 ? '<div class="elementAlert">Error</div>' + html : html),
  ],
])
  test(`${name} stops before the final POST and preserves the no-replay claim`, async (t) => {
    const f = await setup(t, { mutate: change });
    const p = await f.service.prepare(record());
    const result = await send(f, p);
    assert.equal(result.state, 'unknown');
    assert.equal(
      f.posts().some((c) => c.url.searchParams.get('step') === '5'),
      false,
    );
    const count = f.posts().length;
    await send(f, p);
    assert.equal(f.posts().length, count);
  });
for (const status of [302, 307])
  test(`redirect ${status} cannot leak approved payload or replay a POST`, async (t) => {
    const f = await setup(t, {
      handle: (url, init) =>
        init.method === 'POST' && url.searchParams.get('step') === '4'
          ? new Response(null, {
              status,
              headers: { location: status === 302 ? 'https://example.org/steal' : url.href },
            })
          : undefined,
    });
    const p = await f.service.prepare(record());
    assert.equal((await send(f, p)).state, 'unknown');
    assert.equal(f.posts().length, 3);
  });
test('a final redirect is not followed or interpreted as acceptance', async (t) => {
  const f = await setup(t, {
    handle: (url, init) =>
      init.method === 'POST' && url.searchParams.get('step') === '5'
        ? new Response(null, { status: 302, headers: { location: 'https://example.org/success' } })
        : undefined,
  });
  const p = await f.service.prepare(record());
  assert.equal((await send(f, p)).state, 'unknown');
  assert.equal(f.posts().length, 4);
});
test('upload errors cannot advance to details or send', async (t) => {
  const f = await setup(t, {
    handle: (url) =>
      url.searchParams.get('do') === 'userContentHandleImageUpload'
        ? Response.json({ error: 'Synthetic upload failure' })
        : undefined,
  });
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = await f.service.inspectPhoto({ base64: bytes.toString('base64') });
  const p = await f.service.prepare({ ...record(), photo_ids: [photo.metadata.id] });
  assert.equal((await send(f, p)).state, 'unknown');
  assert.equal(f.posts().length, 2);
});
test('destinations isolate hashes, wrong-city sends, receipt linking and translation', async (t) => {
  const f = await setup(t);
  const p = await f.service.prepare(record());
  const zurich = new ReportService(
    new CityClient(() => {
      throw new Error('Must not contact Zürich');
    }),
    f.store,
    { submissionEnabled: true, allowPaths: false },
  );
  await assert.rejects(
    () => zurich.submit(p.preview_id, p.confirmation_token, true),
    /different municipality/,
  );
  await send(f, p);
  const receipt = (await f.store.receipts())[0];
  await assert.rejects(() => zurich.linkReport(receipt.fingerprint, '1234'), /not found/);
  await assert.rejects(() => zurich.translateReceipt(receipt.fingerprint, 'en'), /not found/);
  await assert.rejects(() => f.service.linkReport(receipt.fingerprint, '1234'), /unavailable/);
  const legacy = fingerprint(record(), []);
  const { photo_ids: _, ...fields } = record();
  assert.equal(
    legacy,
    hash(
      JSON.stringify({
        input: {
          ...fields,
          extra_fields: Object.fromEntries(
            Object.entries(fields.extra_fields).sort(([a], [b]) => a.localeCompare(b)),
          ),
        },
        photos: [],
      }),
    ),
  );
  assert.notEqual(legacy, fingerprint(record(), [], { bfs_id: 230, service_id: 'anthrazit-230' }));
  assert.notEqual(
    fingerprint(record(), [], { bfs_id: 247, service_id: 'anthrazit-247' }),
    receipt.fingerprint,
  );
});
test('terms are immutable approval data but cannot reset duplicate identity', async (t) => {
  const f = await setup(t);
  const p = await f.service.prepare(record());
  const original = await f.store.preview(p.preview_id);
  const changed = await f.store.prepare(
    original.input,
    [],
    original.destination,
    'https://example.org/updated-terms',
  );
  assert.equal(original.fingerprint, changed.fingerprint);
  assert.notEqual(original.approval_fingerprint, changed.approval_fingerprint);
  const path = join(f.dir, `preview-${p.preview_id}.json`);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  saved.terms_url = 'https://example.org/tampered';
  await writeFile(path, JSON.stringify(saved));
  await assert.rejects(() => send(f, p), /integrity/);
  assert.equal(f.posts().length, 0);
});

test('final timeout is never retried, including through an equivalent fresh preview', async (t) => {
  const f = await setup(t, {
    handle: (url, init) => {
      if (init.method === 'POST' && url.searchParams.get('step') === '5')
        throw new Error('Synthetic timeout after possible acceptance');
    },
  });
  const p = await f.service.prepare(record());
  assert.equal((await send(f, p)).state, 'unknown');
  const next = await f.service.prepare(record());
  assert.equal((await send(f, next)).already_attempted, true);
  assert.equal(f.posts().filter((c) => c.url.searchParams.get('step') === '5').length, 1);
});

test('duplicate form controls and a foreign form action fail closed', async (t) => {
  for (const mutate of [
    (step, html) => (step === 2 ? html.replace('</form>', input('latitude') + '</form>') : html),
    (step, html) =>
      step === 4
        ? html.replace('action="/index.php', 'action="https://example.org/index.php')
        : html,
  ]) {
    const f = await setup(t, { mutate });
    const p = await f.service.prepare(record());
    assert.equal((await send(f, p)).state, 'unknown');
    assert.equal(
      f.posts().some((c) => c.url.searchParams.get('step') === '4'),
      false,
    );
  }
});

test('an upload JSON response without the staged image does not authorize sending', async (t) => {
  const f = await setup(t, {
    handle: (url) =>
      url.searchParams.get('do') === 'userContentHandleImageUpload' ? Response.json({}) : undefined,
  });
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .jpeg()
    .toBuffer();
  const photo = await f.service.inspectPhoto({ base64: bytes.toString('base64') });
  const p = await f.service.prepare({ ...record(), photo_ids: [photo.metadata.id] });
  assert.equal((await send(f, p)).state, 'unknown');
  assert.equal(f.posts().length, 2);
});

for (const name of ['stgallen', 'schaffhausen']) {
  test(`${name}: inspected anonymous fields, upload and final values remain tenant-specific`, async (t) => {
    const f = await setup(t, { name });
    const bytes = await sharp({
      create: { width: 16, height: 16, channels: 3, background: 'blue' },
    })
      .jpeg()
      .toBuffer();
    const photo = await f.service.inspectPhoto({ base64: bytes.toString('base64') });
    const p = await f.service.prepare({ ...record(name), photo_ids: [photo.metadata.id] });
    assert.deepEqual(p.requirements.contact_fields, []);
    assert.equal(
      p.terms_url,
      name === 'stgallen'
        ? 'https://m.stadt.sg.ch/index.php?apid=15080152'
        : 'https://m.stadt-schaffhausen.ch/index.php?apid=4385201',
    );
    assert.equal((await send(f, p)).state, 'unknown');
    assert.equal(f.posts().length, 5);
    const location = Object.fromEntries(
      f.posts().find((c) => c.url.searchParams.get('step') === '2').init.body,
    );
    assert.deepEqual(location, {
      stepback: '',
      foo: '',
      latitude: String(record(name).latitude),
      longitude: String(record(name).longitude),
      'devicecoords[lat]': '',
      'devicecoords[long]': '',
      submit: 'Weiter',
    });
    const details = Object.fromEntries(
      f.posts().find((c) => c.url.searchParams.get('step') === '4').init.body,
    );
    assert.equal(details.telefon, undefined);
    assert.equal(details.notification, undefined);
    assert.equal(details.email, 'test@example.org');
    const final = Object.fromEntries(
      f.posts().find((c) => c.url.searchParams.get('step') === '5').init.body,
    );
    assert.deepEqual(final, { stepback: '', proceed: 'true' });
    const check = f.calls.find(
      (c) => c.url.searchParams.get('do') === 'usercontentCheckRadius',
    ).url;
    assert.equal(check.searchParams.get('checkoutofrange'), '');
    assert.equal(check.searchParams.get('radius'), name === 'stgallen' ? '15000' : '6580');
    assert.equal((await send(f, p)).already_attempted, true);
    assert.equal(f.posts().length, 5);
  });
  test(`${name}: unsupported name/phone are refused rather than silently discarded`, async (t) => {
    const f = await setup(t, { name });
    for (const contact of [{ name: 'Test person' }, { phone: '123' }])
      await assert.rejects(
        () => f.service.prepare({ ...record(name), ...contact }),
        /does not accept/,
      );
    assert.equal(f.posts().length, 0);
  });
  test(`${name}: altered proceed or details controls stop before sending`, async (t) => {
    for (const mutate of [
      (step, html) =>
        step === 5
          ? html.replace(
              'name="proceed" type="hidden" value="true"',
              'name="proceed" type="hidden" value="false"',
            )
          : html,
      (step, html) =>
        step === 4 ? html.replace('</form>', input('telefon', 'text') + '</form>') : html,
    ]) {
      const f = await setup(t, { name, mutate }),
        p = await f.service.prepare(record(name));
      assert.equal((await send(f, p)).state, 'unknown');
      assert.equal(
        f.posts().some((c) => c.url.searchParams.get('step') === '5'),
        false,
      );
    }
  });
}
test('tenant location checks reject unexpected types, modes and out-of-area responses', async (t) => {
  const invalid = {
    stgallen: [{ inbfs: false }, { inbfs: 'true' }, { distance: 0 }, { inbfs: true, msg: '' }, {}],
    schaffhausen: [
      { distance: -1 },
      { distance: 6581 },
      { distance: '0' },
      { inbfs: true },
      { distance: 0, msg: '' },
      [],
    ],
  };
  for (const [name, responses] of Object.entries(invalid))
    for (const locationResult of responses) {
      const f = await setup(t, { name, locationResult });
      await assert.rejects(() => f.service.prepare(record(name)), /location check/);
      assert.equal(f.posts().length, 0);
    }
  const edge = await setup(t, { name: 'schaffhausen', locationResult: { distance: 6580 } });
  assert.equal((await edge.service.prepare(record('schaffhausen'))).municipality.bfs_id, 2939);
  const outside = await setup(t, { name: 'schaffhausen', bfs: 3203 });
  await assert.rejects(() => outside.service.prepare(record('schaffhausen')), /outside/);
  assert.equal(outside.calls.length, 0);
});
