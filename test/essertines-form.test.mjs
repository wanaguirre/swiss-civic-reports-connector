import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  fingerprintEssertinesForm,
  inspectEssertinesForm,
  essertinesSourcePins,
  essertinesCategories,
  essertinesRequirements,
  essertinesFormUrl,
  verifyEssertinesSources,
} from '../dist/essertines-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const form = gunzipSync(
  await readFile(new URL('fixtures/essertines-contact.html.gz', import.meta.url)),
).toString('utf8');
const municipality = gunzipSync(
  await readFile(new URL('fixtures/essertines-municipality.html.gz', import.meta.url)),
).toString('utf8');
const htmlResponse = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8' },
  });
const robots = await readFile(new URL('fixtures/essertines-robots.txt', import.meta.url), 'utf8');
const bodies = new Map(
  essertinesSourcePins.map((p) => [p.url, p.form ? form : p.plain ? robots : municipality]),
);

test('Essertines complete captured form matches its pin and discards only one shaped opaque state', () => {
  assert.equal(fingerprintEssertinesForm(form), essertinesSourcePins[1].sha256);
  assert.deepEqual(inspectEssertinesForm(form), essertinesCategories);
  const rotated = form.replace('A'.repeat(770) + '==', 'B'.repeat(770) + '==');
  assert.notEqual(rotated, form);
  assert.deepEqual(inspectEssertinesForm(rotated), essertinesCategories);
  const result = JSON.stringify(inspectEssertinesForm(rotated));
  assert.doesNotMatch(result, /state_3|input_17|gform_currency|BBBB|nonce|payload/i);
  assert.throws(() => inspectMunicipalForm('essertines-voirie', form), /complete pinned/);
});

