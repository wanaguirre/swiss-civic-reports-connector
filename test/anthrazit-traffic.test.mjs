import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthrazitTraffic, MunicipalServiceUnavailable } from '../dist/anthrazit.js';
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function clock() {
  let now = Date.UTC(2026, 9, 15),
    timers = [];
  const traffic = new AnthrazitTraffic({
    now: () => now,
    wait: (ms) => new Promise((resolve) => timers.push({ at: now + ms, resolve })),
  });
  return {
    traffic,
    now: () => now,
    advance: async (ms) => {
      now += ms;
      const due = timers.filter((t) => t.at <= now);
      timers = timers.filter((t) => t.at > now);
      due.forEach((t) => t.resolve());
      await flush();
    },
  };
}
test('all tenants share concurrency and a sustained rate budget; idle requests start immediately', async () => {
  const { traffic, advance } = clock();
  let active = 0,
    maximum = 0,
    starts = 0;
  const finishes = [];
  const jobs = Array.from({ length: 10 }, (_, i) =>
    traffic.run(`https://city${i}.example`, async () => {
      starts++;
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => finishes.push(resolve));
      active--;
    }),
  );
  await flush();
  assert.equal(starts, 2);
  for (let i = 0; i < 4; i++) {
    finishes.splice(0).forEach((f) => f());
    await flush();
  }
  assert.equal(starts, 8);
  assert.equal(maximum, 2);
  await advance(499);
  assert.equal(starts, 8);
  await advance(1);
  assert.equal(starts, 9);
  finishes.splice(0).forEach((f) => f());
  await flush();
  await advance(500);
  assert.equal(starts, 10);
  finishes.splice(0).forEach((f) => f());
  await Promise.all(jobs);
});
test('queued work is bounded, times out, and is never dispatched after expiry', async () => {
  const { traffic, advance } = clock();
  const finishes = [];
  let started = 0;
  const operation = () => {
    started++;
    return new Promise((resolve) => finishes.push(resolve));
  };
  const active = [traffic.run('a', operation), traffic.run('b', operation)];
  await flush();
  const queued = Array.from({ length: 32 }, () => traffic.run('a', operation).catch((e) => e));
  await assert.rejects(() => traffic.run('b', operation), MunicipalServiceUnavailable);
  await advance(5000);
  assert.ok((await Promise.all(queued)).every((e) => e instanceof MunicipalServiceUnavailable));
  finishes.forEach((f) => f());
  await Promise.all(active);
  assert.equal(started, 2);
  assert.equal(await traffic.run('a', async () => 'recovered'), 'recovered');
});
test('cooldown stops queued/new requests for the affected origin without blocking other cities', async () => {
  const { traffic } = clock();
  const finishes = [];
  const running = [
    traffic.run('a', () => new Promise((r) => finishes.push(r))),
    traffic.run('b', () => new Promise((r) => finishes.push(r))),
  ];
  await flush();
  let starts = 0;
  const queued = traffic.run('a', async () => starts++).catch((e) => e);
  const error = traffic.pause('a', '120');
  assert.equal(error.retryAfterSeconds, 120);
  assert.ok((await queued) instanceof MunicipalServiceUnavailable);
  await assert.rejects(() => traffic.run('a', async () => starts++), MunicipalServiceUnavailable);
  finishes.forEach((f) => f());
  await Promise.all(running);
  await traffic.run('b', async () => starts++);
  assert.equal(starts, 1);
});
test('Retry-After dates/seconds and fallback backoff pause without automatic retry', async () => {
  const c = clock(),
    { traffic } = c;
  assert.equal(traffic.pause('seconds', '120').retryAfterSeconds, 120);
  assert.equal(
    traffic.pause('date', new Date(c.now() + 600_000).toUTCString()).retryAfterSeconds,
    600,
  );
  assert.equal(traffic.pause('invalid', 'not a date').retryAfterSeconds, 300);
  assert.equal(traffic.pause('unavailable', null, 503).retryAfterSeconds, 60);
  await c.advance(300_000);
  assert.equal(traffic.pause('invalid', null).retryAfterSeconds, 600);
  let starts = 0;
  await c.advance(600_000);
  assert.equal(starts, 0);
  await traffic.run('invalid', async () => starts++);
  assert.equal(starts, 1);
});
test('public cache coalesces reads, copies results, expires, bounds entries and never caches failure', async () => {
  const { traffic, advance } = clock();
  let loads = 0,
    release;
  const load = async () => {
    loads++;
    await new Promise((r) => (release = r));
    return { values: ['a'] };
  };
  const a = traffic.read('a', 30_000, load),
    b = traffic.read('a', 30_000, load);
  await flush();
  assert.equal(loads, 1);
  release();
  const result = await a;
  result.values.push('private edit');
  assert.deepEqual(await b, { values: ['a'] });
  assert.deepEqual(await traffic.read('a', 30_000, load), { values: ['a'] });
  await advance(30_000);
  assert.equal(await traffic.read('a', 30_000, async () => ++loads), 2);
  let failures = 0;
  for (let i = 0; i < 2; i++)
    await assert.rejects(() =>
      traffic.read('bad', 30_000, async () => {
        failures++;
        throw new Error('bad');
      }),
    );
  assert.equal(failures, 2);
  for (let i = 0; i < 513; i++) await traffic.read(`bounded${i}`, 30_000, async () => i);
  assert.equal(await traffic.read('a', 30_000, async () => ++loads), 3);
});
test('a failed operation releases its slot; a cooldown never replays a write', async () => {
  const { traffic, advance } = clock();
  let writes = 0;
  await assert.rejects(() =>
    traffic.run('a', async () => {
      writes++;
      throw traffic.pause('a', '1');
    }),
  );
  await advance(1000);
  assert.equal(writes, 1);
  assert.equal(await traffic.run('b', async () => 'ok'), 'ok');
});
