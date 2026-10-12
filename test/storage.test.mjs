import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Store, fingerprint } from '../dist/store.js';
import { StorageCapacityError } from '../dist/storage-budget.js';
import { hash, TTL_MS } from '../dist/photos.js';
import { ReportService } from '../dist/service.js';

const run = promisify(execFile);
const input = {
  latitude: 47.37,
  longitude: 8.53,
  location_label: 'Fictional Zürich location',
  location_confirmed: true,
  category: 'Waste',
  description: 'Fictional test description.',
  email: 'test@example.org',
  photo_ids: [],
  extra_fields: {},
};
function photo(now, bytes = Buffer.alloc(500, 1)) {
  return {
    id: randomUUID(),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL_MS).toISOString(),
    jpeg: bytes.toString('base64'),
    sha256: hash(bytes),
    width: 20,
    height: 20,
  };
}
async function fixture(t, limits = {}) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'civic-storage-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let now = Date.now();
  return {
    directory,
    store: new Store(directory, () => now, limits),
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
  };
}

test('photos and repeated frozen previews share one private binary per identity', async (t) => {
  const f = await fixture(t),
    a = photo(f.now()),
    b = { ...a, id: randomUUID() };
  await f.store.savePhoto(a);
  await f.store.savePhoto(b);
  const first = await f.store.prepare({ ...input, photo_ids: [a.id] }, [a]);
  const second = await f.store.prepare(
    { ...input, photo_ids: [b.id], description: 'Another fictional preview.' },
    [b],
  );
  const names = await fs.readdir(f.directory);
  assert.equal(names.filter((n) => n.startsWith('media-')).length, 1);
  for (const name of names) {
    assert.equal((await fs.stat(join(f.directory, name))).mode & 0o777, 0o600);
    if (name.endsWith('.json'))
      assert.equal((await fs.readFile(join(f.directory, name), 'utf8')).includes('"jpeg"'), false);
  }
  assert.equal((await f.store.photo(a.id)).jpeg, a.jpeg);
  assert.equal((await f.store.preview(first.id)).photos[0].jpeg, a.jpeg);
  assert.equal(
    (await new Store(f.directory).confirmed(second.id, second.confirmation_token)).photos[0].jpeg,
    b.jpeg,
  );
  await assert.rejects(
    () => f.store.savePhoto({ ...photo(f.now(), Buffer.alloc(800)), id: a.id }),
    /already stored/,
  );
  assert.equal((await f.store.preview(first.id)).photos[0].sha256, a.sha256);
});

test('a later preview retains its media beyond photo expiry; final expiry preserves receipts', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  await f.store.savePhoto(p);
  f.advance(TTL_MS / 2);
  const preview = await f.store.prepare({ ...input, photo_ids: [p.id] }, [p]);
  const claim = await f.store.claim(preview);
  f.advance(TTL_MS / 2 + 1);
  await f.store.cleanup();
  await assert.rejects(() => f.store.photo(p.id), /not found|expired/);
  assert.equal((await f.store.preview(preview.id)).photos[0].jpeg, p.jpeg);
  f.advance(TTL_MS / 2);
  await f.store.cleanup();
  assert.deepEqual(await fs.readdir(f.directory), [`receipt-${preview.fingerprint}.json`]);
  assert.deepEqual(await f.store.receipts(), [claim.receipt]);
});

test('legacy inline photos, previews and duplicate claims remain readable without migration', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  const legacy = {
    id: randomUUID(),
    created_at: p.created_at,
    expires_at: p.expires_at,
    confirmation_token: randomUUID(),
    input: { ...input, photo_ids: [p.id] },
    photos: [p],
  };
  legacy.fingerprint = fingerprint(legacy.input, legacy.photos);
  await fs.writeFile(join(f.directory, `photo-${p.id}.json`), JSON.stringify(p), { mode: 0o600 });
  await fs.writeFile(join(f.directory, `preview-${legacy.id}.json`), JSON.stringify(legacy), {
    mode: 0o600,
  });
  assert.equal((await f.store.photo(p.id)).jpeg, p.jpeg);
  assert.deepEqual(await f.store.confirmed(legacy.id, legacy.confirmation_token), legacy);
  await f.store.claim(legacy);
  const fresh = await f.store.prepare(legacy.input, [await f.store.photo(p.id)]);
  assert.equal(fresh.fingerprint, legacy.fingerprint);
  assert.equal((await new Store(f.directory).claim(fresh)).owned, false);
  await f.store.cleanup();
  assert.equal((await f.store.preview(fresh.id)).photos[0].jpeg, p.jpeg);
});

