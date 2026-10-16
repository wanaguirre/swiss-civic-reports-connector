import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import {
  RiehenClient,
  riehenCategories as classes,
  riehenRequirements,
  inspectRiehenForm,
  inspectRiehenUploader,
} from '../dist/riehen.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('./fixtures/riehen-form.html', import.meta.url), 'utf8');
const widget = await readFile(new URL('./fixtures/riehen-widget.html', import.meta.url), 'utf8');
const terms = 'https://www.riehen.ch/verwaltung/formulare/meldung-schaeden.php';
const input = {
  latitude: 47.583,
  longitude: 7.651,
  location_label: 'Fictional issue location, Riehen',
  location_confirmed: true,
  category: classes.damage,
  description: 'Fiktiver Schaden nur für einen lokalen Test.',
  email: 'fictional@example.org',
  phone: '000',
  photo_ids: [],
  extra_fields: {
    first_name: 'Fictional',
    last_name: 'Resident',
    contact_street: 'Fictional home 1',
    contact_postcode: '0000',
    contact_city: 'Test town',
    public_property: 'yes',
  },
};
function fixture() {
  let now = Date.now(),
    body = html,
    frame = widget,
    bfs = 2703;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, 'error');
    const u = new URL(url);
    assert.equal(u.origin, 'https://www.riehen.ch');
    if (u.pathname.endsWith('meldung-schaeden.php')) {
      assert.equal(init.headers.Cookie, undefined);
      return new Response(body, {
        headers: {
          'content-type': 'text/html',
          'set-cookie': 'WSESSIONID=fictionalSession123456; Path=/; Secure; HttpOnly',
        },
      });
    }
    assert.equal(u.searchParams.get('action'), 'showmaskuploadform');
    assert.equal(init.headers.Cookie, 'WSESSIONID=fictionalSession123456');
    return new Response(frame, { headers: { 'content-type': 'text/html' } });
  };
  return {
    city: new RiehenClient(request, {
      places: { municipality: async () => ({ bfs_id: bfs }) },
      now: () => now,
    }),
    calls,
    advance: (ms) => (now += ms),
    html: (s) => (body = s),
    widget: (s) => (frame = s),
    bfs: (n) => (bfs = n),
  };
}
async function setup(t, f) {
  const dir = await mkdtemp(join(tmpdir(), 'civic-riehen-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  return {
    store,
    service: new ReportService(f.city, store, { submissionEnabled: true, allowPaths: false }),
  };
}
test('Riehen form and version-20 upload contract parse; changed fields, branches, consent, login and challenges fail closed', () => {
  const form = inspectRiehenForm(html);
  assert.equal(inspectRiehenUploader(widget, form).csrf, 'fictionalCsrf123456');
  for (const altered of [
    html.replace('name="telephone"', 'name="mobile"'),
    html.replace('name="foto"', 'name="other"'),
    html.replace('value="Ja"', 'value="New terms"'),
    html.replace('method="POST"', 'method="GET"'),
    html.replace('/datenschutz/nutzungsbedingungen.php', '/other-policy'),
    html.replace('</form>', '<input type="password" name="password"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace(
      "conditions:meldung-schaden=='Verschmierung an öffentlichen Liegenschaften in Riehen'",
      "conditions:meldung-schaden=='other'",
    ),
    html.replace('www.riehen.ch', 'evil.example'),
  ].filter((x) => x !== html))
    assert.throws(() => inspectRiehenForm(altered), /changed/);
  assert.throws(() => inspectRiehenUploader(widget.replace("'20'", "'21'"), form), /changed/);
  assert.throws(() => inspectRiehenUploader(widget.replace("'foto'", "'images'"), form), /changed/);
});
test('Riehen rules distinguish both classes, contact needs and private-property exclusion', async () => {
  const f = fixture(),
    rules = await f.city.requirements(input);
  assert.deepEqual(Object.keys(rules), Object.values(classes));
  assert.equal(rules[classes.damage].max_photos, 0);
  assert.equal(rules[classes.graffiti].max_photos, 1);
  assert.equal(rules[classes.graffiti].max_photo_bytes, 1999999);
  assert.equal(rules[classes.damage].phone_required, true);
  assert.match(f.city.guidance.exclusions[0].issue, /private/);
  assert.equal(f.calls.length, 2);
  await f.city.categories();
  assert.equal(f.calls.length, 2);
  f.bfs(261);
  await assert.rejects(f.city.requirements(input), /outside Riehen/);
  assert.equal(f.calls.length, 2);
});
test('Riehen preparation freezes rules and location; local general-damage plan includes contacts and no photo; sending cannot be enabled', async (t) => {
  const f = fixture(),
    { service, store } = await setup(t, f);
  const p = await service.prepare(input),
    frozen = await store.preview(p.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 2703, service_id: 'riehen-weblication' });
  assert.equal(p.submission_enabled, false);
  assert.equal(p.terms_url, terms);
  assert.equal(p.requirements.max_photos, 0);
  await assert.rejects(
    service.submit(p.preview_id, p.confirmation_token, true, terms),
    /verification/,
  );
  await assert.rejects(f.city.submit(frozen), /verification/);
  const plan = await f.city.buildSubmission(frozen, terms),
    form = plan.buildForm([]);
  assert.equal(plan.uploads.length, 0);
  assert.equal(plan.finalizeUpload, undefined);
  assert.equal(form.method, 'POST');
  assert.equal(form.body.get('meldung-schaden[]'), classes.damage);
  assert.match(form.body.get('beschreibung-schaden'), /47.583, 7.651/);
  assert.equal(form.body.get('firstname'), 'Fictional');
  assert.equal(form.body.get('Ort'), 'Test town');
  assert.equal(form.body.get('foto'), '');
  assert.equal(form.body.has('art-verschmierung[]'), false);
  assert.equal(form.body.get('subject-4'), '');
  assert.equal(form.body.get('datenschutz-akzeptiert[]'), 'Ja');
  assert.equal(f.calls.length, 4);
  assert.doesNotMatch(JSON.stringify(frozen), /fictionalSession|wFormToken|wCsrf/);
  f.advance(300001);
  assert.throws(() => plan.buildForm([]), /expired/);
});
test('Riehen graffiti plan preserves reviewed choices, JPEG, public location and same reporter; no requests are dispatched', async (t) => {
  const f = fixture(),
    { service, store } = await setup(t, f);
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 30, height: 20, channels: 3, background: '#445566' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  const report = {
    ...input,
    category: classes.graffiti,
    photo_ids: [photo.metadata.id],
    extra_fields: {
      ...input.extra_fields,
      object_street: 'Fictional object street 2',
      graffiti_surface: 'Mauer',
      reporter_role: 'Spraymelder/in',
    },
  };
  const p = await service.prepare(report),
    frozen = await store.preview(p.preview_id),
    plan = await f.city.buildSubmission(frozen, terms);
  assert.equal(plan.uploads.length, 1);
  assert.equal(plan.uploads[0].preflight.method, 'POST');
  assert.equal(plan.uploads[0].preflight.body.has('wcsrf'), false);
  assert.equal(plan.uploads[0].chunks[0].body.get('wcsrf'), 'fictionalCsrf123456');
  assert.equal(new URL(plan.finalizeUpload.url).searchParams.has('wcsrf'), false);
  assert.throws(() => plan.buildForm([]), /filename/);
  assert.throws(() => plan.buildForm(['../unsafe.jpg']), /unsafe/);
  const body = plan.buildForm(['fictional.jpg']).body;
  assert.equal(body.get('beschreibung-schaden'), '');
  assert.equal(body.get('art-verschmierung[]'), 'Mauer');
  assert.equal(body.get('radio-spraymelder'), 'Spraymelder/in');
  assert.equal(body.get('name-spray'), 'Fictional Resident');
  assert.equal(body.get('mailspray'), input.email);
  assert.equal(body.get('ort-objekt'), 'Riehen');
  assert.equal(body.get('bemerkungen'), input.description);
  assert.equal(body.get('foto'), 'fictional.jpg');
  assert.equal(f.calls.length, 4);
  await assert.rejects(service.prepare({ ...input, photo_ids: report.photo_ids }), /at most 0/);
  const bytes = Buffer.alloc(2_000_000);
  bytes.set([255, 216, 255]);
  frozen.photos[0].jpeg = bytes.toString('base64');
  frozen.photos[0].sha256 = createHash('sha256').update(bytes).digest('hex');
  const large = { ...frozen.photos[0], id: randomUUID() };
  await store.savePhoto(large);
  await assert.rejects(service.prepare({ ...report, photo_ids: [large.id] }), /1999999 bytes/);
  await assert.rejects(f.city.buildSubmission(frozen, terms), /integrity/);
});
test('Riehen rejects missing contacts, invented roles, cross-service previews, changed terms and expired previews before session reads', async (t) => {
  const f = fixture(),
    { service, store } = await setup(t, f);
  await assert.rejects(service.prepare({ ...input, phone: '' }), /phone/);
  await assert.rejects(
    service.prepare({ ...input, extra_fields: { ...input.extra_fields, public_property: 'no' } }),
    /Invalid choice/,
  );
  const p = await service.prepare(input),
    frozen = await store.preview(p.preview_id),
    count = f.calls.length;
  for (const altered of [
    { ...frozen, destination: { bfs_id: 2534, service_id: 'zuchwil-weblication' } },
    { ...frozen, terms_url: 'https://example.org' },
    { ...frozen, expires_at: new Date(0).toISOString() },
    { ...frozen, input: { ...input, extra_fields: { ...input.extra_fields, first_name: '' } } },
  ])
    await assert.rejects(f.city.buildSubmission(altered, terms));
  assert.equal(f.calls.length, count);
});
test('Riehen pauses on changed contracts and session-cookie mismatches without retries', async () => {
  const f = fixture();
  f.html(html.replace('fictionalSession123456', 'differentSession123456'));
  await assert.rejects(f.city.categories(), /changed/);
  const count = f.calls.length;
  await assert.rejects(f.city.categories());
  assert.equal(f.calls.length, count);
  f.advance(300001);
  f.html(html);
  await f.city.categories();
  assert.equal(f.calls.length, count + 2);
});

test('Riehen can use its hidden form session with ordinary load-balancer cookies, without inventing WSESSIONID cookies', async () => {
  const calls = [];
  const client = new RiehenClient(async (url, init) => {
    calls.push(init);
    return new Response(url.endsWith('meldung-schaeden.php') ? html : widget, {
      headers: {
        'content-type': 'text/html',
        ...(url.endsWith('meldung-schaeden.php')
          ? { 'set-cookie': 'AL_SESS-S=fictionalProxySession; Path=/; Secure; HttpOnly' }
          : {}),
      },
    });
  });
  assert.equal((await client.categories()).length, 2);
  assert.equal(calls[1].headers.Cookie, 'AL_SESS-S=fictionalProxySession');
});
