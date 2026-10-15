import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  MunicipalFormClient,
  inspectMunicipalForm,
  municipalForms,
} from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const fixtures = Object.fromEntries(
  await Promise.all(
    ['bern', 'fribourg'].map(async (n) => [
      n,
      await readFile(new URL(`fixtures/${n}-form.html`, import.meta.url), 'utf8'),
    ]),
  ),
);
const point = { latitude: 46.95, longitude: 7.44 };
function fixture(name, options = {}) {
  const calls = [];
  let now = 0,
    body = fixtures[name];
  const request = async (url, init) => {
    calls.push({ url: String(url), ...init });
    return (
      options.response?.() ??
      new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    );
  };
  const city = new MunicipalFormClient(name, request, {
    now: () => now,
    places: { municipality: async () => ({ bfs_id: options.bfs ?? municipalForms[name].bfsId }) },
  });
  return {
    city,
    calls,
    advance: (ms) => {
      now += ms;
    },
    body: (v) => {
      body = v;
    },
  };
}
for (const name of ['bern', 'fribourg']) {
  test(`${name}: observed form yields isolated, bounded preparation and no write transport`, async (t) => {
    const f = fixture(name),
      dir = await mkdtemp(join(tmpdir(), 'civic-form-contract-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const store = new Store(dir);
    await store.initialize();
    const service = new ReportService(f.city, store, {
      submissionEnabled: true,
      allowPaths: false,
    });
    const categories = await f.city.categories();
    assert.equal(categories.length, name === 'bern' ? 11 : 1);
    const rules = await f.city.requirements(point),
      rule = rules[categories[0].service_name];
    assert.equal(rule.max_photos, 1);
    assert.equal(rule.name_required, name === 'fribourg');
    assert.deepEqual(rule.contact_fields, name === 'fribourg' ? ['name', 'phone'] : []);
    const input = {
      ...point,
      location_confirmed: true,
      location_label: 'Fictional test location',
      category: categories[0].service_name,
      description: 'Fictional defect used only in a local test.',
      email: 'fictional@example.org',
      photo_ids: [],
      ...(name === 'fribourg'
        ? {
            name: 'Fictional resident',
            extra_fields: {
              reporter_address: 'Fictional street',
              reporter_postcode_city: '1700 Test',
            },
          }
        : { extra_fields: {} }),
    };
    if (name === 'fribourg') {
      await assert.rejects(service.prepare({ ...input, name: '' }), /full name/);
      await assert.rejects(service.prepare({ ...input, extra_fields: {} }), /reporter_address/);
      await assert.rejects(
        service.prepare({
          ...input,
          extra_fields: { ...input.extra_fields, reporter_address: 'x'.repeat(256) },
        }),
        /255/,
      );
    } else
      await assert.rejects(
        service.prepare({ ...input, name: 'Unsupported name' }),
        /does not accept/,
      );
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 10, height: 10, channels: 3, background: '#44aa55' } })
          .png()
          .toBuffer()
      ).toString('base64'),
    });
    const second = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 10, height: 10, channels: 3, background: '#55bb66' } })
          .png()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(
      service.prepare({ ...input, photo_ids: [photo.metadata.id, second.metadata.id] }),
      /at most 1/,
    );
    const preview = await service.prepare({ ...input, photo_ids: [photo.metadata.id] });
    assert.equal(preview.submission_mode, 'unverified');
    assert.equal(preview.submission_enabled, false);
    assert.equal(preview.attachments.length, 1);
    assert.equal(preview.municipality.bfs_id, f.city.bfsId);
    assert.match(preview.fallback_note, /has not been sent/);
    const frozen = await store.preview(preview.preview_id);
    assert.equal(frozen.destination.bfs_id, f.city.bfsId);
    assert.equal(frozen.photos[0].sha256, preview.attachments[0].sha256);
    await assert.rejects(
      service.submit(preview.preview_id, preview.confirmation_token, true),
      /verification/,
    );
    await assert.rejects(f.city.submit(frozen), /verification/);
    assert.equal((await store.receipts()).length, 0);
    const other = new ReportService(fixture(name === 'bern' ? 'fribourg' : 'bern').city, store, {
      submissionEnabled: true,
      allowPaths: false,
    });
    assert.throws(() => other.present(frozen), /different municipality/);
    assert.equal(f.calls.length, 1);
    assert.ok(f.calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
  });
  test(`${name}: concurrent reads share public metadata; fresh checks bypass cache; a different BFS fails closed`, async () => {
    const f = fixture(name);
    await Promise.all([f.city.categories(), f.city.categories(), f.city.requirements(point)]);
    assert.equal(f.calls.length, 1);
    const cats = await f.city.categories();
    cats[0].service_name = 'Tampered';
    assert.notEqual((await f.city.categories())[0].service_name, 'Tampered');
    await f.city.requirements(point, { fresh: true });
    assert.equal(f.calls.length, 2);
    f.advance(300001);
    await f.city.categories();
    assert.equal(f.calls.length, 3);
    const wrong = fixture(name, { bfs: 261 });
    await assert.rejects(wrong.city.requirements(point), /outside/);
    assert.equal(wrong.calls.length, 0);
  });
  test(`${name}: form changes and protected report flows are rejected, unrelated feedback CAPTCHA is ignored`, () => {
    const original = fixtures[name];
    assert.doesNotThrow(() =>
      inspectMunicipalForm(name, original + '<form><div class="g-recaptcha"></div></form>'),
    );
    for (const modified of [
      original.replace('</form>', '<input type="password" name="password"></form>'),
      original.replace('</form>', '<div class="h-captcha"></div></form>'),
      original.replace('</form>', '<iframe src="/challenge"></iframe></form>'),
      original.replace('method="post"', 'method="get"'),
      original.replace(/action="[^"]*"/, 'action="https://example.org/collect"'),
      original.replace('type="file"', 'type="file" multiple'),
      original + original,
      original.replace('type="file"', 'type="file" disabled'),
    ])
      assert.throws(() => inspectMunicipalForm(name, modified), /changed/);
  });
  test(`${name}: oversized, denied, redirected and non-HTML responses never become categories; failures cool down`, async () => {
    for (const response of [
      () => new Response('x'.repeat(1_000_001), { headers: { 'Content-Type': 'text/html' } }),
      () => new Response('Denied', { status: 403 }),
      () => new Response('', { status: 302, headers: { Location: 'https://example.org' } }),
      () => Response.json({ success: true }),
    ]) {
      const f = fixture(name, { response });
      await assert.rejects(f.city.categories());
      await assert.rejects(f.city.categories());
      assert.equal(f.calls.length, 1);
      f.advance(300001);
      await assert.rejects(f.city.categories());
      assert.equal(f.calls.length, 2);
    }
  });
}
test('Fribourg session shape, postal length and required-field drift fail closed', () => {
  for (const html of [
    fixtures.fribourg.replace('form-FICTIONAL_CONTRACT_FIXTURE_ONLY', 'invalid'),
    fixtures.fribourg.replace('value="Envoyer"', 'value="Login"'),
    fixtures.fribourg.replace('name="coordonnees[address]"', 'name="new_address"'),
    fixtures.fribourg.replace('maxlength="255"', 'maxlength="20"'),
  ])
    assert.throws(() => inspectMunicipalForm('fribourg', html), /changed/);
});
test('Bern duplicate category identities fail closed', () => {
  assert.throws(
    () =>
      inspectMunicipalForm(
        'bern',
        fixtures.bern.replace('value="spielplatze"', 'value="sportanlagen"'),
      ),
    /changed/,
  );
});

test('municipal form reads honor a longer Retry-After without automatic retries', async () => {
  const f = fixture('bern', {
    response: () => new Response('Busy', { status: 429, headers: { 'Retry-After': '3600' } }),
  });
  await assert.rejects(f.city.categories());
  f.advance(300001);
  await assert.rejects(f.city.categories());
  assert.equal(f.calls.length, 1);
  f.advance(3300000);
  await assert.rejects(f.city.categories());
  assert.equal(f.calls.length, 2);
});