test('missing or corrupted referenced media prevents municipal dispatch', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  await f.store.savePhoto(p);
  const prepared = await f.store.prepare({ ...input, photo_ids: [p.id] }, [p]);
  let posts = 0;
  const service = new ReportService(
    {
      requirements: async () => ({ Waste: { extra_fields: [] } }),
      submit: async () => {
        posts++;
      },
    },
    f.store,
    { submissionEnabled: true, allowPaths: false },
  );
  const path = join(f.directory, `media-${p.sha256}.jpg`);
  await fs.writeFile(path, 'damaged media');
  await assert.rejects(
    () => service.submit(prepared.id, prepared.confirmation_token, true),
    /integrity/,
  );
  await fs.unlink(path);
  await assert.rejects(
    () => service.submit(prepared.id, prepared.confirmation_token, true),
    /unavailable/,
  );
  assert.equal(posts, 0);
  assert.equal((await f.store.receipts()).length, 0);
});

test('failed metadata publication leaves only collectible media and never a successful preview', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  const rename = fs.rename;
  const hook = t.mock.method(fs, 'rename', async (from, to) => {
    if (to.includes('/preview-')) throw new Error('injected publication failure');
    return rename(from, to);
  });
  await assert.rejects(
    () => f.store.prepare({ ...input, photo_ids: [p.id] }, [p]),
    /publication failure/,
  );
  assert.deepEqual(await fs.readdir(f.directory), [`media-${p.sha256}.jpg`]);
  hook.mock.restore();
  await f.store.cleanup();
  assert.deepEqual(await fs.readdir(f.directory), []);
});

test('cleanup failure is observable and cannot delete media retained by a live preview', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  await f.store.savePhoto(p);
  f.advance(TTL_MS / 2);
  const preview = await f.store.prepare({ ...input, photo_ids: [p.id] }, [p]);
  f.advance(TTL_MS / 2 + 1);
  const unlink = fs.unlink;
  const hook = t.mock.method(fs, 'unlink', async (path) => {
    if (path.includes('/photo-')) throw new Error('injected cleanup failure');
    return unlink(path);
  });
  await assert.rejects(() => f.store.cleanup(), /cleanup failure/);
  assert.equal((await f.store.preview(preview.id)).photos[0].jpeg, p.jpeg);
  hook.mock.restore();
  await f.store.cleanup();
  assert.equal((await f.store.preview(preview.id)).photos[0].jpeg, p.jpeg);
});

test('identity byte and record limits reject before publication, then recover after expiry', async (t) => {
  const f = await fixture(t, { identityBytes: 1000, records: 1 });
  await assert.rejects(
    () => f.store.savePhoto(photo(f.now(), Buffer.alloc(1000))),
    StorageCapacityError,
  );
  assert.deepEqual(await fs.readdir(f.directory), []);
  const p = photo(f.now());
  await f.store.savePhoto(p);
  await assert.rejects(
    () => f.store.prepare({ ...input, photo_ids: [p.id] }, [p]),
    StorageCapacityError,
  );
  f.advance(TTL_MS + 1);
  await f.store.savePhoto(photo(f.now()));
  assert.equal((await fs.readdir(f.directory)).length, 2);
});

test('concurrent processes cannot over-admit the installation budget or share private media', async (t) => {
  const f = await fixture(t);
  const module = new URL('../dist/store.js', import.meta.url).href;
  const launch = async (identity) => {
    const p = photo(f.now(), Buffer.alloc(7000));
    const source = `import { Store } from ${JSON.stringify(module)};\nconst store=new Store(${JSON.stringify(join(f.directory, 'users', identity))},Date.now,${JSON.stringify({ rootDirectory: f.directory, identityBytes: 10000, totalBytes: 10000 })});\ntry {await store.savePhoto(${JSON.stringify(p)});console.log('admitted');}catch(e){if(e.status===507)console.log('full');else throw e;}`;
    return (await run(process.execPath, ['--input-type=module', '-e', source])).stdout.trim();
  };
  assert.deepEqual((await Promise.all([launch('a'.repeat(64)), launch('b'.repeat(64))])).sort(), [
    'admitted',
    'full',
  ]);
  const a = await fs.readdir(join(f.directory, 'users', 'a'.repeat(64)));
  const b = await fs.readdir(join(f.directory, 'users', 'b'.repeat(64)));
  assert.deepEqual([a.length, b.length].sort(), [0, 2]);
});

