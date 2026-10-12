import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtemp, readFile, writeFile, stat, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { CityClient, distance } from '../dist/city.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';
import { importPhoto, hash } from '../dist/photos.js';
import { reportInput } from '../dist/model.js';

const point = { latitude: 47.370183, longitude: 8.535284 };
const input = { ...point, location_label: 'Basteiplatz, Zürich', location_confirmed: true,
  category: 'Abfall/Sammelstelle', description: 'Ein Abfallbehälter ist überfüllt.', email: 'resident@example.org', photo_ids: [], extra_fields: {} };
const rules = { 'Abfall/Sammelstelle': { category_photo_required: 0, bodies: ['ERZ'] },
  Graffiti: { category_photo_required: 1, bodies: ['Fachstelle Graffiti'] } };

async function setup(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'zurich-mcp-test-'));
  let now = Date.now();
  const store = new Store(dir, () => now);
  await store.initialize();
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: new URL(url), ...init });
    if (init.method === 'POST') {
      if (options.onPost) return options.onPost(url, init);
      return Response.json(options.response ?? { success: 1, report: 1234 });
    }
    if (String(url).includes('/report/new/ajax')) return Response.json(options.locationError ? { error: 'Outside Zürich' } : { by_category: options.rules ?? rules });
    if (String(url).includes('/services.json')) return Response.json({ services: [{ service_code: 'Abfall/Sammelstelle', service_name: 'Abfall/Sammelstelle' }] });
    if (String(url).includes('SearchServer')) return Response.json({ results: [{ attrs: { label: 'Basteiplatz <b>Zürich</b>', lat: point.latitude, lon: point.longitude } }] });
    return Response.json({ service_requests: options.reports ?? [] });
  };
  const city = new CityClient(fetcher);
  const service = new ReportService(city, store, { submissionEnabled: options.enabled ?? true, allowPaths: true });
  return { dir, calls, city, store, service, advance: ms => { now += ms; }, posts: () => calls.filter(c => c.method === 'POST') };
}
const photoBytes = () => sharp({ create: { width: 32, height: 24, channels: 3, background: '#00aabb' } }).jpeg().toBuffer();

test('preparation validates live location and category but never submits', async () => {
  const f = await setup();
  const p = await f.service.prepare(input);
  assert.equal(f.posts().length, 0);
  assert.equal(p.report.category, input.category);
  assert.equal(new URL(p.official_form_url).searchParams.get('prefill_description'), input.description);
  assert.equal(new URL(p.official_form_url).searchParams.has('email'), false);
  assert.equal((await stat(join(f.dir, `preview-${p.preview_id}.json`))).mode & 0o777, 0o600);
  assert.equal((await stat(f.dir)).mode & 0o777, 0o700);
});

test('rejects outside-city locations, unknown categories and unconfirmed location', async () => {
  const f = await setup({ locationError: true });
  await assert.rejects(() => f.service.prepare(input), /Outside/);
  const valid = await setup();
  await assert.rejects(() => valid.service.prepare({ ...input, category: 'Invented' }), /Category/);
  await assert.rejects(() => valid.service.prepare({ ...input, location_confirmed: false }));
  assert.equal(f.posts().length + valid.posts().length, 0);
});

test('live photo and phone requirements are enforced', async () => {
  const f = await setup();
  await assert.rejects(() => f.service.prepare({ ...input, category: 'Graffiti' }), /requires a photo/);
  const phone = await setup({ rules: { ...rules, 'Abfall/Sammelstelle': { phone_required: 1 } } });
  await assert.rejects(() => phone.service.prepare(input), /phone number/);
  const p = await phone.service.prepare({ ...input, phone: '+41 00 000 00 00' });
  assert.equal(p.requirements.phone_required, true);
});

test('required extras validated and cannot override standard submission fields', async () => {
  const f = await setup({ rules: { 'Abfall/Sammelstelle': { category_extra_json: [{ code: 'mast_nr', description: 'Mast number', required: true }] } } });
  await assert.rejects(() => f.service.prepare(input), /requires extra field/);
  await assert.rejects(() => f.service.prepare({ ...input, extra_fields: { mast_nr: '1', email: 'intruder@example.org' } }), /Unsupported/);
  const hostile = await setup({ rules: { 'Abfall/Sammelstelle': { category_extra_json: [{ code: 'email', required: false }] } } });
  await assert.rejects(() => hostile.service.prepare({ ...input, extra_fields: { email: 'intruder@example.org' } }), /Unsupported/);
  await f.service.prepare({ ...input, extra_fields: { mast_nr: 'A12' } });
});

