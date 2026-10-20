import { createHash } from 'node:crypto';
export type NoteSourcePin = Readonly<{ url: string; sha256: string; plain: boolean }>;
/** Fixed, caller-trusted manifests only. Copy pins once so later mutations cannot
 * change the contract. Each verifier shares pacing and permanent failure state
 * across clients using the same fetch context. Remote code is never executed. */
export function createPinnedNoteVerifier(manifest: readonly NoteSourcePin[]) {
  if (!manifest.length || manifest.length > 10) throw new Error('Invalid note source manifest.');
  const urls = new Set<string>();
  for (const pin of manifest) {
    const url = new URL(pin.url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.href !== pin.url ||
      !/^[a-f0-9]{64}$/.test(pin.sha256) ||
      typeof pin.plain !== 'boolean' ||
      urls.has(pin.url)
    )
      throw new Error('Invalid note source manifest.');
    urls.add(pin.url);
  }
  const pins = Object.freeze(manifest.map((pin) => Object.freeze({ ...pin })));
  const changed = () =>
    new Error('The pinned note sources have changed or are unavailable. Preparation is paused.');
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  function inspect(url: string, body: string): void {
    const pin = pins.find((p) => p.url === url);
    if (!pin || Buffer.byteLength(body) > 1_000_000 || hash(body) !== pin.sha256) throw changed();
  }
  type Context = { tail: Promise<void>; next: number; stopped: boolean };
  const contexts = new WeakMap<typeof fetch, Context>();
  function assertAvailable(request: typeof fetch) {
    if (contexts.get(request)?.stopped) throw changed();
  }
  async function verify(
    request: typeof fetch,
    retry: (ms: number) => void,
    now: () => number = Date.now,
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    let context = contexts.get(request);
    if (!context) {
      context = { tail: Promise.resolve(), next: 0, stopped: false };
      contexts.set(request, context);
    }
    const shared = context;
    try {
      for (const pin of pins) {
        const task = shared.tail.then(async () => {
          assertAvailable(request);
          const delay = Math.max(0, shared.next - now());
          if (delay) await sleep(delay);
          assertAvailable(request);
          shared.next = now() + 10_000;
          try {
            const response = await request(pin.url, {
              method: 'GET',
              credentials: 'omit',
              redirect: 'error',
              signal: AbortSignal.timeout(20_000),
              headers: {
                Accept: pin.plain ? 'text/plain' : 'text/html',
                'User-Agent': 'Civic source verification (read-only; no client execution)',
              },
            });
            if (
              !response.ok ||
              response.redirected ||
              (response.url && response.url !== pin.url) ||
              !(pin.plain ? /^text\/plain(?:;|$)/i : /^text\/html(?:;|$)/i).test(
                response.headers.get('content-type') ?? '',
              ) ||
              !response.body
            ) {
              const header = response.headers.get('retry-after') ?? '';
              const wait = /^\d+$/.test(header)
                ? Number(header) * 1000
                : Date.parse(header) - now();
              if (Number.isFinite(wait) && wait > 0) retry(wait);
              await response.body?.cancel();
              throw changed();
            }
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let size = 0;
            try {
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                size += part.value.byteLength;
                if (size > 1_000_000) throw changed();
                chunks.push(part.value);
              }
            } finally {
              await reader.cancel().catch(() => {});
            }
            const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
              Buffer.concat(chunks),
            );
            inspect(pin.url, html);
          } catch {
            shared.stopped = true;
            throw changed();
          }
        });
        shared.tail = task.then(
          () => undefined,
          () => undefined,
        );
        await task;
      }
    } catch {
      shared.stopped = true;
      throw changed();
    }
  }

  return Object.freeze({ inspect, assertAvailable, verify });
}
