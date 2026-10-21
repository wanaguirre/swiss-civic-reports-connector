import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectWazForm, wazCategories } from '../dist/waz-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
const html = await readFile(new URL('fixtures/waz-form.html', import.meta.url), 'utf8');
test('WaZ checks the observed selected form and its misleading labels and conditional company field', () => {
  assert.deepEqual(
    inspectWazForm('<form><div class="g-recaptcha"></div></form>' + html),
    wazCategories.map((name) => ({ service_code: name, service_name: name })),
  );
  for (const [description, bad] of [
    ['duplicate', html + html],
    ['method', html.replace('method="post"', 'method="get"')],
    [
      'destination',
      html.replace('method="post"', 'method="post" action="https://elsewhere.invalid"'),
    ],
    ['identity', html.replace('&quot;formId&quot;:565', '&quot;formId&quot;:999')],
    ['company label', html.replace('>Firma&nbsp;', '>Vorname&nbsp;')],
    [
      'conditional company',
      html.replace('&quot;value&quot;:&quot;Firma&quot;', '&quot;value&quot;:&quot;Herr&quot;'),
    ],
    [
      'conditional description',
      html.replace(
        '&quot;value&quot;:&quot;Anderer Defekt&quot;',
        '&quot;value&quot;:&quot;Other&quot;',
      ),
    ],
    [
      'phone required',
      html.replace(
        'name="fields[telefon]" placeholder="+41 43 000 00 00" required=""',
        'name="fields[telefon]" placeholder="+41 43 000 00 00"',
      ),
    ],
    ['new required', html.replace('</form>', '<input name="new" required></form>')],
    ['active captcha', html.replace('</form>', '<div class="g-recaptcha"></div></form>')],
    ['registered captcha', html.replace('FormieConditions', 'FormieCaptcha')],
    ['category', html.replace('value="Lampe brennt nicht"', 'value="Other"')],
    ['file', html.replace(/type="text"([^>]*name="fields\[telefon\]")/, 'type="file"$1')],
    ['readonly', html.replace('name="fields[name]"', 'name="fields[name]" readonly')],
    ['length', html.replace('name="fields[name]"', 'name="fields[name]" maxlength="2"')],
  ]) {
    assert.notEqual(bad, html, description);
    assert.throws(() => inspectWazForm(bad), /changed/, description);
  }
});
for (const [name, bfs, other] of [
  ['erlenbach', 151, 161],
  ['zollikon', 161, 151],
]) {
  test(`${name}: separate geographic identity, required contact and text-only preparation; no write or tracking`, async () => {
    const calls = [];
    let actual = other,
      body = html;
    const city = new MunicipalFormClient(
      name,
      async (url, init) => {
        calls.push({ url, ...init });
        return new Response(body, { headers: { 'content-type': 'text/html' } });
      },
      { places: { municipality: async () => ({ bfs_id: actual }) } },
    );
    const point = { latitude: 47.3, longitude: 8.59 };
    await assert.rejects(city.requirements(point), /outside/);
    assert.equal(calls.length, 0);
    actual = bfs;
    const rules = await city.requirements(point);
    assert.equal(city.bfsId, bfs);
    assert.equal(city.serviceId, `${name}-defect-form`);
    assert.equal(city.submissionMode, 'unverified');
    assert.equal(city.trackingSupported, false);
    for (const rule of Object.values(rules)) {
      assert.equal(rule.max_photos, 0);
      assert.equal(rule.email_required, true);
      assert.equal(rule.phone_required, true);
      assert.equal(rule.extra_fields.find((f) => f.code === 'first_name').required, true);
      assert.equal(rule.extra_fields.find((f) => f.code === 'reporter_postcode').contact, true);
      assert.equal(rule.extra_fields.find((f) => f.code === 'lighting_postcode').contact, false);
      assert.equal(rule.extra_fields.find((f) => f.code === 'lighting_locality').required, true);
      assert.ok(!rule.extra_fields.some((f) => f.code === 'company' || f.code === 'salutation'));
    }
    assert.throws(
      () => new MunicipalFormClient(name, fetch, { experimentalSubmission: true }),
      /only implemented/,
    );
    await assert.rejects(city.submit({}), /verification/);
    await assert.rejects(city.report(), /unverified/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    body = html.replace('value="Lampe brennt nicht"', 'value="changed"');
    await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
    await assert.rejects(city.categories(), /changed/);
    assert.equal(calls.length, 2);
  });
}
