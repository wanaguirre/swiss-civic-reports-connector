import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPinnedNoteVerifier } from '../dist/pinned-note-sources.js';
const digest = (b) => createHash('sha256').update(b).digest('hex');
const text = 'Independent offline HTML';
const pdf = Buffer.from([37, 80, 68, 70, 45, 49, 46, 55, 10, 255, 0, 254]);
const manifest = () => [
  { url: 'https://example.invalid/robots.txt', sha256: digest(text), plain: true },
  { url: 'https://example.invalid/notice.pdf', sha256: digest(pdf), plain: false, pdf: true },
];
test('Pinned PDF manifests are immutable, byte exact and keep text/PDF types distinct', () => {
  const pins = manifest(),
    v = createPinnedNoteVerifier(pins);
  pins[1].sha256 = '0'.repeat(64);
  v.inspect(pins[1].url, pdf);
  assert.throws(() => v.inspect(pins[1].url, pdf.toString()), /paused/);
  assert.throws(() => v.inspect(pins[0].url, Buffer.from(text)), /paused/);
  for (const change of [
    { plain: true, pdf: true },
    { pdf: false },
    { pdf: 'true' },
    { url: 'http://example.invalid/a' },
    { url: 'https://user@example.invalid/a' },
  ])
    assert.throws(() => createPinnedNoteVerifier([{ ...manifest()[1], ...change }]), /manifest/);
  const highBits = Buffer.from([0xa5, 0xd0, 0xc4, 0xc6, 0xad]);
  assert.throws(
    () =>
      createPinnedNoteVerifier([{ ...manifest()[1], sha256: digest(highBits) }]).inspect(
        manifest()[1].url,
        highBits,
      ),
    /paused/,
  );
  const bad = Buffer.from('not PDF even when digest matches');
  assert.throws(
    () =>
      createPinnedNoteVerifier([{ ...manifest()[1], sha256: digest(bad) }]).inspect(
        manifest()[1].url,
        bad,
      ),
    /paused/,
  );
});
test('Mixed text and binary PDF verification paces concurrent clients and never decodes PDF as UTF8', async () => {
  const v = createPinnedNoteVerifier(manifest());
  let now = 0;
  const calls = [];
  const request = async (url, options) => {
    calls.push([url, now, options]);
    return new Response(url.endsWith('.pdf') ? pdf : text, {
      headers: { 'content-type': url.endsWith('.pdf') ? 'application/pdf' : 'text/plain' },
    });
  };
  await Promise.all([
    v.verify(
      request,
      () => {},
      () => now,
      async (ms) => {
        now += ms;
      },
    ),
    v.verify(
      request,
      () => {},
      () => now,
      async (ms) => {
        now += ms;
      },
    ),
  ]);
  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map((x) => x[1]),
    [0, 10000, 20000, 30000],
  );
  for (const [url, , o] of calls) {
    assert.equal(o.method, 'GET');
    assert.equal(o.redirect, 'error');
    assert.equal(o.credentials, 'omit');
    assert.equal(o.headers.Accept, url.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
  }
});
test('PDF MIME, redirect, signature, size and byte drift failures permanently stop all peer reads', async () => {
  for (const fail of [
    () => new Response(pdf, { headers: { 'content-type': 'text/html' } }),
    () => new Response(pdf, { status: 302 }),
    () => new Response('not PDF', { headers: { 'content-type': 'application/pdf' } }),
    () =>
      new Response(Buffer.concat([pdf, Buffer.from([0])]), {
        headers: { 'content-type': 'application/pdf' },
      }),
    () => new Response(Buffer.alloc(1000001), { headers: { 'content-type': 'application/pdf' } }),
    () => new Response('slow', { status: 429, headers: { 'retry-after': '60' } }),
  ]) {
    const v = createPinnedNoteVerifier(manifest());
    let now = 0,
      calls = 0;
    const retries = [];
    const request = async (url) => {
      calls++;
      return url.endsWith('.pdf')
        ? fail()
        : new Response(text, { headers: { 'content-type': 'text/plain' } });
    };
    await assert.rejects(
      v.verify(
        request,
        (ms) => retries.push(ms),
        () => now,
        async (ms) => {
          now += ms;
        },
      ),
      /paused/,
    );
    assert.equal(calls, 2);
    assert.throws(() => v.assertAvailable(request), /paused/);
    await assert.rejects(
      v.verify(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 2);
    if (retries.length) assert.deepEqual(retries, [60000]);
  }
});
