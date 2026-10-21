import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ibwPageFingerprint,
  ibwPageSha256,
  ibwSources,
  ibwFormUrl,
  paceIbwSourceReads,
  verifyIbwSources,
  assertIbwSourcesAvailable,
} from '../dist/ibw-source.js';
// Original inert structural fixture. Independent values deliberately differ:
// this parser never determines, checks or returns a protection answer.
function fixture(rotated = false) {
  return `<!doctype html><html><head><script src="/unchanged.js"></script><script>const ownFixture={formID: '#MyFormLampe', skey: '${rotated ? '1234' : '5678'}', sfeldID: 'Spamfilter${rotated ? '123' : '456'}', ajaxSubmit:true};</script></head><body><form id="MyFormLampe"><input name="street" required><input type="text" name="Spamfilter${rotated ? '123' : '456'}" maxlength="5"><label class="spamfilter"><strong><i>marker</i> ${rotated ? '9876' : '5432'}</strong> unchanged label</label><p>Unchanged mandate</p></form></body></html>`;
}
test('ibw fingerprints four exact shaped spans without response linkage; every other byte remains significant', () => {
  const s = fixture(),
    h = ibwPageFingerprint(s);
  assert.equal(h, ibwPageFingerprint(fixture(true)));
  assert.notEqual(h, ibwPageSha256);
  for (const edit of [
    (s) => s.replace(' required', ''),
    (s) => s.replace('/unchanged.js', '/new.js'),
    (s) => s.replace('ajaxSubmit:true', 'ajaxSubmit:false'),
    (s) => s.replace('Unchanged mandate', 'Changed mandate'),
    (s) => s.replace('</form>', '<input name="new" required></form>'),
    (s) => s + ' ',
    (s) => s.replace('</head>', '\r\n</head>'),
  ])
    assert.notEqual(ibwPageFingerprint(edit(s)), h);
  for (const edit of [
    (s) => s.replace("skey: '5678'", "skey: '567'"),
    (s) => s.replace(' 5432</strong>', ' 543</strong>'),
    (s) => s.replace("sfeldID: 'Spamfilter456'", "sfeldID: 'Spamfilter789'"),
    (s) => s.replace('name="Spamfilter456"', 'name="Spamfilter45"'),
    (s) => s.replace('name="Spamfilter456"', 'name="Spamfilter&#52;56"'),
    (s) => s.replace('id="MyFormLampe"', 'id="MyFormLampe" id="other"'),
    (s) => s.replace('</body>', '<div id="MyFormLampe"></div></body>'),
  ])
    assert.throws(() => ibwPageFingerprint(edit(s)), /changed/);
  assert.throws(() => ibwPageFingerprint('\uFEFF' + fixture()), /changed/);
  assert.throws(() => ibwPageFingerprint(' '.repeat(1000001)), /changed/);
});
test('ibw source queue shares two-second starts and dispatch timeout,403stop and429numeric/date cooldown', async () => {
  let now = 0;
  const calls = [],
    old = new AbortController();
  const request = async (u, i) => {
    calls.push(now);
    assert.equal(i.signal.aborted, false);
    return new Response('local');
  };
  const sleep = async (ms) => {
    old.abort();
    now += ms;
  };
  const a = paceIbwSourceReads(request, () => now, sleep),
    b = paceIbwSourceReads(request, () => now, sleep);
  await Promise.all([
    a(ibwFormUrl, { signal: old.signal }),
    b(ibwFormUrl, { signal: old.signal }),
    a(ibwFormUrl, { signal: old.signal }),
  ]);
  assert.deepEqual(calls, [0, 2000, 4000]);
  for (const [status, header] of [
    [403, '600'],
    [429, '600'],
    [429, 'Thu, 01 Jan 1970 00:10:00 GMT'],
  ]) {
    let now = 0,
      calls = 0,
      retry = 0;
    const request = async () => {
      calls++;
      return new Response('', { status, headers: { 'retry-after': header } });
    };
    await assert.rejects(
      verifyIbwSources(
        request,
        (ms) => (retry = ms),
        () => now,
      ),
      /paused/,
    );
    assert.equal(retry, 600000);
    now = 300001;
    await assert.rejects(
      verifyIbwSources(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 1);
    now = 600001;
    if (status === 403)
      assert.throws(() => assertIbwSourcesAvailable(request, () => now), /paused/);
    else assert.doesNotThrow(() => assertIbwSourcesAvailable(request, () => now));
  }
});
test('ibw fixed GET source manifest fails closed for HTML/MIME/redirect/UTF8/size drift and caches failures', async () => {
  assert.equal(ibwSources.length, 5);
  assert.ok(Object.isFrozen(ibwSources) && ibwSources.every(Object.isFrozen));
  for (const make of [
    () => new Response(fixture(), { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([0xc0, 0xaf]), { headers: { 'content-type': 'text/html' } }),
    () => new Response(' '.repeat(1000001), { headers: { 'content-type': 'text/html' } }),
    () => {
      const r = new Response('local', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
  ]) {
    let calls = 0,
      now = 0;
    const request = async (u, i) => {
      calls++;
      assert.equal(u, ibwFormUrl);
      assert.equal(i.method, 'GET');
      assert.equal(i.credentials, 'omit');
      assert.equal(i.redirect, 'error');
      assert.equal(i.body, undefined);
      return make();
    };
    await assert.rejects(
      verifyIbwSources(
        request,
        () => {},
        () => now,
      ),
      /changed/,
    );
    await assert.rejects(
      verifyIbwSources(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 1);
    now = 300001;
    await assert.rejects(
      verifyIbwSources(
        request,
        () => {},
        () => now,
      ),
      /changed/,
    );
    assert.equal(calls, 2);
  }
});
