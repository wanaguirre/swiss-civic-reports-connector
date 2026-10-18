import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  inspectReinachBlForm,
  reinachBlCategories,
  reinachBlRequirements,
} from '../dist/reinach-bl-form.js';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
const html = await readFile(new URL('fixtures/reinach-bl-form.html', import.meta.url), 'utf8');
test('Reinach pins all selected sections and protection, ignores only generated action/token and unrelated forms', () => {
  assert.deepEqual(
    inspectReinachBlForm(html).map((c) => c.service_name),
    reinachBlCategories,
  );
  assert.deepEqual(
    inspectReinachBlForm(
      html
        .replace('wForm-cached-0-nsid-offline', 'wForm-cached-123-nsid-abc123')
        .replace('offline-token', 'rotated-token') + '<form><div class="g-recaptcha"></div></form>',
    ),
    inspectReinachBlForm(html),
  );
  for (const body of [
    html + html,
    html.replace('Name*', 'Name'),
    html.replace('aria-required="true"', 'aria-required="false"'),
    html.replace("pregMatch('^$')", 'required'),
    html.replace('name="element_111804956"', 'name="other-location"'),
    html.replace('</form>', '<input type="file" name="photo"></form>'),
    html.replace('</form>', '<div class="g-recaptcha"></div></form>'),
    html.replace('/weblication/grid5/tmpHTTP/', 'https://example.invalid/'),
    html.replace('Abfallmeldung', 'Private Beschwerden'),
  ]) {
    assert.notEqual(body, html);
    assert.throws(() => inspectReinachBlForm(body), /changed/);
  }
});
test('Reinach requires genuine surname and exact BFS, excludes photos and cross-class fields, never sends', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'civic-reinach-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  let bfs = 2773,
    body = html;
  const calls = [];
  const city = new MunicipalFormClient(
    'reinach-bl',
    async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    },
    { places: { municipality: async () => ({ bfs_id: bfs }) } },
  );
  const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
  const point = { latitude: 47.493, longitude: 7.59 };
  assert.deepEqual(await city.requirements(point), reinachBlRequirements());
  const input = {
    ...point,
    location_confirmed: true,
    location_label: 'Fictional offline location',
    category: reinachBlCategories[0],
    description: 'Fictional lamp defect for an offline contract test only.',
    photo_ids: [],
    extra_fields: {
      last_name: 'OfflineSurname',
      first_name: 'OfflineFirst',
      lamp_number: 'REAL-USER-PROVIDED',
    },
    email: 'offline@example.invalid',
    phone: '0610000000',
  };
  await assert.rejects(service.prepare({ ...input, extra_fields: {} }), /last_name/);
  await assert.rejects(
    service.prepare({ ...input, name: 'Full name is not the separate surname field' }),
    /does not accept/,
  );
  await assert.rejects(
    service.prepare({ ...input, category: reinachBlCategories[1] }),
    /lamp_number/,
  );
  const photo = await service.inspectPhoto({
    base64: (
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abcdef' } })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  await assert.rejects(service.prepare({ ...input, photo_ids: [photo.metadata.id] }), /at most 0/);
  for (const category of reinachBlCategories) {
    const p = await service.prepare({
      ...input,
      category,
      email: '',
      phone: undefined,
      extra_fields: { last_name: 'OfflineSurname' },
    });
    assert.equal(p.municipality.bfs_id, 2773);
    assert.equal(p.submission_enabled, false);
    assert.equal(p.attachments.length, 0);
    assert.equal(p.submission_mode, 'unverified');
    const frozen = await store.preview(p.preview_id);
    assert.equal(frozen.destination.service_id, 'reinach-bl-defect-form');
    await assert.rejects(service.submit(p.preview_id, p.confirmation_token, true), /verification/);
  }
  bfs = 4197;
  const before = calls.length;
  await assert.rejects(city.requirements(point), /outside/);
  assert.equal(calls.length, before);
  bfs = 2773;
  body = html.replace('</form>', '<input type="file" name="photo"></form>');
  await assert.rejects(city.requirements(point, { fresh: true }), /changed/);
  await assert.rejects(city.submit({}), /verification/);
  await assert.rejects(city.report('test'), /unverified/);
  await assert.rejects(city.nearby(point), /unavailable/);
  assert.throws(
    () => new MunicipalFormClient('reinach-bl', fetch, { experimentalSubmission: true }),
    /only implemented/,
  );
  assert.equal((await store.receipts()).length, 0);
  assert.ok(calls.every((c) => c.method === 'GET' && c.redirect === 'error' && !c.body));
});
