import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ewwPageFingerprint,
  ewwPageSha256,
  ewwSources,
  ewwFormUrl,
  paceEwwSourceReads,
  verifyEwwSources,
  assertEwwSourcesAvailable,
} from '../dist/eww-source.js';

// Original small structural fixture, not copied provider HTML/code. These values
// are inert parser examples; no native protection response is calculated.
function fixture(rotated = false) {
  const ids = rotated
    ? ['a1000001', 'a1000002', 'a1000003', 'a1000004', 'a1000005', 'a1000006', 'a1000007']
    : ['b100001', 'b100002', 'b100003', 'b100004', 'b100005', 'b100006', 'b100007'];
  return (
    '<!doctype html><html><head><script src="/unchanged-client.js"></script></head><body>' +
    `<form id="formmanager_8" data-sky-sprotectvalue="${rotated ? 'BBBB1111' : 'AAAA0000'}">` +
    ['10', '20', '30', '40', '50']
      .map(
        (n) =>
          `<input type="hidden" name="mySProtectSysFld${n}" value="${['30', '50'].includes(n) ? '' : n === '40' ? (rotated ? 'BBB111' : 'AAA000') : rotated ? 'CCCC2222' : 'DDDD3333'}">`,
      )
      .join('') +
    ids
      .slice(0, 4)
      .map(
        (id, i) =>
          `<div id="formmanager_8_${id}" class="sky-form__text sky-form__columns--${id}"><p>Unchanged section ${i}</p></div>`,
      )
      .join('') +
    ['Herr', 'Frau']
      .map(
        (name, i) =>
          `<div class="sky-form__radio--${ids[i + 4]}"><input type="radio" id="${ids[i + 4]}" name="gender" value="${name}"><label for="${ids[i + 4]}" id="labelFor${ids[i + 4]}">${name}</label></div>`,
      )
      .join('') +
    `<input name="actual-lamp-street" required><div id="formmanager_8_${ids[6]}" class="sky-form__columns--${ids[6]}"><input type="submit" id="${ids[6]}" name="${ids[6]}" class="sky-form__input--${ids[6]}"></div></form></body></html>`
  );
}
test('Wettingen fingerprints only checked rotating spans; all content, controls and script inventory remain significant', () => {
  const original = fixture();
  const hash = ewwPageFingerprint(original);
  assert.equal(hash, ewwPageFingerprint(fixture(true)));
  assert.notEqual(hash, ewwPageSha256);
  for (const edit of [
    (s) => s.replace('required>', '>'),
    (s) => s.replace('Unchanged section 0', 'Changed requirement'),
    (s) => s.replace('/unchanged-client.js', '/different-client.js'),
    (s) => s.replace('</head>', '<script>changed config</script></head>'),
    (s) => s.replace('</form>', '<input name="new-required-control" required></form>'),
    (s) => s.replace('mySProtectSysFld30" value=""', 'mySProtectSysFld30" value="changed"'),
    (s) => s.replace('mySProtectSysFld50" value=""', 'mySProtectSysFld50" value="changed"'),
    (s) => s + ' ',
    (s) => s.replace(/><div/g, '>\r\n<div'),
  ])
    assert.notEqual(ewwPageFingerprint(edit(original)), hash);
});
test('Wettingen rejects broken paired IDs, duplicate attributes/IDs, changed state shapes, entity-masked state and missing text sections', () => {
  for (const edit of [
    (s) => s.replace('for="b100005"', 'for="b100006"'),
    (s) => s.replace('labelForb100005', 'labelForb100006'),
    (s) => s.replace('name="b100007"', 'name="b100006"'),
    (s) => s.replace('sky-form__columns--b100001', 'sky-form__columns--b100002'),
    (s) => s.replace('sky-form__radio--b100005', 'sky-form__radio--b100006'),
    (s) => s.replace('sky-form__input--b100007', 'sky-form__input--b100006'),
    (s) => s.replace('AAAA0000', 'short'),
    (s) => s.replace('AAAA0000', '&#65;AAA0000'),
    (s) => s.replace('value="AAA000"', 'value="AAA00"'),
    (s) => s.replace('id="formmanager_8"', 'id="formmanager_8" id="other"'),
    (s) => s.replace('</body>', '<div id="b100005"></div></body>'),
    (s) => s.replace('sky-form__text sky-form__columns--b100001', 'other-class'),
    (s) => s.replace('id="b100005"', 'id="toolong123"'),
  ])
    assert.throws(() => ewwPageFingerprint(edit(fixture())), /changed/);
  assert.throws(() => ewwPageFingerprint(' '.repeat(1_000_001)), /changed/);
});
test('Wettingen serializes source reads at two-second starts and gives dispatched I/O a fresh bounded timeout', async () => {
  let now = 0;
  const calls = [];
  const old = new AbortController();
  const request = async (url, init) => {
    calls.push(now);
    assert.equal(init.signal.aborted, false);
    return new Response('only local mock');
  };
  const sleep = async (ms) => {
    old.abort();
    now += ms;
  };
  const a = paceEwwSourceReads(request, () => now, sleep);
  const b = paceEwwSourceReads(request, () => now, sleep);
  await Promise.all([
    a(ewwFormUrl, { signal: old.signal }),
    b(ewwFormUrl, { signal: old.signal }),
    a(ewwFormUrl, { signal: old.signal }),
  ]);
  assert.deepEqual(calls, [0, 2000, 4000]);
});
test('Wettingen403 stops that transport; numeric/date429 Retry-After blocks all instances without retry', async () => {
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
      verifyEwwSources(
        request,
        (ms) => {
          retry = ms;
        },
        () => now,
      ),
      /paused/,
    );
    assert.equal(retry, 600000);
    now = 300001;
    await assert.rejects(
      verifyEwwSources(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 1);
    now = 600001;
    if (status === 403)
      assert.throws(() => assertEwwSourcesAvailable(request, () => now), /paused/);
    else assert.doesNotThrow(() => assertEwwSourcesAvailable(request, () => now));
  }
});
test('Wettingen source checks use only the fixed GET manifest, fail closed for changed HTML/MIME/redirect/invalidUTF8/oversize, and share cooldown', async () => {
  assert.equal(ewwSources.length, 8);
  assert.ok(Object.isFrozen(ewwSources) && ewwSources.every(Object.isFrozen));
  for (const make of [
    () => new Response(fixture(), { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([0xc0, 0xaf]), { headers: { 'content-type': 'text/html' } }),
    () => new Response(' '.repeat(1_000_001), { headers: { 'content-type': 'text/html' } }),
    () => {
      const r = new Response('local', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      return r;
    },
    () => {
      const r = new Response('local', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'url', { value: 'https://example.invalid/elsewhere' });
      return r;
    },
  ]) {
    let calls = 0,
      now = 0;
    const request = async (url, init) => {
      calls++;
      assert.equal(url, ewwFormUrl);
      assert.equal(init.method, 'GET');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      assert.equal(init.body, undefined);
      return make();
    };
    await assert.rejects(
      verifyEwwSources(
        request,
        () => {},
        () => now,
      ),
      /changed/,
    );
    await assert.rejects(
      verifyEwwSources(
        request,
        () => {},
        () => now,
      ),
      /paused/,
    );
    assert.equal(calls, 1);
    now = 300001;
    await assert.rejects(
      verifyEwwSources(
        request,
        () => {},
        () => now,
      ),
      /changed/,
    );
    assert.equal(calls, 2);
  }
});
