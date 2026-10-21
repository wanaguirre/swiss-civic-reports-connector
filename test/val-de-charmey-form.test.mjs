import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectValDeCharmeyForm,
  valDeCharmeyCategory,
  valDeCharmeyFormUrl,
  valDeCharmeyRequirements,
} from '../dist/val-de-charmey-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/val-de-charmey.html', import.meta.url), 'utf8');
const point = { latitude: 46.618, longitude: 7.165 };
const input = {
  ...point,
  location_confirmed: true,
  location_label: 'Lieu fictif pour test local',
  category: valDeCharmeyCategory,
  description: 'Un défaut fictif pour un test local uniquement.',
  email: '',
  photo_ids: [],
  extra_fields: {
    report_title: 'Défaut fictif',
    public_space_confirmed: 'Espace public communal de Val-de-Charmey confirmé',
    public_publication_choice: 'Je souhaite préparer ce contenu pour publication publique',
  },
};
test('Val-de-Charmey pins anonymous publication, all selected fields, hidden status settings and upload/protection declarations', () => {
  assert.deepEqual(inspectValDeCharmeyForm(html), [
    { service_code: 'signalement-de-defauts', service_name: valDeCharmeyCategory },
  ]);
  assert.equal(
    inspectValDeCharmeyForm(html.replaceAll('[dynamic nonce]', 'rotated-opaque-nonce')).length,
    1,
  );
  for (const bad of [
    html + html,
    html.replace('method="post"', 'method="get"'),
    html.replace('Titre du défaut', 'Other title'),
    html.replace('data-max-files="1"', 'data-max-files="2"'),
    html.replace('data-max-upload-size="314572800"', 'data-max-upload-size="10"'),
    html.replace('required="1"', 'required="0"'),
    html.replace('name="_cspm_form_ID"', 'name="lost_honeypot"'),
    html.replace('</form>', '<input type="email" name="contact"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('"_cspm_only_logged_in_can": "false"', '"_cspm_only_logged_in_can": "true"'),
    html.replace('"_cspm_post_status": "publish"', '"_cspm_post_status": "pending"'),
    html.replace('"reCaptcha": "no"', '"reCaptcha": "yes"'),
    html.replace('"cspmsl_sbmt"', '"different_notice"'),
    html.replace('main.min.js?ver=2.1', 'main.min.js?ver=9'),
    html.replace('s:5:\\"etats\\"', 's:5:\\"other\\"'),
    'x'.repeat(1_000_001),
  ])
    assert.throws(() => inspectValDeCharmeyForm(bad), /changed/);
  assert.ok(!JSON.stringify(inspectValDeCharmeyForm(html)).includes('nonce'));
});
test('Val-de-Charmey checks BFS before access and never exposes experimental writes', async () => {
  let calls = 0;
  const city = new MunicipalFormClient(
    'val-de-charmey',
    async () => {
      calls++;
      throw Error('unexpected');
    },
    { places: { municipality: async () => ({ bfs_id: 2130 }) } },
  );
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls, 0);
  assert.throws(
    () => new MunicipalFormClient('val-de-charmey', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
});
test('Val-de-Charmey freezes local publication choice and optional normalized photo, rejects all contacts and cannot send', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-charmey-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const city = new MunicipalFormClient(
    'val-de-charmey',
    async (url, init) => {
      calls.push([url, init.method]);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: 2163 }) } },
  );
  const store = new Store(dir);
  await store.initialize();
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  assert.deepEqual(await city.requirements(point), valDeCharmeyRequirements());
  for (const field of Object.keys(input.extra_fields))
    await assert.rejects(
      service.prepare({ ...input, extra_fields: { ...input.extra_fields, [field]: '' } }),
      /requires|required/,
    );
  for (const field of ['email', 'name', 'phone'])
    await assert.rejects(
      service.prepare({
        ...input,
        [field]: field === 'email' ? 'fictional@example.invalid' : 'Fictional contact',
      }),
      /does not accept/,
    );
  await assert.rejects(
    service.prepare({
      ...input,
      extra_fields: { ...input.extra_fields, public_publication_choice: 'no' },
    }),
    /Invalid/,
  );
  await assert.rejects(service.prepare({ ...input, category: '81' }), /category/i);
  const noPhoto = await service.prepare(input);
  assert.equal(noPhoto.attachments.length, 0);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#456789' } })
    .jpeg()
    .toBuffer();
  const photo = await service.inspectPhoto({ base64: image.toString('base64') });
  const preview = await service.prepare({ ...input, photo_ids: [photo.metadata.id] });
  assert.equal(preview.attachments.length, 1);
  assert.equal(preview.municipality.bfs_id, 2163);
  assert.equal(preview.submission_enabled, false);
  assert.equal(preview.submission_mode, 'unverified');
  assert.equal(preview.report.email, '');
  const frozen = await store.preview(preview.preview_id);
  assert.deepEqual(frozen.destination, { bfs_id: 2163, service_id: 'val-de-charmey-defect-form' });
  assert.equal(
    frozen.input.extra_fields.public_publication_choice,
    input.extra_fields.public_publication_choice,
  );
  const old = input.extra_fields.report_title;
  input.extra_fields.report_title = 'Changed';
  assert.equal((await store.preview(preview.preview_id)).input.extra_fields.report_title, old);
  input.extra_fields.report_title = old;
  await assert.rejects(city.submit(frozen), /verification/);
  await assert.rejects(city.report('offline'), /unverified/);
  assert.deepEqual(calls, [[valDeCharmeyFormUrl, 'GET']]);
});
test('Val-de-Charmey fresh contract drift invalidates cache and a 429 respects cooldown without retry', async () => {
  let body = html,
    count = 0,
    now = 0,
    limited = false;
  const city = new MunicipalFormClient(
    'val-de-charmey',
    async () => {
      count++;
      return limited
        ? new Response('limited', {
            status: 429,
            headers: { 'retry-after': '600', 'content-type': 'text/html' },
          })
        : new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { now: () => now, places: { municipality: async () => ({ bfs_id: 2163 }) } },
  );
  await city.requirements(point);
  body = html.replace('Titre du défaut', 'Changed');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 2);
  now += 300001;
  limited = true;
  await assert.rejects(city.requirements(point), /changed/);
  now += 300001;
  await assert.rejects(city.requirements(point), /changed/);
  assert.equal(count, 3);
});
