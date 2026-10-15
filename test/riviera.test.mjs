import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  RivieraClient,
  rivieraMunicipalities,
  rivieraCoordinates,
  inspectRivieraForm,
} from '../dist/riviera.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('./fixtures/riviera-form.html', import.meta.url), 'utf8');
const observed = JSON.parse(
  await readFile(new URL('./fixtures/riviera-categories.json', import.meta.url), 'utf8'),
);
const point = { latitude: 46.46383285522461, longitude: 6.847609996795654 };
const collection = (features) => ({ type: 'FeatureCollection', features });
function fixture(name = 'vevey', options = {}) {
  let now = Date.now(),
    body = html,
    prefix = '',
    categoryData = structuredClone(observed[rivieraMunicipalities[name].bfsId]);
  const calls = [];
  const request = async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u.href, ...init });
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.body, undefined);
    if (options.response) return options.response(u, init);
    if (u.pathname === '/nouveau.php')
      return new Response(body, { headers: { 'Content-Type': 'text/html' } });
    assert.equal(u.pathname, '/webservices.php');
    assert.equal(u.searchParams.get('e'), '2554599');
    assert.equal(u.searchParams.get('n'), '1146005');
    switch (u.searchParams.get('ws')) {
      case 'get_themes_at_location':
        return Response.json(categoryData);
      case 'get_parcelle_publique_at_location':
        return Response.json(collection([]));
      case 'get_extra_attributes_at_location':
        return prefix
          ? Response.json(collection([{ properties: { description: prefix } }]))
          : new Response('');
      default:
        throw Error('Unexpected route');
    }
  };
  const city = new RivieraClient(name, request, {
    places: {
      municipality: async () => ({ bfs_id: options.bfs ?? rivieraMunicipalities[name].bfsId }),
    },
    now: () => now,
  });
  return {
    city,
    calls,
    request,
    advance: (ms) => (now += ms),
    setHtml: (v) => (body = v),
    setPrefix: (v) => (prefix = v),
    setCategories: (v) => (categoryData = v),
    getCategories: () => structuredClone(categoryData),
  };
}
const input = {
  ...point,
  location_label: 'Fictional contract-test location',
  location_confirmed: true,
  category: 'Eclairage public',
  description: 'Un luminaire fictif pour un test local uniquement.',
  email: 'fictional@example.org',
  photo_ids: [],
  extra_fields: {},
};
async function serviceFixture(t, f) {
  const dir = await mkdtemp(join(tmpdir(), 'civic-riviera-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  return {
    store,
    service: new ReportService(f.city, store, { submissionEnabled: true, allowPaths: false }),
  };
}
for (const [name, profile] of Object.entries(rivieraMunicipalities))
  test(`${name}: correct tenant payload, frozen photo, no live sending even with global opt-in`, async (t) => {
    const f = fixture(name),
      { store, service } = await serviceFixture(t, f);
    const rules = await f.city.requirements(point);
    assert.equal(Object.keys(rules).length, 7);
    assert.equal(rules['Harcèlement de rue'], undefined);
    assert.equal(rules['Eclairage public'].description_max_length, 1000);
    assert.equal(rules['Eclairage public'].max_photos, 1);
    assert.match(rules['Eclairage public'].notes.join(' '), /domaine public/);
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 12, height: 10, channels: 3, background: '#44aa66' } })
          .png()
          .toBuffer()
      ).toString('base64'),
    });
    const preview = await service.prepare({ ...input, photo_ids: [photo.metadata.id] });
    assert.equal(preview.municipality.bfs_id, profile.bfsId);
    assert.equal(preview.submission_mode, 'unverified');
    assert.equal(preview.submission_enabled, false);
    const frozen = await store.preview(preview.preview_id);
    assert.equal(frozen.destination.service_id, `riviera-${profile.bfsId}`);
    const request = await f.city.buildSubmission(frozen);
    assert.equal(request.url, 'https://www.signalements-riviera.ch/add_signalement.php');
    assert.equal(request.method, 'POST');
    assert.deepEqual(
      [...request.body.keys()],
      ['east', 'north', 'themes-list', 'description', 'email', 'photo'],
    );
    const expected = observed[profile.bfsId].features.find((f) => f.properties.gid_thematique === 2)
      .properties.gid_zone_thematique;
    assert.equal(request.body.get('themes-list'), String(expected));
    assert.equal(request.body.get('east'), '2554599');
    assert.equal(request.body.get('north'), '1146005');
    assert.equal(request.body.get('description'), input.description);
    assert.equal(request.body.get('zone'), null);
    const file = request.body.get('photo');
    assert.equal(file.type, 'image/jpeg');
    assert.equal(file.name, 'civic-report.jpg');
    assert.deepEqual(
      Buffer.from(await file.arrayBuffer()),
      Buffer.from(frozen.photos[0].jpeg, 'base64'),
    );
    await assert.rejects(
      service.submit(preview.preview_id, preview.confirmation_token, true),
      /verification/,
    );
    await assert.rejects(f.city.submit(frozen), /verification/);
    assert.equal((await store.receipts()).length, 0);
    assert.equal(f.calls.length, 8);
    assert.ok(f.calls.every((c) => c.method === 'GET' && !c.body));
    const other = new RivieraClient(name === 'vevey' ? 'montreux' : 'vevey', f.request, {
      places: { municipality: async () => ({ bfs_id: 5890 }) },
    });
    await assert.rejects(other.buildSubmission(frozen), /different municipality/);
    assert.equal(f.calls.length, 8);
  });