test('EXIF extraction happens before metadata removal and stored photo is immutable', async () => {
  const f = await setup();
  const bytes = await sharp(await photoBytes()).withExif({ IFD0: { Artist: 'Private photographer' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '47/1 22/1 12/1', GPSLongitudeRef: 'E', GPSLongitude: '8/1 32/1 6/1' } }).toBuffer();
  const path = join(f.dir, 'original.jpg');
  await writeFile(path, bytes);
  const photo = await f.service.inspectPhoto({ path });
  assert.equal(photo.metadata.width, 32);
  assert.ok(photo.image.length > 0);
  const stored = await f.store.photo(photo.metadata.id);
  assert.equal((await sharp(Buffer.from(stored.jpeg, 'base64')).metadata()).exif, undefined);
  assert.ok(Math.abs(stored.gps.latitude - 47.37) < 0.0001);
  await writeFile(path, 'changed after importing');
  const p = await f.service.prepare({ ...input, category: 'Graffiti', photo_ids: [stored.id] });
  await f.service.submit(p.preview_id, p.confirmation_token, true);
  const upload = f.posts()[0].body.get('photo1');
  assert.equal(hash(Buffer.from(await upload.arrayBuffer())), stored.sha256);
});

test('photo rejects non-image, SVG, multiple sources, symlink and HTTP local paths', async () => {
  const f = await setup();
  await assert.rejects(() => importPhoto({ base64: Buffer.from('hello').toString('base64') }, true));
  await assert.rejects(() => importPhoto({ base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>').toString('base64') }, true), /JPEG/);
  await assert.rejects(() => importPhoto({ path: '/tmp/a', base64: 'aaaa' }, true), /exactly one/);
  await assert.rejects(() => importPhoto({ path: '/etc/passwd' }, false), /disabled/);
  await assert.rejects(() => importPhoto({ base64: 'abc*' }, true), /Invalid/);
  await writeFile(join(f.dir, 'real.jpg'), await photoBytes());
  await symlink(join(f.dir, 'real.jpg'), join(f.dir, 'link.jpg'));
  await assert.rejects(() => importPhoto({ path: join(f.dir, 'link.jpg') }, true));
});

test('draft expires and physical cleanup removes expired photos and drafts', async () => {
  const f = await setup();
  await f.service.inspectPhoto({ base64: (await photoBytes()).toString('base64') });
  const p = await f.service.prepare(input);
  f.advance(60 * 60 * 1000 + 1);
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, true), /expired/);
  await f.store.cleanup();
  assert.deepEqual(await readdir(f.dir), []);
  assert.equal(f.posts().length, 0);
});

test('confirmation, matching token and opt-in configuration are all required', async () => {
  const f = await setup();
  const p = await f.service.prepare(input);
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, false), /approval/);
  await assert.rejects(() => f.service.submit(p.preview_id, 'wrong', true), /token/);
  const disabled = new ReportService(f.city, f.store, { submissionEnabled: false, allowPaths: true });
  await assert.rejects(() => disabled.submit(p.preview_id, p.confirmation_token, true), /disabled/);
  assert.equal(f.posts().length, 0);
});

test('integrity check prevents modified preview from being submitted', async () => {
  const f = await setup();
  const p = await f.service.prepare(input);
  const filename = join(f.dir, `preview-${p.preview_id}.json`);
  const altered = JSON.parse(await readFile(filename));
  altered.input.description = 'Changed after approval';
  await writeFile(filename, JSON.stringify(altered));
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, true), /integrity/);
  assert.equal(f.posts().length, 0);
});

test('city requirements are rechecked immediately before writing', async () => {
  const mutableRules = structuredClone(rules);
  const f = await setup({ rules: mutableRules });
  const p = await f.service.prepare(input);
  mutableRules['Abfall/Sammelstelle'].category_photo_required = 1;
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, true), /requires a photo/);
  assert.equal(f.posts().length, 0);
});

