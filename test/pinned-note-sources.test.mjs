import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPinnedNoteVerifier } from '../dist/pinned-note-sources.js';
const digest = (x) => createHash('sha256').update(x).digest('hex');
const text =
  'Own independently authored offline content. <script>throw new Error("never execute")</script>';
const robots = 'User-agent: *\nCrawl-delay: 10\n';
const pins = [
  { url: 'https://example.invalid/robots.txt', plain: true, sha256: digest(robots) },
  { url: 'https://example.invalid/referral', plain: false, sha256: digest(text) },
];
const resp = (body, plain = false) =>
  new Response(body, {
    headers: { 'content-type': plain ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8' },
  });
test('note verifier fixes a caller-trusted immutable manifest and validates every pin before any GET', async () => {
  for (const manifest of [
    [],
    Array(11).fill(pins[0]),
    [pins[0], pins[0]],
    [{ ...pins[0], url: 'http://example.invalid/' }],
    [{ ...pins[0], url: 'https://user:password@example.invalid/' }],
    [{ ...pins[0], url: 'https://example.invalid/#fragment' }],
    [{ ...pins[0], sha256: 'invalid' }],
    [{ ...pins[0], plain: 'true' }],
  ])
    assert.throws(() => createPinnedNoteVerifier(manifest));
  const mutable = pins.map((p) => ({ ...p }));
  const verifier = createPinnedNoteVerifier(mutable);
  mutable[0].url = 'https://other.invalid/';
  mutable[0].sha256 = digest('different');
  let clock = 0;
  const urls = [];
  await verifier.verify(
    async (u) => {
      urls.push(u);
      return resp(u.endsWith('robots.txt') ? robots : text, u.endsWith('robots.txt'));
    },
    () => assert.fail('retry'),
    () => clock,
    async (ms) => {
      clock += ms;
    },
  );
  assert.deepEqual(
    urls,
    pins.map((p) => p.url),
  );
  assert.equal(clock, 10000);
  for (const p of pins) {
    const body = p.plain ? robots : text;
    verifier.inspect(p.url, body);
    for (const drift of [body + '\n', '\ufeff' + body, 'x'.repeat(1000001)])
      assert.throws(() => verifier.inspect(p.url, drift), /paused/);
  }
  assert.throws(() => verifier.inspect('https://untrusted.invalid/', text), /paused/);
});
test('note verifier concurrent peers share ten-second starts, stream complete bytes and never execute clients', async () => {
  const verifier = createPinnedNoteVerifier(pins);
  let clock = 1000;
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init, start: clock });
    const b = new TextEncoder().encode(url.endsWith('robots.txt') ? robots : text);
    return resp(
      new ReadableStream({
        start(c) {
          c.enqueue(b.slice(0, 13));
          c.enqueue(b.slice(13));
          c.close();
        },
      }),
      url.endsWith('robots.txt'),
    );
  };
  await Promise.all([
    verifier.verify(
      request,
      () => {},
      () => clock,
      async (ms) => {
        clock += ms;
      },
    ),
    verifier.verify(
      request,
      () => {},
      () => clock,
      async (ms) => {
        clock += ms;
      },
    ),
  ]);
  assert.equal(calls.length, 4);
  calls.forEach((c, i) => {
    assert.equal(c.init.method, 'GET');
    assert.equal(c.init.credentials, 'omit');
    assert.equal(c.init.redirect, 'error');
    assert.equal(c.init.body, undefined);
    assert.equal(c.init.headers.Cookie, undefined);
    assert.equal(c.init.headers.Authorization, undefined);
    if (i) assert.ok(c.start - calls[i - 1].start >= 10000);
  });
});
test('note verifier permanently stops shared peers on first HTTP, MIME, URL, stream, UTF8, BOM, size or hash failure without retry', async () => {
  const cases = [
    () => new Response('blocked', { status: 403 }),
    () => new Response('limited', { status: 429, headers: { 'retry-after': '3600' } }),
    () =>
      new Response('redirect', { status: 302, headers: { location: 'https://other.invalid/' } }),
    () => new Response(null, { status: 204 }),
    () => new Response(robots, { headers: { 'content-type': 'application/json' } }),
    () => resp(robots + 'drift', true),
    () => resp('\ufeff' + robots, true),
    () => resp(new Uint8Array([0xc3, 0x28]), true),
    () => resp('x'.repeat(1000001), true),
    () => {
      throw new Error('offline timeout');
    },
    () => {
      const r = resp(robots, true);
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
    () => {
      const r = resp(robots, true);
      Object.defineProperty(r, 'url', { value: 'https://other.invalid/robots.txt' });
      return r;
    },
    () =>
      resp(
        new ReadableStream({
          pull(c) {
            c.error(new Error('offline stream failure'));
          },
        }),
        true,
      ),
  ];
  for (const fail of cases) {
    const v = createPinnedNoteVerifier(pins),
      calls = [],
      delays = [];
    const request = async (u) => {
      calls.push(u);
      return fail();
    };
    await assert.rejects(
      v.verify(request, (ms) => delays.push(ms)),
      /paused/,
    );
    assert.throws(() => v.assertAvailable(request), /paused/);
    await assert.rejects(
      v.verify(request, () => {}),
      /paused/,
    );
    assert.deepEqual(calls, [pins[0].url]);
    if (fail === cases[1]) assert.deepEqual(delays, [3600000]);
  }
  const bytes = new Uint8Array([0xc3, 0x28]);
  const v = createPinnedNoteVerifier([{ ...pins[0], sha256: digest(bytes) }]);
  await assert.rejects(
    v.verify(
      async () => resp(bytes, true),
      () => {},
    ),
    /paused/,
  );
});
test('note verifier later authority drift and sleep failure stop queued peers before later source reads', async () => {
  const v = createPinnedNoteVerifier(pins);
  let clock = 0;
  const calls = [];
  const request = async (u) => {
    calls.push(u);
    return resp(u.endsWith('robots.txt') ? robots : text + 'changed', u.endsWith('robots.txt'));
  };
  await assert.rejects(
    v.verify(
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
    v.verify(request, () => {}),
    /paused/,
  );
  assert.deepEqual(
    calls,
    pins.map((p) => p.url),
  );
  const x = createPinnedNoteVerifier(pins),
    seen = [];
  const r = async (u) => {
    seen.push(u);
    return resp(robots, true);
  };
  await assert.rejects(
    x.verify(
      r,
      () => {},
      () => 0,
      async () => {
        throw new Error('offline interrupted wait');
      },
    ),
  );
  assert.throws(() => x.assertAvailable(r), /paused/);
  await assert.rejects(
    x.verify(r, () => {}),
    /paused/,
  );
  assert.deepEqual(seen, [pins[0].url]);
});
