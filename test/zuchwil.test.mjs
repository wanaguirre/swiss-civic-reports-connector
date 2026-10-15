import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  ZuchwilClient,
  inspectZuchwilForm,
  inspectZuchwilUploader,
  zuchwilUploadedFilename,
} from '../dist/zuchwil.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('./fixtures/zuchwil-form.html', import.meta.url), 'utf8');
const widget = await readFile(new URL('./fixtures/zuchwil-widget.html', import.meta.url), 'utf8');
const terms = 'https://www.zuchwil.ch/de/datenschutz/';
const point = { latitude: 47.201, longitude: 7.56 };
const input = {
  ...point,
  location_label: 'Fictional test street, Zuchwil',
  location_confirmed: true,
  category: 'Schadensmeldung',
  description: 'Fiktiver Schaden nur für einen lokalen Test.',
  email: 'fictional@example.org',
  name: 'Fictional resident',
  phone: '000',
  extra_fields: { report_title: 'Fiktiver Schaden' },
  photo_ids: [],
};
function fixture(options = {}) {
  let now = Date.now(),
    body = html,
    frame = widget,
    session = 0;
  const calls = [];
  const request = async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u, ...init });
    assert.equal(u.origin, 'https://www.zuchwil.ch');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, 'error');
    if (options.response) return options.response(u, init);
    if (u.pathname.endsWith('/schadensmelder.php')) {
      assert.equal(init.headers.Cookie, undefined);
      session++;
      return new Response(body, {
        headers: {
          'Content-Type': 'text/html',
          'Set-Cookie': `WSESSIONID=fictionalSession${session}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        },
      });
    }
    assert.equal(u.pathname, '/weblication/grid5/scripts/wUploader.php');
    assert.equal(u.searchParams.get('action'), 'showmaskuploadform');
    assert.equal(init.headers.Cookie, `WSESSIONID=fictionalSession${session}`);
    return new Response(frame, { headers: { 'Content-Type': 'text/html' } });
  };
  return {
    city: new ZuchwilClient(request, {
      places: { municipality: async () => ({ bfs_id: options.bfs ?? 2534 }) },
      now: () => now,
    }),
    calls,
    advance: (ms) => (now += ms),
    setHtml: (s) => (body = s),
    setWidget: (s) => (frame = s),
  };
}
async function prepared(t, f, withPhoto = false) {
  const dir = await mkdtemp(join(tmpdir(), 'civic-zuchwil-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(f.city, store, { submissionEnabled: true, allowPaths: false });
  const photo = withPhoto
    ? await service.inspectPhoto({
        base64: (
          await sharp({ create: { width: 30, height: 20, channels: 3, background: '#445566' } })
            .png()
            .toBuffer()
        ).toString('base64'),
      })
    : undefined;
  const preview = await service.prepare({ ...input, photo_ids: photo ? [photo.metadata.id] : [] });
  return { service, store, preview, frozen: await store.preview(preview.preview_id), dir };
}
test('anonymous form/widget are parsed without evaluating scripts; unrelated login and CSS do not block', () => {
  const form = inspectZuchwilForm(html);
  assert.equal(form.formId, 'abcdef12');
  assert.match(inspectZuchwilUploader(widget, form).dir, /wFormTmp\(abcdef12\)$/);
});
test('preparation binds destination, privacy, contacts and title; global opt-in cannot send', async (t) => {
  const f = fixture(),
    { service, store, preview, frozen, dir } = await prepared(t, f, true);
  assert.deepEqual(frozen.destination, { bfs_id: 2534, service_id: 'zuchwil-weblication' });
  assert.equal(preview.terms_url, terms);
  assert.equal(preview.submission_mode, 'unverified');
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.requirements.extra_fields[0].translate, true);
  assert.equal(preview.requirements.email_required, true);
  assert.deepEqual(preview.requirements.contact_fields, ['name', 'phone']);
  assert.equal(preview.attachments.length, 1);
  assert.equal(f.calls.length, 2);
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true, terms),
    /verification/,
  );
  await assert.rejects(f.city.submit(frozen), /verification/);
  assert.equal(f.calls.length, 2);
  assert.equal((await store.receipts()).length, 0);
  const saved = await readFile(join(dir, 'preview-' + preview.preview_id + '.json'), 'utf8');
  assert.doesNotMatch(saved, /WSESSIONID|wFormToken|syntheticCsrf|fictionalSession/);
  for (const change of [
    { email: '' },
    { extra_fields: {} },
    { extra_fields: { report_title: 'x'.repeat(101) } },
    { extra_fields: { report_title: 'Title', arbitrary: 'hidden' } },
    { category: 'Abfall' },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
});
test('local photo plan follows source contract and preserves exact reviewed data without dispatch', async (t) => {
  const f = fixture(),
    { frozen } = await prepared(t, f, true);
  const plan = await f.city.buildSubmission(frozen, terms);
  assert.equal(f.calls.length, 4);
  assert.equal(plan.uploads.length, 1);
  const upload = plan.uploads[0],
    part = upload.chunks[0];
  assert.equal(upload.preflight.method, 'POST');
  assert.equal(upload.preflight.body.get('action'), 'getinfoforupload');
  assert.match(upload.preflight.body.get('md'), /^ff_d8_ff/);
  assert.equal(
    upload.preflight.body.get('size'),
    String(Buffer.from(frozen.photos[0].jpeg, 'base64').length),
  );
  assert.equal(part.method, 'POST');
  assert.equal(part.body.get('ispart'), '0');
  assert.equal(part.body.get('islastpart'), '0');
  assert.equal(part.body.get('part'), '1');
  assert.equal(part.body.get('action'), 'uploadfile');
  assert.equal(part.body.get('type'), 'smart');
  assert.deepEqual(
    Buffer.from(await part.body.get('uploadFilename').arrayBuffer()),
    Buffer.from(frozen.photos[0].jpeg, 'base64'),
  );
  assert.equal(part.body.get('uploadFilename').name, 'civic-report.jpg');
  assert.equal(plan.finalizeUpload.method, 'GET');
  assert.equal(new URL(plan.finalizeUpload.url).searchParams.get('action'), 'onafteruploadall');
  assert.throws(() => plan.buildForm([]), /filename/);
  const filename = zuchwilUploadedFilename('synthetic-upload-response&filename=civic-report.jpg');
  const form = plan.buildForm([filename]);
  assert.equal(form.method, 'POST');
  assert.match(form.url, /\/tmpHTTP\/wForm-cached-/);
  assert.equal(form.headers.Cookie, part.headers.Cookie);
  assert.equal(form.headers.Cookie, 'WSESSIONID=fictionalSession2');
  assert.equal(form.body.get('title_damage'), input.extra_fields.report_title);
  assert.equal(form.body.get('description_damage'), input.description);
  assert.equal(
    form.body.get('address'),
    `${input.location_label}\nKoordinaten (WGS84): ${point.latitude}, ${point.longitude}`,
  );
  assert.equal(form.body.get('remarks_damage'), 'Name: Fictional resident\nTelefon: 000');
  assert.equal(form.body.get('email'), input.email);
  assert.equal(form.body.get('images'), filename);
  assert.equal(form.body.get('datenschutz-akzeptiert[]'), 'Ja');
  assert.equal(form.body.get('category'), null);
  assert.equal(f.calls.length, 4);
  assert.ok(f.calls.every((c) => c.method === 'GET' && !c.body));
  for (const bad of [
    '../civic.jpg',
    'https://evil.example/civic.jpg',
    'civic.jpg|extra.jpg',
    'civic.jpg&foo=bar',
  ])
    assert.throws(() => plan.buildForm([bad]));
  f.advance(300_000);
  assert.throws(() => plan.buildForm([filename]), /expired/);
});
test('no-photo plan omits upload/finalization; separate plans use fresh independent sessions', async (t) => {
  const f = fixture(),
    { frozen } = await prepared(t, f);
  const first = await f.city.buildSubmission(frozen, terms),
    second = await f.city.buildSubmission(frozen, terms);
  assert.equal(first.uploads.length, 0);
  assert.equal(first.finalizeUpload, undefined);
  assert.equal(first.buildForm([]).body.get('images'), '');
  assert.notEqual(first.buildForm([]).headers.Cookie, second.buildForm([]).headers.Cookie);
  assert.equal(f.calls.length, 6);
});
test('chunk boundaries reconstruct every byte, including single large and final partial chunks', async (t) => {
  const f = fixture(),
    { frozen } = await prepared(t, f);
  // Synthetic JPEG-like bytes are local wire tests, never municipal uploads.
  for (const size of [204800, 204801, 1048576, 1048577, 2048000, 2048001, 5000000]) {
    const bytes = Buffer.alloc(size, 11);
    bytes.set([255, 216, 255]);
    const id = randomUUID();
    const p = {
      ...frozen,
      input: { ...frozen.input, photo_ids: [id] },
      photos: [
        {
          id,
          jpeg: bytes.toString('base64'),
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      ],
    };
    const { chunks } = (await f.city.buildSubmission(p, terms)).uploads[0];
    const expected = Math.ceil(size / (size > 1048576 ? 2048000 : 204800));
    assert.equal(chunks.length, expected);
    assert.deepEqual(
      Buffer.concat(
        await Promise.all(
          chunks.map(async (c) => Buffer.from(await c.body.get('uploadFilename').arrayBuffer())),
        ),
      ),
      bytes,
    );
    chunks.forEach((c, i) => {
      assert.equal(c.body.get('part'), String(i + 1));
      assert.equal(c.body.get('ispart'), expected > 1 ? '1' : '0');
      assert.equal(c.body.get('islastpart'), expected > 1 && i === expected - 1 ? '1' : '0');
    });
  }
});
test('wrong destination, expired preview, missing consent, altered photos and outside boundary fail before provider access', async (t) => {
  const f = fixture(),
    { frozen } = await prepared(t, f, true),
    before = f.calls.length;
  for (const p of [
    { ...frozen, destination: { bfs_id: 261, service_id: 'zuchwil-weblication' } },
    { ...frozen, destination: { bfs_id: 2534, service_id: 'other' } },
    { ...frozen, terms_url: undefined },
    { ...frozen, expires_at: '2000-01-01' },
    { ...frozen, photos: [] },
    { ...frozen, photos: [{ ...frozen.photos[0], sha256: '0'.repeat(64) }] },
  ])
    await assert.rejects(f.city.buildSubmission(p, terms));
  await assert.rejects(f.city.buildSubmission(frozen, ''), /acceptance/);
  assert.equal(f.calls.length, before);
  const wrong = fixture({ bfs: 261 });
  await assert.rejects(wrong.city.requirements(point), /outside/);
  await assert.rejects(wrong.city.buildSubmission(frozen, terms), /outside/);
  assert.equal(wrong.calls.length, 0);
});
test('scoped form contract rejects drift, active protection, external destinations and extra controls', () => {
  for (const bad of [
    html.replace('tmpHTTP/', 'other/'),
    html.replace('<iframe src=', '<iframe srcdoc="blocked" src='),
    html + '<script src="https://example.org/recaptcha/api.js"></script>',
    html.replace(
      '<textarea name="address"',
      '<fieldset disabled></fieldset><textarea name="address"',
    ),
    html.replace('action="/weblication', 'action="https://evil.example/weblication'),
    html.replace('src="/weblication', 'src="//evil.example/weblication'),
    html.replace('project=/de', 'project=/other'),
    html.replace('lang=de', 'lang=fr'),
    html.replace('showmaskuploadform', 'deleteCurrentUpload'),
    html.replace('title_damage" type', 'other" type'),
    html.replace('data-validators="required"', 'data-validators="email"'),
    html.replace('name="images"', 'name="images" disabled'),
    html.replace('name="email"', 'name="email" maxlength="10"'),
    html.replace('value="Ja"', 'value="Nein"'),
    html.replace('/de/datenschutz/', '/other-terms/'),
    html.replace('</iframe>', '</iframe><input type="password">'),
    html.replace('</iframe>', '</iframe><div class="g-recaptcha"></div>'),
    html.replace('<button type="submit"', '<button formaction="/other" type="submit"'),
    html.replace('form class="search"', 'form class="schadensmelder"'),
    html + 'x'.repeat(1000001),
  ])
    assert.throws(() => inspectZuchwilForm(bad), /changed/);
  for (const bad of [
    widget.replace("wUserType = ''", "wUserType = 'admin'"),
    widget.replace("'images'", "'attachments'"),
    widget.replace('abcdef12', '11111111'),
    widget.replace("'maxSizeImage' : 5", "'maxSizeImage' : 1"),
    widget.replace("'useSend' : ''", "'useSend' : '1'"),
    widget.replace("'resizeIfhasCopyright' : ''", "'encryptBeforeSave' : '1'"),
    widget.replace("'showCurrent' : true", "'showCurrent' : dangerous()"),
    widget.replace("wVersionGrid = '21'", "wVersionGrid = '120'"),
    '<div class="g-recaptcha"></div>' + widget,
    widget + 'x'.repeat(200001),
  ])
    assert.throws(() => inspectZuchwilUploader(bad, inspectZuchwilForm(html)), /changed/);
});
test('read cache retains only verification, coalesces preparation and honors fresh reads and cooldown', async () => {
  const f = fixture();
  await Promise.all([f.city.categories(), f.city.requirements(point), f.city.requirements(point)]);
  assert.equal(f.calls.length, 2);
  await f.city.categories();
  assert.equal(f.calls.length, 2);
  await f.city.requirements(point, { fresh: true });
  assert.equal(f.calls.length, 4);
  f.setWidget('Login required');
  f.advance(300_001);
  await assert.rejects(f.city.categories());
  await assert.rejects(f.city.categories());
  assert.equal(f.calls.length, 6);
  f.setWidget(widget);
  f.advance(300_001);
  await f.city.categories();
  assert.equal(f.calls.length, 8);
});
test('HTTP failures, foreign cookie scope, missing sessions, redirects and huge responses stop reads without retry', async () => {
  for (const response of [
    () => new Response('', { status: 429, headers: { 'Retry-After': '600' } }),
    () => new Response('', { status: 302, headers: { Location: 'https://evil.example/' } }),
    () => Response.json({ ok: true }),
    () => new Response(html, { headers: { 'Content-Type': 'text/html' } }),
    () =>
      new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Set-Cookie': 'WSESSIONID=synthetic; Domain=evil.example; Path=/',
        },
      }),
    () => new Response('x'.repeat(1000001), { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    const f = fixture({ response });
    await assert.rejects(f.city.categories());
    await assert.rejects(f.city.categories());
    assert.equal(f.calls.length, 1);
    if (response().status === 429) {
      f.advance(300_001);
      await assert.rejects(f.city.categories(), /paused/);
      assert.equal(f.calls.length, 1);
    }
  }
});
test('upload marker parser rejects failures, ambiguity and paths; it never classifies report acceptance', () => {
  assert.equal(zuchwilUploadedFilename('&filename=synthetic-1.jpg'), 'synthetic-1.jpg');
  for (const body of [
    '',
    '<html>Thank you</html>',
    'error:485&filename=image.jpg',
    "wOnAfterUploadFailed('failure')&filename=image.jpg",
    '&filename=../image.jpg',
    '&filename=%2e%2e%2fimage.jpg',
    '&filename=image.jpg&filename=second.jpg',
    '&filename=image.php',
    'x'.repeat(16385),
  ])
    assert.throws(() => zuchwilUploadedFilename(body));
});
