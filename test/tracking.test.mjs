import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CityClient } from '../dist/city.js';
import { Store } from '../dist/store.js';
import { ReportService } from '../dist/service.js';
import { textHash } from '../dist/tracking.js';

// Fictional reports only; every city call is answered here and nothing is sent.
const START = Date.parse('2026-10-10T10:00:00Z');
const point = { latitude: 47.370183, longitude: 8.535284 };
const input = {
  ...point,
  location_label: 'Basteiplatz, Zürich',
  location_confirmed: true,
  category: 'Abfall/Sammelstelle',
  description: 'Ein Abfallbehälter ist überfüllt.\nBitte leeren.',
  email: 'resident@example.org',
  photo_ids: [],
  extra_fields: {},
};
const rules = {
  'Abfall/Sammelstelle': { category_photo_required: 0, bodies: ['ERZ'] },
  Graffiti: { category_photo_required: 0, bodies: ['Graffiti'] },
};
// A report in the city's public list, published one minute after sending.
const published = (fields) => ({
  service_request_id: 90001,
  status: 'open',
  service_code: input.category,
  lat: String(point.latitude),
  long: String(point.longitude),
  requested_datetime: new Date(START + 60_000).toISOString(),
  interface_used: 'MCP',
  detail: input.description,
  ...fields,
});

async function setup({ post = { success: 1 }, list = [], byId = {}, failReads = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'civic-tracking-test-'));
  let now = START;
  const calls = [];
  const city = new CityClient(async (url, init = {}) => {
    const target = new URL(url);
    calls.push({ url: target, method: init.method ?? 'GET' });
    if (init.method === 'POST') return Response.json(post);
    if (target.pathname === '/report/new/ajax') return Response.json({ by_category: rules });
    if (failReads) return new Response('unavailable', { status: 503 });
    const id = target.pathname.match(/\/requests\/(\d+)\.json$/)?.[1];
    if (id)
      return byId[id]
        ? Response.json({ service_requests: [byId[id]] })
        : new Response('not found', { status: 404 });
    return Response.json({
      service_requests: target.pathname === '/open311/v2/requests.json' ? list : [],
    });
  });
  const store = new Store(dir, () => now);
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const p = await service.prepare(input);
  const receipt = await service.submit(p.preview_id, p.confirmation_token, true);
  // Only reads of reports count: preparation also reads the nearby list once.
  const reads = () =>
    calls.filter((c) => c.url.pathname.startsWith('/open311/v2/requests')).length - 1;
  return {
    service,
    store,
    receipt,
    reads,
    posts: () => calls.filter((c) => c.method === 'POST').length,
    advance: (ms) => {
      now += ms;
    },
  };
}
const tracked = async (f) => (await f.service.receipts(true)).receipts[0];

test('a sent report keeps a summary with the text sent, never contact details', async () => {
  const f = await setup();
  assert.equal(f.receipt.state, 'confirmation_pending');
  assert.deepEqual(f.receipt.summary, {
    municipality: { bfs_id: 261, name: 'Zürich', reporting_service: 'Züri wie neu' },
    category: input.category,
    location_label: input.location_label,
    ...point,
    text_sha256: textHash(input.description),
    description: input.description,
  });
  const stored = JSON.stringify(await f.store.receipts());
  assert.ok(stored.includes('überfüllt') && !stored.includes(input.email));
});

test('the sent text and the city reply are translated once per language read, and again when the reply changes', async () => {
  const f = await setup(),
    fingerprint = f.receipt.fingerprint,
    checked_at = new Date(START).toISOString();
  await f.store.saveReceipt({
    ...f.receipt,
    tracking: { checked_at, status: 'closed', reply: 'Grüezi\r\n\r\nDer Behälter wird geleert.' },
  });
  const calls = [],
    translate = async (text, from, to) => {
      calls.push([text, from, to]);
      return `${to}: ${text}`;
    };
  const english = await f.service.translateReceipt(fingerprint, 'en', translate);
  assert.deepEqual(english, {
    reply: 'en: Grüezi\nDer Behälter wird geleert.',
    description: `en: ${input.description}`,
  });
  assert.deepEqual(
    calls.map((c) => c.slice(1)),
    [
      ['de', 'en'],
      ['de', 'en'],
    ],
  );
  // Reading again in English reuses the kept translations, with or without AI.
  assert.deepEqual(await f.service.translateReceipt(fingerprint, 'en'), english);
  // Another language is added only when the report is read in it.
  await f.service.translateReceipt(fingerprint, 'es', translate);
  assert.equal(calls.length, 4);
  assert.deepEqual(Object.keys((await f.store.receipts())[0].translations).sort(), ['en', 'es']);
  // The delivery language needs no translation.
  assert.deepEqual(await f.service.translateReceipt(fingerprint, 'de', translate), {});
  // A status refresh that started earlier keeps them; a changed reply is translated again.
  const stale = await f.store.saveReceipt({
    ...f.receipt,
    tracking: { checked_at, status: 'closed', reply: 'Erledigt.' },
  });
  assert.ok(stale.translations.en && stale.translations.es);
  const changed = await f.service.translateReceipt(fingerprint, 'en', translate);
  assert.equal(changed.reply, 'en: Erledigt.');
  assert.equal(changed.description, english.description);
  assert.equal(calls.length, 5);
  // Without AI a language not yet read cannot be translated.
  await assert.rejects(() => f.service.translateReceipt(fingerprint, 'fr'), { status: 409 });
  await assert.rejects(() => f.service.translateReceipt('e'.repeat(64), 'en', translate), {
    status: 404,
  });
  assert.equal(f.posts(), 1);
});

