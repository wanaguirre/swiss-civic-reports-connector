import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectStaefaLayout,
  inspectStaefaTranslations,
  staefaCategories,
  staefaLayoutUrl,
  staefaTranslationsUrl,
} from '../dist/staefa-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const layout = JSON.parse(
  await readFile(new URL('fixtures/staefa-layout.json', import.meta.url), 'utf8'),
);
const translations = JSON.parse(
  await readFile(new URL('fixtures/staefa-translations.json', import.meta.url), 'utf8'),
);
test('Stäfa pins only the exact selected public form and relevant translations', () => {
  inspectStaefaLayout(layout);
  assert.deepEqual(
    inspectStaefaTranslations(translations).map((c) => c.service_name),
    staefaCategories,
  );
  const unrelated = structuredClone(layout);
  unrelated.dynFormFields.counter.push({ formId: 'unrelated', hidden: true });
  inspectStaefaLayout(unrelated);
  const reorder = (v) =>
    Array.isArray(v)
      ? v.map(reorder)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reorder(x)]),
          )
        : v;
  inspectStaefaLayout(reorder(layout));
  inspectStaefaTranslations(reorder(translations));
  for (const mutate of [
    (f) => {
      f.public = 'private';
    },
    (f) => {
      f.loggedOutDisable = true;
    },
    (f) => {
      f.hidden = true;
    },
    (f) => {
      f.formFields[0].rowFields.push({ key: 'captcha', required: true });
    },
    (f) => {
      f.formFields[0].rowFields.find((f) => f.key === 'phone').required = false;
    },
    (f) => {
      f.formFields[0].rowFields.find((f) => f.key === 'phone').controlType = 'file';
    },
    (f) => {
      f.formFields[0].rowFields.find((f) => f.key === 'deffectiveReason').selectOptions[0].text =
        'other';
    },
    (f) => {
      f.formFields[0].visibility = 'login';
    },
  ]) {
    const bad = structuredClone(layout);
    mutate(bad.dynFormFields.counter[0]);
    assert.throws(() => inspectStaefaLayout(bad), /changed/);
  }
  const duplicate = structuredClone(layout);
  duplicate.dynFormFields.counter.push(duplicate.dynFormFields.counter[0]);
  assert.throws(() => inspectStaefaLayout(duplicate), /changed/);
  const bad = structuredClone(translations);
  bad.common.deffectiveReason1 = 'different';
  assert.throws(() => inspectStaefaTranslations(bad), /changed/);
});
test('Stäfa boundary precedes public tenant reads; contact, no-email/photo and no-send semantics are explicit', async () => {
  const calls = [];
  let bfs = 157;
  const city = new MunicipalFormClient(
    'staefa',
    async (url, init) => {
      calls.push({ url, ...init });
      return new Response(JSON.stringify(url === staefaLayoutUrl ? layout : translations), {
        headers: { 'content-type': 'application/json' },
      });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const point = { latitude: 47.24, longitude: 8.72 };
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, 0);
  bfs = 158;
  const req = await city.requirements(point);
  for (const r of Object.values(req)) {
    assert.equal(r.max_photos, 0);
    assert.equal(r.email_required, false);
    assert.equal(r.phone_required, true);
    assert.equal(r.extra_fields.find((f) => f.code === 'first_name').contact, true);
  }
  assert.equal(city.bfsId, 158);
  assert.equal(city.serviceId, 'staefa-defect-form');
  assert.equal(city.submissionMode, 'unverified');
  assert.equal(city.trackingSupported, false);
  assert.deepEqual(
    calls.map((c) => c.url),
    [staefaLayoutUrl, staefaTranslationsUrl],
  );
  for (const c of calls) {
    assert.equal(c.method, 'GET');
    assert.equal(c.redirect, 'error');
    assert.equal(c.headers.tenant, 'GWS');
    assert.equal(c.headers.backoffice, 'false');
    assert.equal(c.headers.Authorization, undefined);
  }
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report(), /unverified/);
  assert.throws(
    () => new MunicipalFormClient('staefa', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.equal(calls.length, 2);
});
test('Stäfa rejects schema drift before translations, clears stale cache, and backs off on 429', async () => {
  let now = 0,
    count = 0,
    bad = false,
    throttled = false;
  const city = new MunicipalFormClient(
    'staefa',
    async (url) => {
      count++;
      if (throttled) return new Response('', { status: 429, headers: { 'retry-after': '600' } });
      return new Response(
        JSON.stringify(url === staefaLayoutUrl ? (bad ? {} : layout) : translations),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    { now: () => now },
  );
  await city.categories();
  assert.equal(count, 2);
  now = 300001;
  bad = true;
  await assert.rejects(city.categories(), /changed/);
  assert.equal(count, 3);
  await assert.rejects(city.categories(), /changed/);
  assert.equal(count, 3);
  now += 300001;
  bad = false;
  throttled = true;
  await assert.rejects(city.categories(), /changed/);
  now += 300001;
  await assert.rejects(city.categories(), /changed/);
  assert.equal(count, 4);
});
