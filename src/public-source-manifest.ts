import { createHash } from 'node:crypto';

export type PublicSourcePin = Readonly<{
  url: string;
  sha256: string;
  type: 'html' | 'javascript' | 'json';
  maxBytes: number;
}>;
const types = {
  html: /^text\/html(?:;|$)/i,
  javascript: /^(?:application|text)\/javascript(?:;|$)/i,
  json: /^application\/json(?:;|$)/i,
};
/** Read a caller-trusted, fixed manifest only. Never execute downloaded code,
 * follow redirects, send cookies or derive further requests from remote bodies. */
export async function verifyPublicSourceManifest(
  request: typeof fetch,
  pins: readonly PublicSourcePin[],
  retry: (delay: number) => void,
  now: () => number = Date.now,
): Promise<void> {
  if (!pins.length || pins.length > 10) throw new Error('Invalid public source manifest.');
  for (const pin of pins) {
    const url = new URL(pin.url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      !/^[a-f0-9]{64}$/.test(pin.sha256) ||
      !Number.isInteger(pin.maxBytes) ||
      pin.maxBytes < 1 ||
      pin.maxBytes > 3_000_000 ||
      !Object.hasOwn(types, pin.type)
    )
      throw new Error('Invalid public source manifest.');
    const response = await request(pin.url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept:
          pin.type === 'json'
            ? 'application/json'
            : pin.type === 'html'
              ? 'text/html'
              : 'text/javascript,application/javascript',
        'User-Agent': 'Civic source verification (read-only; no client execution)',
      },
    });
    const changed = () => new Error('The reporting source has changed. Preparation is paused.');
    if (
      !response.ok ||
      response.redirected ||
      (response.url && new URL(response.url).href !== url.href) ||
      !types[pin.type].test(response.headers.get('content-type') ?? '') ||
      !response.body
    ) {
      const value = response.headers.get('retry-after') ?? '';
      const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
      if (Number.isFinite(delay) && delay > 0) retry(delay);
      await response.body?.cancel();
      throw changed();
    }
    const reader = response.body.getReader();
    const hash = createHash('sha256');
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > pin.maxBytes) throw changed();
        hash.update(part.value);
      }
      if (hash.digest('hex') !== pin.sha256) throw changed();
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
}