test('an older receipt linked by its public number is followed and takes its details from the public record', async () => {
  const f = await setup({
    byId: {
      90010: published({
        service_request_id: 90010,
        service_code: 'Graffiti',
        detail: 'Published text.',
      }),
      90011: published({ service_request_id: 90011, interface_used: 'iOS' }),
      90012: published({
        service_request_id: 90012,
        requested_datetime: new Date(START - 86400_000).toISOString(),
      }),
    },
  });
  const old = 'b'.repeat(64),
    created_at = new Date(START).toISOString();
  await f.store.saveReceipt({
    fingerprint: old,
    preview_id: 'old',
    created_at,
    state: 'confirmation_pending',
    message: 'm',
    email_confirmed_at: created_at,
  });
  // A report from another client, or published before this one was sent, cannot be it.
  for (const id of ['90011', '90012'])
    await assert.rejects(() => f.service.linkReport(old, id), { status: 409 });
  await assert.rejects(() => f.service.linkReport('e'.repeat(64), '90010'), { status: 404 });
  const linked = await f.service.linkReport(old, '90010');
  assert.equal(linked.report_id, '90010');
  assert.equal(linked.url, 'https://www.zueriwieneu.ch/report/90010');
  assert.equal((await f.service.linkReport(old, '90010')).report_id, '90010');
  // One number belongs to one sent report; a number still under review is accepted.
  await assert.rejects(() => f.service.linkReport(f.receipt.fingerprint, '90010'), { status: 409 });
  assert.equal((await f.service.linkReport(f.receipt.fingerprint, '90020')).report_id, '90020');
  // A lookup that started before the number was added must not lose it.
  const stale = await f.store.saveReceipt({
    fingerprint: old,
    preview_id: 'old',
    created_at,
    state: 'confirmation_pending',
    message: 'm',
    tracking: { checked_at: created_at },
  });
  assert.equal(stale.report_id, '90010');
  f.advance(11 * 60_000);
  const result = (await f.service.receipts(true)).receipts.find((r) => r.fingerprint === old);
  assert.equal(result.tracking.status, 'open');
  assert.deepEqual(result.summary, {
    municipality: { bfs_id: 261, name: 'Zürich', reporting_service: 'Züri wie neu' },
    category: 'Graffiti',
    location_label: '',
    ...point,
    text_sha256: textHash('Published text.'),
    description: 'Published text.',
    source: 'public',
  });
  assert.equal(f.posts(), 1);
});

test('an unconfirmed report is found by its exact text once the city publishes it', async () => {
  const reply = 'Grüezi\r\n\r\nDer Behälter wird heute geleert.\r\n';
  const f = await setup({
    list: [
      published({
        service_request_id: 90002,
        detail: 'Ein Abfallbehälter ist überfüllt.\r\nBitte leeren. ',
        status: 'closed',
        service_notice: reply,
      }),
      published({ service_request_id: 90003, detail: 'Something else nearby.' }),
    ],
  });
  const result = await f.service.receipts(true);
  const [report] = result.receipts;
  assert.equal(result.complete, true);
  assert.equal(report.report_id, '90002');
  assert.equal(report.url, 'https://www.zueriwieneu.ch/report/90002');
  assert.deepEqual(
    {
      status: report.tracking.status,
      matched_by: report.tracking.matched_by,
      reply: report.tracking.reply,
    },
    { status: 'closed', matched_by: 'text', reply: reply.trim() },
  );
  assert.equal((await f.store.receipts())[0].report_id, '90002');
  assert.equal(f.posts(), 1);
});

test('status is read at most every ten minutes and no longer once answered', async () => {
  const f = await setup();
  await f.service.receipts(true);
  await f.service.receipts(true);
  assert.equal(f.reads(), 1);
  f.advance(10 * 60_000);
  await f.service.receipts(true);
  assert.equal(f.reads(), 2);
  const closed = await setup({
    post: { success: 1, report: 77 },
    byId: { 77: { service_request_id: 77, status: 'closed', service_notice: 'Erledigt.' } },
  });
  assert.equal((await tracked(closed)).tracking.reply, 'Erledigt.');
  closed.advance(86400_000);
  await closed.service.receipts(true);
  assert.equal(closed.reads(), 1);
});

