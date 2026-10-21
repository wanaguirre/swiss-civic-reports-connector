import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintSwlLightingPage, inspectSwlLightingPage } from '../dist/swl-form.js';

const page = (state = 'A'.repeat(96), tail = '') =>
  `<form id="disturbance-form"><input type="hidden" name="_csrf" value="${state}"><input name="phone"><div class="h-captcha"></div></form>${tail}`;

test('SWL fingerprints discard only the shaped read-time value and retain all other bytes', () => {
  const original = page();
  const hash = fingerprintSwlLightingPage(original);
  assert.equal(hash, fingerprintSwlLightingPage(page('B'.repeat(96))));
  for (const changed of [
    original.replace('name="phone"', 'name="email"'),
    original.replace('h-captcha', 'other-protection'),
    original.replace('<form ', '<form action="https://example.invalid" '),
    page('A'.repeat(96), '<script src="changed.js"></script>'),
    original + ' ',
  ])
    assert.notEqual(fingerprintSwlLightingPage(changed), hash);
  // A merely plausible form cannot satisfy the fixed actual-source contract.
  assert.throws(() => inspectSwlLightingPage(original), /source has changed/);
});

test('SWL fingerprints reject malformed, duplicate, missing or oversized state sources', () => {
  for (const html of [
    page('A'.repeat(95)),
    page('!'.repeat(96)),
    page().replace('type="hidden"', 'type="text"'),
    page().replace('name="_csrf"', 'name="other"'),
    page() + '<input name="_csrf">',
    page() + "<input NAME='_csrf'>",
    page() + page(),
    page() + ' '.repeat(1_000_000),
  ])
    assert.throws(() => fingerprintSwlLightingPage(html), /source has changed/);
});
