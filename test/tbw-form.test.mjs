import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectTbwForm,
  fingerprintTbwForm,
  tbwCategories,
  tbwRequirements,
  tbwCategory,
  verifyTbwSources,
  assertTbwSourcesAvailable,
} from '../dist/tbw-form.js';
const html = await readFile(new URL('./fixtures/tbw.html', import.meta.url), 'utf8');
test('TBW captured full form and all scripts recognize only preparation contract, without executing native state', () => {
  assert.deepEqual(inspectTbwForm(html), tbwCategories);
  assert.doesNotMatch(html, /TzozOToiVFlQT/);
  const rotated = html
    .replaceAll('OFFLINE-OPAQUE-NOT-USABLE', 'DIFFERENT-OPAQUE-OFFLINE')
    .replaceAll('UJvhQH40pCxybLWPEjMt', 'ABCDEFGHIJKLMNOPQRST');
  assert.deepEqual(fingerprintTbwForm(rotated), fingerprintTbwForm(html));
});
test('TBW contract fails closed on mandatory mobile drift, optional phone drift, script, upload, external controls and trap changes', () => {
  for (const changed of [
    html.replace('name="tx_form_formframework[kontakt-715][telephone-1]"', 'name="changed"'),
    html.replace(
      'id="kontakt-715-telephone-2"',
      'required="required" id="kontakt-715-telephone-2"',
    ),
    html.replace('id="kontakt-715-telephone-1"', 'id="kontakt-715-telephone-1" type="file"'),
    html.replace('tabindex="-1"', 'tabindex="0"'),
    html.replace('main.js?1785307871', 'other.js'),
    html + '<script>newCode()</script>',
    html + '<input form="kontakt-715">',
    html + 'captcha',
  ])
    assert.throws(() => inspectTbwForm(changed), /paused/);
});
test('TBW private mobile is mandatory; private phone and postbox optional; no photos; all contacts remain private', () => {
  const r = tbwRequirements()[tbwCategory];
  assert.equal(r.phone_required, false);
  assert.equal(r.email_required, true);
  assert.equal(r.max_photos, 0);
  for (const code of [
    'salutation',
    'first_name',
    'last_name',
    'reporter_street',
    'contact_postcode',
    'contact_locality',
    'contact_mobile_phone',
    'privacy_acknowledgement',
  ]) {
    const f = r.extra_fields.find((f) => f.code === code);
    assert.equal(f.required, true, code);
    assert.equal(f.contact, true, code);
  }
  assert.equal(r.extra_fields.find((f) => f.code === 'contact_postbox').required, false);
  assert.match(r.scope, /4946/);
  assert.match(r.scope, /00:15/);
});
test('TBW failed source permanently stops shared context and all later peers before new reads', async () => {
  for (const status of [403, 429, 302, 200]) {
    let calls = 0;
    const request = async () => {
      calls++;
      return new Response('changed', {
        status,
        headers: { 'content-type': status === 200 ? 'application/json' : 'text/html' },
      });
    };
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    assert.throws(() => assertTbwSourcesAvailable(request), /paused/);
    await assert.rejects(
      verifyTbwSources(request, () => {}),
      /paused/,
    );
    assert.equal(calls, 1);
  }
});