test('a numbered report not yet public stays sent, and a read failure changes nothing', async () => {
  const hidden = await tracked(await setup({ post: { success: 1, report: 55 } }));
  assert.equal(hidden.state, 'accepted');
  assert.equal(hidden.tracking.status, undefined);
  assert.ok(hidden.tracking.checked_at);
  const down = await setup({ failReads: true });
  const before = await down.store.receipts();
  assert.equal((await down.service.receipts(true)).complete, false);
  assert.deepEqual(await down.store.receipts(), before);
});

test('the place alone matches only one report sent through this client in the same category', async () => {
  const edited = published({ detail: 'Abfallbehälter überfüllt (Text von der Stadt gekürzt).' });
  assert.equal((await tracked(await setup({ list: [edited] }))).tracking.matched_by, 'place');
  for (const list of [
    [{ ...edited, interface_used: 'iOS' }],
    [{ ...edited, service_code: 'Graffiti' }],
    [edited, { ...edited, service_request_id: 90009 }],
    [{ ...edited, requested_datetime: new Date(START - 86400_000).toISOString() }],
    [{ ...edited, lat: '47.3712' }],
  ]) {
    assert.equal((await tracked(await setup({ list }))).report_id, undefined);
  }
});

test('rejected, recent in-progress and older summary-less receipts are never looked up', async () => {
  const f = await setup({ post: { errors: { email: 'required' } } });
  const [rejected] = await f.store.receipts();
  assert.equal(rejected.state, 'rejected');
  const created_at = new Date(START).toISOString();
  await f.store.saveReceipt({
    fingerprint: 'a'.repeat(64),
    preview_id: 'x',
    created_at,
    state: 'sending',
    message: 'm',
    summary: rejected.summary,
  });
  await f.store.saveReceipt({
    fingerprint: 'b'.repeat(64),
    preview_id: 'y',
    created_at,
    state: 'confirmation_pending',
    message: 'm',
  });
  const result = await f.service.receipts(true);
  assert.equal(result.complete, true);
  assert.equal(f.reads(), 0);
  assert.ok(result.receipts.every((r) => !r.tracking));
});

test('email acknowledgement is durable and idempotent without changing municipal evidence', async () => {
  const f = await setup();
  const saved = await f.store.confirmReceiptEmail(f.receipt.fingerprint);
  assert.equal(saved.email_confirmed_at, new Date(START).toISOString());
  assert.equal(saved.state, 'confirmation_pending');
  assert.equal(saved.report_id, undefined);
  f.advance(1000);
  assert.equal(
    (await f.store.confirmReceiptEmail(saved.fingerprint)).email_confirmed_at,
    saved.email_confirmed_at,
  );
  assert.equal(
    (await new Store(f.store.directory).receipts())[0].email_confirmed_at,
    saved.email_confirmed_at,
  );
  // A lookup that started before the click must not lose it when saving.
  const stale = await f.store.saveReceipt({
    ...f.receipt,
    tracking: { checked_at: new Date(START).toISOString() },
  });
  assert.equal(stale.email_confirmed_at, saved.email_confirmed_at);
  assert.equal(f.posts(), 1);
});

test('public evidence supersedes email acknowledgement, including when never acknowledged', async () => {
  for (const acknowledged of [false, true]) {
    const f = await setup({ list: [published({})] });
    if (acknowledged) await f.store.confirmReceiptEmail(f.receipt.fingerprint);
    const result = await tracked(f);
    assert.equal(result.tracking.status, 'open');
    assert.equal(result.report_id, '90001');
    assert.deepEqual(await f.store.confirmReceiptEmail(result.fingerprint), result);
    assert.equal(f.posts(), 1);
  }
});

test('old pending receipts can be acknowledged, but missing and rejected reports cannot', async () => {
  const f = await setup({ post: { errors: { email: 'required' } } });
  await assert.rejects(() => f.store.confirmReceiptEmail(f.receipt.fingerprint), { status: 409 });
  await assert.rejects(() => f.store.confirmReceiptEmail('e'.repeat(64)), { status: 404 });
  await f.store.saveReceipt({
    fingerprint: 'b'.repeat(64),
    preview_id: 'old',
    created_at: new Date(START).toISOString(),
    state: 'confirmation_pending',
    message: 'm',
  });
  const old = await f.store.confirmReceiptEmail('b'.repeat(64));
  assert.ok(old.email_confirmed_at);
  assert.equal(old.summary, undefined);
  // A report the city did not accept has no number to link.
  await assert.rejects(() => f.service.linkReport(f.receipt.fingerprint, '90030'), { status: 409 });
});
