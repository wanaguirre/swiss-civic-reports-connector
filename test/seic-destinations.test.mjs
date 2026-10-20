import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MunicipalFormClient } from '../dist/municipal-forms.js';
import {
  begninsRequirements,
  duillierRequirements,
  pranginsRequirements,
} from '../dist/seic-lighting-form.js';
import { ReportService } from '../dist/service.js';
import { Store } from '../dist/store.js';
test('SEIC profiles bind independent municipalities, confirmation strings, source contexts and frozen preview destinations', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'seic-independent-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.initialize();
  const rows = [
    ['begnins', 'Begnins', 5704, begninsRequirements],
    ['duillier', 'Duillier', 5715, duillierRequirements],
    ['prangins', 'Prangins', 5725, pranginsRequirements],
  ];
  const previews = [];
  for (const [key, name, bfs, requirements] of rows) {
    let reads = 0;
    const city = new MunicipalFormClient(
      'seic-' + key + '-lighting-note',
      async () => {
        reads++;
        assert.fail('cross-destination network');
      },
      { places: { municipality: async () => ({ bfs_id: rows.find((r) => r[2] !== bfs)[2] }) } },
    );
    await assert.rejects(
      city.requirements({ latitude: 46.4, longitude: 6.2 }),
      /municipality|boundary|point/i,
    );
    assert.equal(reads, 0);
    city.requirements = async () => requirements();
    const service = new ReportService(city, store, { submissionEnabled: true, allowPaths: false });
    const input = {
      latitude: 46.4,
      longitude: 6.2,
      location_confirmed: true,
      location_label: 'Offline actual communal streetlight',
      category: 'Éclairage public communal',
      description: 'Le luminaire fictif ne fonctionne plus, sans danger immédiat.',
      email: '',
      photo_ids: [],
      extra_fields: {
        public_asset_confirmed:
          'Nonurgent fault of actual ' + name + ' communal public streetlight confirmed',
        street_name: 'Rue fictive',
        fault_kind: 'Ne fonctionne pas',
      },
    };
    for (const peer of rows.filter((r) => r[2] !== bfs))
      await assert.rejects(
        service.prepare({
          ...input,
          extra_fields: {
            ...input.extra_fields,
            public_asset_confirmed:
              'Nonurgent fault of actual ' + peer[1] + ' communal public streetlight confirmed',
          },
        }),
      );
    const p = await service.prepare(input);
    assert.equal(p.municipality.bfs_id, bfs);
    const saved = await store.preview(p.preview_id);
    assert.equal(saved.destination.bfs_id, bfs);
    assert.equal(saved.destination.service_id, 'seic-' + key + '-lighting-note-defect-form');
    assert.equal(p.submission_enabled, false);
    previews.push([service, p]);
  }
  for (const [service, p] of previews)
    for (const [, peer] of previews)
      if (peer !== p)
        await assert.rejects(
          service.submit(peer.preview_id, peer.confirmation_token, true),
          /destination|municipality|verification|disabled|unverified/i,
        );
});