test('multipart submission sends only frozen inputs with name publication disabled', async () => {
  const f = await setup();
  const p = await f.service.prepare({ ...input, name: 'Test Resident' });
  const result = await f.service.submit(p.preview_id, p.confirmation_token, true);
  assert.equal(result.state, 'accepted');
  assert.equal(result.url, 'https://www.zueriwieneu.ch/report/1234');
  const post = f.posts()[0];
  assert.equal(post.url.href, 'https://www.zueriwieneu.ch/report/new/mobile');
  assert.equal(post.redirect, 'error');
  assert.equal(post.body.get('detail'), input.description);
  assert.equal(post.body.get('email'), input.email);
  assert.equal(post.body.get('lat'), String(point.latitude));
  assert.equal(post.body.get('may_show_name'), '0');
  assert.equal(post.body.get('submit_register'), '1');
});

test('concurrent submissions and a new identical preview result in just one POST', async () => {
  const f = await setup({ onPost: async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return Response.json({ success: 1, report: 1234 });
  } });
  const first = await f.service.prepare(input), second = await f.service.prepare(input);
  await Promise.all([
    f.service.submit(first.preview_id, first.confirmation_token, true),
    f.service.submit(first.preview_id, first.confirmation_token, true),
    f.service.submit(second.preview_id, second.confirmation_token, true),
  ]);
  assert.equal(f.posts().length, 1);
  const restarted = new ReportService(f.city, new Store(f.dir), f.service.options);
  assert.equal((await restarted.submit(second.preview_id, second.confirmation_token, true)).already_attempted, true);
  assert.equal(f.posts().length, 1);
});

test('uncertain responses are persisted and never retried, including after restart', async () => {
  for (const onPost of [async () => { throw new Error('timeout'); }, async () => new Response('<html>error</html>'), async () => Response.json({}, { status: 500 })]) {
    const f = await setup({ onPost });
    const p = await f.service.prepare(input);
    assert.equal((await f.service.submit(p.preview_id, p.confirmation_token, true)).state, 'unknown');
    const restarted = new ReportService(f.city, new Store(f.dir), f.service.options);
    assert.equal((await restarted.submit(p.preview_id, p.confirmation_token, true)).state, 'unknown');
    assert.equal(f.posts().length, 1);
    assert.equal((await f.store.receipts())[0].state, 'unknown');
  }
});

test('crash after claim blocks retransmission', async () => {
  const f = await setup();
  const p = await f.service.prepare(input);
  await f.store.claim(await f.store.preview(p.preview_id));
  const result = await f.service.submit(p.preview_id, p.confirmation_token, true);
  assert.equal(result.state, 'sending');
  assert.equal(result.already_attempted, true);
  assert.equal(f.posts().length, 0);
});

test('city dispatch waits for durable publication of its claim', async t => {
  const f = await setup();
  const p = await f.service.prepare(input);
  const open = fs.open;
  let entered, release;
  const syncing = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(fs, 'open', async (path, ...args) => {
    const handle = await open(path, ...args);
    if (path === f.dir) {
      const sync = handle.sync.bind(handle);
      t.mock.method(handle, 'sync', async () => { entered(); await gate; await sync(); });
    }
    return handle;
  });
  const sending = f.service.submit(p.preview_id, p.confirmation_token, true);
  await syncing;
  assert.equal(f.posts().length, 0);
  release();
  assert.equal((await sending).state, 'accepted');
  assert.equal(f.posts().length, 1);
});

test('failed claim directory sync prevents dispatch and keeps the attempt blocked after restart', async t => {
  const f = await setup();
  const p = await f.service.prepare(input);
  const open = fs.open;
  const hook = t.mock.method(fs, 'open', async (path, ...args) => {
    const handle = await open(path, ...args);
    if (path === f.dir) t.mock.method(handle, 'sync', async () => { throw new Error('injected disk failure'); });
    return handle;
  });
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, true), /storage could not be synchronized/);
  assert.equal(f.posts().length, 0);
  hook.mock.restore();
  const restarted = new ReportService(f.city, new Store(f.dir), f.service.options);
  const result = await restarted.submit(p.preview_id, p.confirmation_token, true);
  assert.equal(result.already_attempted, true);
  assert.equal(result.state, 'sending');
  assert.equal(f.posts().length, 0);
});