test('Essertines full-byte pins reject recipient, requiredness, protection, scripts, transport and every other source change', () => {
  const mutations = [
    (s) => s.replace('Voirie', 'Another department'),
    (s) => s.replace('gform_3', 'gform_4'),
    (s) => s.replace(/method=(["'])post\1/, 'method="get"'),
    (s) => s.replace(/action=(["'])\/contact\/\1/, 'action="https://example.invalid/"'),
    (s) => s.replace('aria-required="true"', 'aria-required="false"'),
    (s) => s.replace("aria-required='true'", "aria-required='false'"),
    (s) => s.replace('gravityforms.min.js?ver=3.1.2', 'gravityforms.min.js?ver=3.1.3'),
    (s) => s.replace('wpa.js?ver=2.4.02', 'wpa.js?ver=9.9'),
    (s) => s.replace('input_17', 'input_18'),
    (s) => s.replace('gform_currency', 'gform_currency_changed'),
    (s) => s.replace('</form>', '<input type="file" name="photo"></form>'),
    (s) => s + '<input form="gform_3" name="extra">',
    (s) => s + '<script src="https://example.invalid/new.js"></script>',
    (s) => s + '<div class="g-recaptcha"></div>',
    (s) => s + '<input type="hidden" name="state_3" value="' + 'C'.repeat(770) + '==">',
    (s) => s.replace('A'.repeat(770) + '==', 'A'.repeat(769) + '=='),
    (s) => s.replace('A'.repeat(770) + '==', '!'.repeat(770) + '=='),
    (s) => '\ufeff' + s,
    (s) => s + '\n',
  ];
  let changes = 0;
  for (const mutate of mutations) {
    const changed = mutate(form);
    if (changed === form) continue; // quote variants: at least one must mutate the actual capture.
    changes++;
    assert.throws(() => inspectEssertinesForm(changed), /paused/);
  }
  assert.ok(changes >= 17);
  assert.throws(() => inspectEssertinesForm('x'.repeat(1_000_001)), /paused/);
  const rules = essertinesRequirements().Voirie;
  assert.equal(rules.max_photos, 0);
  assert.equal(rules.phone_required, true);
  assert.equal(rules.email_required, true);
  assert.equal(rules.extra_fields.find((f) => f.code === 'reporter_street').required, false);
});

test('Essertines manifest reads only three fixed sources with shared ten-second starts and never executes a client', async () => {
  let clock = 1_000;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init, start: clock });
    assert.ok(bodies.has(url));
    return htmlResponse(bodies.get(url), url.endsWith('/robots.txt'));
  };
  const sleep = async (ms) => {
    clock += ms;
  };
  const values = await Promise.all([
    verifyEssertinesSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
    verifyEssertinesSources(
      request,
      () => {},
      () => clock,
      sleep,
    ),
  ]);
  assert.deepEqual(values, [essertinesCategories, essertinesCategories]);
  assert.equal(calls.length, 6);
  calls.forEach((call, i) => {
    assert.equal(call.init.method, 'GET');
    assert.equal(call.init.credentials, 'omit');
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.body, undefined);
    assert.equal(call.init.headers.Cookie, undefined);
    if (i) assert.ok(call.start - calls[i - 1].start >= 10_000);
  });
});

test('Essertines failures permanently stop shared sources before cached peer reuse, without retry or another channel', async () => {
  const cases = [
    () => new Response('blocked', { status: 403 }),
    () => new Response('limited', { status: 429, headers: { 'retry-after': '3600' } }),
    () =>
      new Response('redirect', { status: 302, headers: { location: 'https://example.invalid/' } }),
    () => new Response(form, { headers: { 'content-type': 'application/json' } }),
    () => htmlResponse(form + 'drift'),
    () => htmlResponse(new Uint8Array([0xc3, 0x28])),
    () => htmlResponse('x'.repeat(1_000_001)),
    () => {
      throw new Error('timeout');
    },
    () => Object.defineProperty(htmlResponse(form), 'redirected', { value: true }),
  ];
  for (let i = 0; i < cases.length; i++) {
    let count = 0;
    const delays = [];
    const request = async () => {
      count++;
      return cases[i]();
    };
    await assert.rejects(
      verifyEssertinesSources(request, (ms) => delays.push(ms)),
      /paused/,
    );
    const city = new MunicipalFormClient('essertines-voirie', request, {
      places: { municipality: async () => ({ bfs_id: 5520 }) },
    });
    city.cached = { value: essertinesCategories, expires: Date.now() + 600_000 };
    await assert.rejects(city.requirements({ latitude: 46.73, longitude: 6.65 }), /paused/);
    await assert.rejects(
      verifyEssertinesSources(request, () => {}),
      /paused/,
    );
    assert.equal(count, 1);
    if (i === 1) assert.deepEqual(delays, [3_600_000]);
  }
});

test('Essertines authority drift stops the context after the form; cache cannot waive responsibility evidence', async () => {
  let clock = 0;
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    return htmlResponse(
      url.endsWith('/robots.txt') ? robots : url === essertinesFormUrl ? form : municipality + '\n',
      url.endsWith('/robots.txt'),
    );
  };
  await assert.rejects(
    verifyEssertinesSources(
      request,
      () => {},
      () => clock,
      async (ms) => {
        clock += ms;
      },
    ),
    /paused/,
  );
  await assert.rejects(
    verifyEssertinesSources(request, () => {}),
    /paused/,
  );
  assert.deepEqual(
    calls,
    essertinesSourcePins.map((p) => p.url),
  );
});

test('Essertines exact BFS gate precedes all source reads and category metadata is read-free', async () => {
  let bfs = 5521,
    count = 0;
  const city = new MunicipalFormClient(
    'essertines-voirie',
    async () => {
      count++;
      return htmlResponse('drift');
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  assert.deepEqual(await city.categories(), essertinesCategories);
  for (const other of [5521, 5859, 261, undefined]) {
    bfs = other;
    await assert.rejects(city.requirements({ latitude: 46.73, longitude: 6.65 }), /outside/);
  }
  assert.equal(count, 0);
  bfs = 5520;
  await assert.rejects(city.requirements({ latitude: 46.73, longitude: 6.65 }), /paused/);
  assert.equal(count, 1);
  assert.equal(city.deliveryLanguage, 'fr');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.equal(city.fallbackPrefilled, false);
  assert.match(city.privacy, /not been qualified/);
  assert.throws(
    () => new MunicipalFormClient('essertines-voirie', undefined, { experimentalSubmission: true }),
    /only implemented/,
  );
  await assert.rejects(city.submit({}), /verification/);
});

test('Essertines frozen local preparation requires private contacts and municipal asset, separates optional postal fields, rejects photos and never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'essertines-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const city = new MunicipalFormClient(
    'essertines-voirie',
    async () => assert.fail('no networking in offline draft'),
    { places: { municipality: async () => ({ bfs_id: 5520 }) } },
  );
  city.requirements = async () => essertinesRequirements();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const input = {
    latitude: 46.73,
    longitude: 6.65,
    location_confirmed: true,
    location_label: 'Offline municipal path',
    category: 'Voirie',
    description: 'Le chemin communal fictif est endommagé.',
    email: 'private@example.invalid',
    phone: '0240000000',
    photo_ids: [],
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      reporter_street: 'PrivateStreet',
      reporter_postcode_locality: 'PrivateTown',
      public_asset_confirmed: 'Actual municipal public asset in Essertines-sur-Yverdon confirmed',
    },
  };
  for (const key of ['first_name', 'last_name', 'public_asset_confirmed']) {
    const fields = { ...input.extra_fields };
    delete fields[key];
    await assert.rejects(service.prepare({ ...input, extra_fields: fields }));
  }
  for (const change of [
    { email: '' },
    { phone: '' },
    { name: 'ForeignCombined' },
    { category: 'Bourse' },
    { description: 'x'.repeat(4001) },
    { extra_fields: { ...input.extra_fields, native_state: 'forbidden' } },
  ])
    await assert.rejects(service.prepare({ ...input, ...change }));
  const image = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(
    service.prepare({ ...input, photo_ids: [image.metadata.id] }),
    /This service accepts at most 0 photo\(s\)/,
  );
  const preview = await service.prepare(input);
  assert.equal(preview.municipality.bfs_id, 5520);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.attachments.length, 0);
  assert.equal(preview.report.extra_fields.reporter_street, 'PrivateStreet');
  await assert.rejects(
    service.submit(preview.preview_id, preview.confirmation_token, true),
    /unverified|verification|disabled/i,
  );
  const optional = {
    ...input,
    extra_fields: {
      first_name: 'PrivateFirst',
      last_name: 'PrivateLast',
      public_asset_confirmed: input.extra_fields.public_asset_confirmed,
    },
  };
  assert.equal((await service.prepare(optional)).submission_enabled, false);
});

test('Essertines policy drift prevents all later source reads and therefore cached preparation', async () => {
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    return htmlResponse(robots.replace('Crawl-delay: 10', 'Disallow: /'), true);
  };
  await assert.rejects(
    verifyEssertinesSources(request, () => {}),
    /paused/,
  );
  const peer = new MunicipalFormClient('essertines-voirie', request, {
    places: { municipality: async () => ({ bfs_id: 5520 }) },
  });
  peer.cached = { value: essertinesCategories, expires: Date.now() + 300_000 };
  await assert.rejects(peer.requirements({ latitude: 46.73, longitude: 6.65 }), /paused/);
  assert.deepEqual(calls, [essertinesSourcePins[0].url]);
});