test('LV95 conversion matches independent swisstopo sample and rejects invalid/outside coordinates', () => {
  assert.deepEqual(rivieraCoordinates(point), { east: 2554599, north: 1146005 });
  for (const p of [
    { latitude: 0, longitude: 0 },
    { latitude: Infinity, longitude: 6 },
    { latitude: 46, longitude: 200 },
  ])
    assert.throws(() => rivieraCoordinates(p));
});
test('wrong BFS prevents provider access; conflicting zones, labels and ambiguous category IDs fail closed', async () => {
  const wrong = fixture('vevey', { bfs: 5886 });
  await assert.rejects(wrong.city.requirements(point), /outside/);
  assert.equal(wrong.calls.length, 0);
  for (const mutate of [
    (d) => (d.features[0].properties.zone = 'Montreux'),
    (d) => (d.features[0].properties.thematique = 'Waste'),
    (d) => d.features.push(d.features[0]),
    (d) => (d.features = []),
  ]) {
    const f = fixture(),
      d = f.getCategories();
    mutate(d);
    f.setCategories(d);
    await assert.rejects(f.city.requirements(point), /changed/);
  }
  const f = fixture(),
    d = f.getCategories();
  d.features.push({
    properties: {
      zone: 'Vevey',
      gid_thematique: 999,
      gid_zone_thematique: 999,
      thematique: 'Internal administration',
      info: null,
    },
  });
  f.setCategories(d);
  assert.equal(Object.keys(await f.city.requirements(point)).length, 7);
});
test('preview limits, unsupported contacts, location context and attachment integrity cannot be bypassed', async (t) => {
  const f = fixture(),
    { store, service } = await serviceFixture(t, f);
  f.setPrefix('Contexte fictif du lieu');
  const preview = await service.prepare(input),
    frozen = await store.preview(preview.preview_id);
  assert.equal(frozen.input.description, 'Contexte fictif du lieu\n' + input.description);
  assert.equal(
    (await f.city.buildSubmission(frozen)).body.get('description'),
    frozen.input.description,
  );
  for (const change of [
    { description: 'x'.repeat(1000) },
    { category: 'Harcèlement de rue' },
    { category: 'Waste' },
    { name: 'Unsupported' },
    { phone: '123' },
    { extra_fields: { invented: 'value' } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const once = await service.prepare({ ...input, description: frozen.input.description });
  assert.equal(once.report.description, frozen.input.description);
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#667788' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  const second = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#778899' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [photo.metadata.id, second.metadata.id] }),
    /at most 1/,
  );
  const withPhoto = await service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
    p = await store.preview(withPhoto.preview_id);
  p.photos[0].sha256 = '0'.repeat(64);
  await assert.rejects(f.city.buildSubmission(p), /integrity/);
  f.setPrefix('Nouveau contexte fictif');
  await assert.rejects(f.city.buildSubmission(frozen), /context changed/);
});
test('all tenant profiles share bounded reads and cooldown; a fresh read bypasses cached metadata', async () => {
  const f = fixture();
  await Promise.all([f.city.categories(), f.city.requirements(point), f.city.requirements(point)]);
  assert.equal(f.calls.length, 4);
  await f.city.requirements(point, { fresh: true });
  assert.equal(f.calls.length, 8);
  f.advance(300001);
  await f.city.categories();
  assert.equal(f.calls.length, 9);
  const busy = fixture('vevey', {
    response: () => new Response('Busy', { status: 429, headers: { 'Retry-After': '3600' } }),
  });
  const other = new RivieraClient('montreux', busy.request);
  await assert.rejects(busy.city.categories());
  await assert.rejects(other.categories(), /paused/);
  busy.advance(300001);
  await assert.rejects(busy.city.requirements(point, { fresh: true }), /paused/);
  assert.equal(busy.calls.length, 1);
  busy.advance(3300000);
  await assert.rejects(busy.city.categories());
  assert.equal(busy.calls.length, 2);
});
test('form drift, redirects, HTML challenges and oversized responses cannot enable preparation or sending', async () => {
  inspectRivieraForm(html);
  for (const bad of [
    html + html,
    html.replace('</form>', '<input name="password" type="password"></form>'),
    html.replace('1000', '300'),
    html.replace('add_signalement.php', 'https://example.org/collect'),
    html.replace('type="file"', 'type="file" multiple'),
    html + '<div class="g-recaptcha"></div>',
    html.replace('name="email"', 'name="email" required'),
  ])
    assert.throws(() => inspectRivieraForm(bad), /changed/);
  for (const response of [
    () => new Response('x'.repeat(1000001), { headers: { 'Content-Type': 'text/html' } }),
    () => new Response(html, { status: 302, headers: { Location: 'https://example.org/' } }),
    () => Response.json({ ok: true }),
    () => new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    const f = fixture('vevey', { response });
    await assert.rejects(f.city.categories());
    await assert.rejects(f.city.categories());
    assert.equal(f.calls.length, 1);
  }
});
test('provider HTML instructions are displayed as plain text, never executable content', async () => {
  const f = fixture(),
    d = f.getCategories();
  d.features.find((f) => f.properties.gid_thematique === 2).properties.info =
    '<script>danger()</script><b>Numéro du luminaire</b> <a href="javascript:alert(1)">sur le mât</a>';
  f.setCategories(d);
  const notes = (await f.city.requirements(point))['Eclairage public'].notes.join(' ');
  assert.match(notes, /Numéro du luminaire sur le mât/);
  assert.doesNotMatch(notes, /danger|<|javascript/);
});

test('Riviera email is optional but malformed email and missing email for existing adapters are rejected', async (t) => {
  const f = fixture(),
    { store, service } = await serviceFixture(t, f);
  const preview = await service.prepare({ ...input, email: '' });
  assert.equal(preview.requirements.email_required, false);
  assert.equal(
    (await f.city.buildSubmission(await store.preview(preview.preview_id))).body.has('email'),
    false,
  );
  await assert.rejects(service.prepare({ ...input, email: 'invalid' }));
  const requirements = f.city.requirements.bind(f.city);
  f.city.requirements = async (point) =>
    Object.fromEntries(
      Object.entries(await requirements(point)).map(([name, rule]) => [
        name,
        { ...rule, email_required: undefined },
      ]),
    );
  await assert.rejects(service.prepare({ ...input, email: '' }), /requires an email/);
});

test('overlong provider instructions are rejected instead of silently losing scope restrictions', async () => {
  const f = fixture(),
    d = f.getCategories();
  d.features.find((f) => f.properties.gid_thematique === 2).properties.info = 'x'.repeat(2001);
  f.setCategories(d);
  await assert.rejects(f.city.requirements(point), /changed/);
});