test('duplicate-prevention claims and final receipts can be persisted when temporary budget is full', async (t) => {
  const f = await fixture(t),
    preview = await f.store.prepare(input, []);
  const full = new Store(f.directory, Date.now, { identityBytes: 1, totalBytes: 1, records: 1 });
  await assert.rejects(() => full.savePhoto(photo(f.now())), StorageCapacityError);
  const claim = await full.claim(preview);
  assert.equal(claim.owned, true);
  await full.saveReceipt({ ...claim.receipt, state: 'unknown' });
  assert.equal((await new Store(f.directory).claim(preview)).owned, false);
  assert.equal((await full.receipts())[0].state, 'unknown');
});

test('low filesystem space or inodes reject admission before writing photos or previews', async (t) => {
  const f = await fixture(t);
  const hook = t.mock.method(fs, 'statfs', async () => ({ bavail: 0, bsize: 4096, ffree: 100000 }));
  await assert.rejects(() => f.store.savePhoto(photo(f.now())), /low on free space/);
  hook.mock.restore();
  t.mock.method(fs, 'statfs', async () => ({ bavail: 1000000, bsize: 4096, ffree: 0 }));
  await assert.rejects(() => f.store.savePhoto(photo(f.now())), /low on free space/);
  assert.deepEqual(await fs.readdir(f.directory), []);
});

test('an interrupted lock is never stolen or removed by another process', async (t) => {
  const f = await fixture(t);
  const path = join(f.directory, '.transient-storage.lock');
  await fs.writeFile(path, '', { flag: 'wx', mode: 0o600 });
  await assert.rejects(() => f.store.savePhoto(photo(f.now())), /busy or needs recovery/);
  assert.deepEqual(await fs.readdir(f.directory), ['.transient-storage.lock']);
});

test('cleanup rejects corrupt live records before collecting any possibly referenced media', async (t) => {
  const f = await fixture(t),
    p = photo(f.now());
  await f.store.savePhoto(p);
  const preview = await f.store.prepare({ ...input, photo_ids: [p.id] }, [p]);
  await fs.writeFile(
    join(f.directory, `preview-${preview.id}.json`),
    JSON.stringify({ expires_at: preview.expires_at, format: 'future-format' }),
  );
  await assert.rejects(() => f.store.cleanup(), /Unknown storage format/);
  assert.equal(hash(await fs.readFile(join(f.directory, `media-${p.sha256}.jpg`))), p.sha256);
});

test('storage health exposes abandoned locks without exposing filesystem details', async (t) => {
  const { storageHealthy } = await import('../dist/storage-budget.js');
  const f = await fixture(t),
    lock = join(f.directory, '.transient-storage.lock');
  assert.equal(await storageHealthy(f.directory), true);
  await fs.writeFile(lock, '');
  assert.equal(await storageHealthy(f.directory), true);
  await fs.utimes(lock, new Date(Date.now() - 30_000), new Date(Date.now() - 30_000));
  assert.equal(await storageHealthy(f.directory), false);
  await fs.unlink(lock);
  assert.equal(await storageHealthy(f.directory), true);
});

test('cleanup collects interrupted transient publications but preserves receipt evidence', async (t) => {
  const f = await fixture(t),
    suffix = randomUUID();
  const names = [
    `photo-${randomUUID()}.json.${suffix}.tmp`,
    `preview-${randomUUID()}.json.${suffix}.tmp`,
    `media-${'a'.repeat(64)}.jpg.${suffix}.tmp`,
  ];
  const receipt = `receipt-${'b'.repeat(64)}.json.${suffix}.tmp`;
  for (const name of [...names, receipt])
    await fs.writeFile(join(f.directory, name), 'private fictional bytes', { mode: 0o600 });
  await f.store.cleanup();
  assert.deepEqual(await fs.readdir(f.directory), [receipt]);
});
