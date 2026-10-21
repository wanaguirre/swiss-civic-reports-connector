import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  egsSources,
  egsCategories,
  egsMunicipalities,
  egsRequirements,
  egsFormUrl,
  paceEgsSourceReads,
  loadEgsCategories,
  assertEgsSourcesAvailable,
} from '../dist/egs-form.js';
import { MunicipalFormClient, inspectMunicipalForm } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('EGS preserves two identities, native fault typo, required precise location and optional street/company without inventing postal/consent fields', () => {
  assert.equal(egsSources.length, 9);
  assert.ok(Object.isFrozen(egsSources) && egsSources.every(Object.isFrozen));
  assert.equal(egsSources[1].type, 'pdf');
  assert.equal(egsCategories[1].service_code, 'Lampe brennt unreglemässig');
  assert.equal(egsCategories[1].service_name, 'Lampe brennt unregelmässig');
  for (const name of Object.keys(egsMunicipalities)) {
    assert.throws(
      () => inspectMunicipalForm(name, '<form>independent fixture</form>'),
      /complete pinned/,
    );
    const r = egsRequirements(name)[egsCategories[0].service_code];
    assert.equal(r.max_photos, 0);
    assert.ok(r.extra_fields.find((f) => f.code === 'lighting_location').required);
    for (const code of ['lighting_street', 'lamp_number', 'contact_company'])
      assert.equal(r.extra_fields.find((f) => f.code === code).required, false);
    for (const code of ['first_name', 'last_name', 'salutation', 'contact_company'])
      assert.equal(r.extra_fields.find((f) => f.code === code).contact, true);
    assert.ok(
      !r.extra_fields.some((f) => /postcode|reporter_street|consent|captcha|token/.test(f.code)),
    );
  }
});
test('EGS serializes concurrent source reads across both destinations at ten-second starts, shares403 stop and429 Retry-After without retry', async () => {
  let now = 0;
  const calls = [],
    sleeps = [];
  const deadline = new AbortController();
  const transport = async (u, i) => {
    assert.equal(i.signal.aborted, false);
    calls.push({ u, i, at: now });
    return new Response('local source');
  };
  const sleep = async (ms) => {
    deadline.abort();
    sleeps.push(ms);
    now += ms;
  };
  const a = paceEgsSourceReads(transport, () => now, sleep),
    b = paceEgsSourceReads(transport, () => now, sleep);
  await Promise.all([
    a('https://www.egs-strom.ch/one', { signal: deadline.signal }),
    b('https://www.egs-strom.ch/two', { signal: deadline.signal }),
    a('https://www.egs-strom.ch/three', { signal: deadline.signal }),
  ]);
  assert.deepEqual(
    calls.map((c) => c.at),
    [0, 10000, 20000],
  );
  assert.deepEqual(sleeps, [10000, 10000]);
  for (const status of [403, 429]) {
    let n = 0,
      t = 0;
    const raw = async () => {
      n++;
      return new Response('', { status, headers: { 'retry-after': '600' } });
    };
    const reader = paceEgsSourceReads(
      raw,
      () => t,
      async (ms) => {
        t += ms;
      },
    );
    assert.equal((await reader(egsFormUrl)).status, status);
    await assert.rejects(reader(egsFormUrl), /paused/);
    t = 300001;
    await assert.rejects(reader(egsFormUrl), /paused/);
    assert.equal(n, 1);
    t = 600001;
    if (status === 403) await assert.rejects(reader(egsFormUrl), /paused/);
    else assert.equal((await reader(egsFormUrl)).status, 429);
    assert.equal(n, status === 403 ? 1 : 2);
  }
});
test('EGS published categories need no GET; exact municipality gate precedes source reads and all experimental sends are rejected', async () => {
  for (const [name, cfg] of Object.entries(egsMunicipalities)) {
    let bfs = cfg.bfsId === 4038 ? 4044 : 4038;
    const calls = [];
    const c = new MunicipalFormClient(
      name,
      async (u, i) => {
        calls.push([u, i]);
        return new Response('independent changed form', {
          headers: { 'content-type': 'text/html' },
        });
      },
      { places: { municipality: async () => ({ bfs_id: bfs }) } },
    );
    assert.deepEqual(await c.categories(), egsCategories);
    assert.equal(calls.length, 0);
    await assert.rejects(c.requirements({ latitude: 47.487, longitude: 8.327 }), /outside/);
    assert.equal(calls.length, 0);
    bfs = cfg.bfsId;
    await assert.rejects(c.requirements({ latitude: 47.487, longitude: 8.327 }), /changed/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], egsFormUrl);
    assert.equal(calls[0][1].method, 'GET');
    assert.equal(calls[0][1].credentials, 'omit');
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal(calls[0][1].body, undefined);
    await assert.rejects(c.requirements({ latitude: 47.487, longitude: 8.327 }), /paused|changed/);
    assert.equal(calls.length, 1);
    assert.equal(c.termsUrl, undefined);
    assert.equal(c.submissionMode, 'unverified');
    assert.equal(c.trackingSupported, false);
    assert.equal(c.fallbackPrefilled, false);
    await assert.rejects(c.submit({}), /verification/);
    await assert.rejects(c.report('offline'), /unverified/);
    assert.throws(
      () => new MunicipalFormClient(name, fetch, { experimentalSubmission: true }),
      /only implemented/,
    );
  }
});
test('EGS complete-source mismatch and rate-limit invalidate shared source use, wrong MIME/redirect/status fail closed', async () => {
  let now = 0,
    n = 0,
    retry = 0;
  const request = async () => {
    n++;
    return new Response('', { status: 429, headers: { 'retry-after': '600' } });
  };
  await assert.rejects(
    loadEgsCategories(
      request,
      (ms) => {
        retry = ms;
      },
      () => now,
    ),
    /changed/,
  );
  assert.equal(retry, 600000);
  now = 300001;
  assert.throws(() => assertEgsSourcesAvailable(request, () => now), /paused/);
  await assert.rejects(
    loadEgsCategories(
      request,
      () => {},
      () => now,
    ),
    /paused/,
  );
  assert.equal(n, 1);
  now = 600001;
  await assert.rejects(
    loadEgsCategories(
      request,
      () => {},
      () => now,
    ),
    /changed/,
  );
  assert.equal(n, 2);
  for (const make of [
    () => new Response('<form>own fixture</form>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => new Response('', { status: 403 }),
    () => {
      const r = new Response('', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
  ]) {
    let calls = 0;
    const raw = async () => {
      calls++;
      return make();
    };
    await assert.rejects(
      loadEgsCategories(raw, () => {}),
      /changed/,
    );
    assert.throws(() => assertEgsSourcesAvailable(raw), /paused/);
    assert.equal(calls, 1);
  }
});
test('EGS freezes separate destinations, requires private contacts and actual precise point, preserves optional leading-zero number and cannot attach/send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'egs-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, cfg] of Object.entries(egsMunicipalities)) {
    const store = new Store(join(dir, name));
    await store.initialize();
    const city = new MunicipalFormClient(
      name,
      async () => assert.fail('offline rule double must not fetch'),
      { places: { municipality: async () => ({ bfs_id: cfg.bfsId }) } },
    );
    city.requirements = async () => egsRequirements(name);
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      latitude: cfg.bfsId === 4038 ? 47.487 : 47.505,
      longitude: cfg.bfsId === 4038 ? 8.327 : 8.255,
      location_confirmed: true,
      location_label: 'Offline actual lamp point',
      category: egsCategories[1].service_code,
      description: 'Fictional offline lamp fault.',
      email: 'private@example.invalid',
      phone: '0560000000',
      photo_ids: [],
      extra_fields: {
        first_name: 'PrivateFirst',
        last_name: 'PrivateSurname',
        salutation: 'Frau',
        lighting_location: 'Beside the confirmed public footpath bench',
        public_lamp_confirmed: `Public lamp in ${cfg.municipality} maintained by EGS confirmed`,
      },
    };
    for (const code of Object.keys(input.extra_fields)) {
      const extra_fields = { ...input.extra_fields };
      delete extra_fields[code];
      await assert.rejects(service.prepare({ ...input, extra_fields }), new RegExp(code));
    }
    for (const change of [
      { phone: '' },
      { email: '' },
      { name: 'Combined name' },
      { category: 'Water' },
      { phone: '1'.repeat(51) },
      { description: 'x'.repeat(4001) },
      { extra_fields: { ...input.extra_fields, lighting_location: 'x'.repeat(501) } },
      { extra_fields: { ...input.extra_fields, reporter_street: 'Invented private field' } },
    ])
      await assert.rejects(service.prepare({ ...input, ...change }));
    const p = await service.prepare(input);
    assert.equal(p.report.category, 'Lampe brennt unreglemässig');
    assert.equal(p.report.extra_fields.lighting_street, undefined);
    assert.equal(p.report.extra_fields.lamp_number, undefined);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_enabled, false);
    const f = await store.preview(p.preview_id);
    assert.equal(f.destination.bfs_id, cfg.bfsId);
    assert.equal(f.destination.service_id, name + '-defect-form');
    const q = await service.prepare({
      ...input,
      extra_fields: {
        ...input.extra_fields,
        lighting_street: 'ActualLampStreet',
        lamp_number: '0007-A',
        contact_company: 'PrivateCompany',
      },
    });
    assert.equal(q.report.extra_fields.lamp_number, '0007-A');
    assert.equal(q.report.extra_fields.contact_company, 'PrivateCompany');
    const photo = await service.inspectPhoto({
      base64: (
        await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } })
          .jpeg()
          .toBuffer()
      ).toString('base64'),
    });
    await assert.rejects(
      service.prepare({ ...input, photo_ids: [photo.metadata.id] }),
      /at most 0/,
    );
    await assert.rejects(service.submit(q.preview_id, q.confirmation_token, true), /verification/);
    assert.equal((await store.receipts()).length, 0);
  }
});