test('interrupted ancestor setup is synchronized again before publishing a preview', async t => {
  const f = await setup();
  const parent = join(f.dir, 'new-users');
  const directory = join(parent, 'identity');
  const store = new Store(directory);
  const service = new ReportService(f.city, store, f.service.options);
  const open = fs.open;
  let fail = true;
  const synchronized = [];
  t.mock.method(fs, 'open', async (path, ...args) => {
    const handle = await open(path, ...args);
    const sync = handle.sync.bind(handle);
    t.mock.method(handle, 'sync', async () => {
      if (path === parent && fail) throw new Error('injected ancestor failure');
      await sync(); synchronized.push(path);
    });
    return handle;
  });
  await assert.rejects(() => service.prepare(input), /storage could not be synchronized/);
  assert.deepEqual(await readdir(directory), []);
  assert.equal(f.posts().length, 0);
  fail = false;
  await service.prepare(input);
  assert.ok(synchronized.includes(parent));
  assert.ok(synchronized.includes(f.dir));
});

test('receipt replacement sync failure cannot authorize a second city request', async t => {
  const f = await setup();
  const p = await f.service.prepare(input);
  const open = fs.open;
  const hook = t.mock.method(fs, 'open', async (path, ...args) => {
    const handle = await open(path, ...args);
    if (path === f.dir && f.posts().length) t.mock.method(handle, 'sync', async () => { throw new Error('injected disk failure'); });
    return handle;
  });
  await assert.rejects(() => f.service.submit(p.preview_id, p.confirmation_token, true), /storage could not be synchronized/);
  assert.equal(f.posts().length, 1);
  assert.ok(!(await readdir(f.dir)).some(name => name.endsWith('.tmp')));
  hook.mock.restore();
  const restarted = new ReportService(f.city, new Store(f.dir), f.service.options);
  assert.equal((await restarted.submit(p.preview_id, p.confirmation_token, true)).already_attempted, true);
  assert.equal(f.posts().length, 1);
});

test('accepted without an ID requests email follow-up without inventing a report number', async () => {
  const f = await setup({ response: { success: 1 } });
  const p = await f.service.prepare(input);
  const result = await f.service.submit(p.preview_id, p.confirmation_token, true);
  assert.equal(result.state, 'confirmation_pending');
  assert.equal(result.report_id, undefined);
  assert.equal(result.url, undefined);
});

test('city validation rejection is distinguishable from unknown outcomes', async () => {
  const f = await setup({ response: { errors: { email: 'Email required' } } });
  const p = await f.service.prepare(input);
  assert.equal((await f.service.submit(p.preview_id, p.confirmation_token, true)).state, 'rejected');
  assert.equal((await f.service.submit(p.preview_id, p.confirmation_token, true)).already_attempted, true);
  assert.equal(f.posts().length, 1);
});

test('contact details and photos are absent from persistent receipts; the sent text is kept', async () => {
  const f = await setup();
  const p = await f.service.prepare(input);
  await f.service.submit(p.preview_id, p.confirmation_token, true);
  const json = JSON.stringify(await f.store.receipts());
  assert.ok(!json.includes(input.email));
  assert.ok(!json.includes('confirmation_token'));
  assert.ok(!/jpeg|photo/i.test(json));
  // The resident's history shows what was reported.
  assert.ok(json.includes(JSON.stringify(input.description)));
});

test('geocoder returns candidates, strips HTML, and never auto-selects', async () => {
  const f = await setup();
  const candidates = await f.city.geocode('Basteiplatz Zürich');
  assert.equal(candidates[0].label, 'Basteiplatz Zürich');
  assert.equal(candidates[0].confirmed, undefined);
});

test('Open311 wrappers, string coordinates and closed status handled accurately', async () => {
  const f = await setup({ reports: [{ service_request_id: 42, status: 'closed', lat: String(point.latitude), long: String(point.longitude), detail: 'Cleaning planned.' },
    { service_request_id: 43, status: 'open', lat: '46.948', long: '7.4474' }] });
  assert.equal((await f.city.categories())[0].service_code, input.category);
  const result = await f.city.nearby(point, 200, 30);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].distance_m, 0);
  assert.match(result.matches[0].status_meaning, /does not establish/);
  assert.match(result.coverage, /Pending, private/);
  assert.ok(distance(point, { latitude: 46.948, longitude: 7.4474 }) > 90000);
  await assert.rejects(() => f.city.reports({ id: '../../evil' }), /digits/);
});

test('unknown user input fields rejected, optional fields have stable defaults', () => {
  assert.throws(() => reportInput.parse({ ...input, submit_sign_in: '1' }));
  assert.deepEqual(reportInput.parse({ ...input, photo_ids: undefined }).photo_ids, []);
});
