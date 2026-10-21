import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const changed = () => new Error('The Wohlen AG ibw source has changed. Preparation is paused.');
const attr = (n: Element, name: string) => n.attrs.find((a) => a.name === name)?.value;
function elements(node: Node): Element[] {
  return [
    ...('tagName' in node ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap(elements) : []),
  ];
}
function one<T>(items: T[]): T {
  if (items.length !== 1) throw changed();
  return items[0];
}
/** Complete original UTF8 fingerprint. Only four precisely located shaped state
 * values differ; never calculate/compare a protection answer, execute code,
 * return native state, or reuse it in a payload. All other bytes remain pinned. */
export function ibwPageFingerprint(html: string): string {
  if (Buffer.byteLength(html, 'utf8') > 1_000_000) throw changed();
  const doc = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError() {
      throw changed();
    },
  });
  const all = elements(doc);
  const ids = all.map((n) => attr(n, 'id')).filter((x) => x !== undefined);
  if (new Set(ids).size !== ids.length) throw changed();
  const form = one(all.filter((n) => n.tagName === 'form' && attr(n, 'id') === 'MyFormLampe'));
  const nodes = elements(form);
  const edits: { start: number; end: number; replacement: string }[] = [];
  const input = one(
    nodes.filter(
      (n) => n.tagName === 'input' && /^Spamfilter[0-9]{3}$/.test(attr(n, 'name') ?? ''),
    ),
  );
  const field = attr(input, 'name')!;
  const loc = input.sourceCodeLocation?.attrs?.name;
  if (
    !loc ||
    attr(input, 'type') !== 'text' ||
    html.slice(loc.startOffset, loc.endOffset) !== `name="${field}"`
  )
    throw changed();
  edits.push({
    start: loc.startOffset + 6,
    end: loc.endOffset - 1,
    replacement: '[checked-field-name]',
  });
  const script = one(
    all.filter(
      (n) =>
        n.tagName === 'script' &&
        !attr(n, 'src') &&
        'childNodes' in n &&
        n.childNodes.some((c) => 'value' in c && c.value.includes("formID: '#MyFormLampe'")),
    ),
  );
  const text = one(script.childNodes.filter((n) => 'value' in n));
  if (!('value' in text) || !text.sourceCodeLocation) throw changed();
  const raw = html.slice(text.sourceCodeLocation.startOffset, text.sourceCodeLocation.endOffset);
  for (const [pattern, marker] of [
    [/skey: '([0-9]{4})'/g, '[checked-state]'],
    [/sfeldID: '(Spamfilter[0-9]{3})'/g, '[checked-field-name]'],
  ] as const) {
    const m = one([...raw.matchAll(pattern)]);
    if (marker === '[checked-field-name]' && m[1] !== field) throw changed();
    const start = text.sourceCodeLocation.startOffset + m.index! + m[0].indexOf("'") + 1;
    edits.push({ start, end: start + m[1].length, replacement: marker });
  }
  const label = one(
    nodes.filter((n) => n.tagName === 'label' && attr(n, 'class') === 'spamfilter'),
  );
  const strong = one(elements(label).filter((n) => n.tagName === 'strong'));
  const display = one(strong.childNodes.filter((n) => 'value' in n));
  if (!('value' in display) || !/^ [0-9]{4}$/.test(display.value) || !display.sourceCodeLocation)
    throw changed();
  const start = display.sourceCodeLocation.startOffset + 1;
  edits.push({ start, end: start + 4, replacement: '[checked-display]' });
  edits.sort((a, b) => b.start - a.start);
  let end = html.length;
  for (const e of edits) {
    if (e.end > end) throw changed();
    html = html.slice(0, e.start) + e.replacement + html.slice(e.end);
    end = e.start;
  }
  return createHash('sha256').update(html, 'utf8').digest('hex');
}
export const ibwFormUrl = 'https://www.ibw.ag/strassenlampe';
export const ibwPrivacyUrl = 'https://www.ibw.ag/datenschutz';
export const ibwIdentityUrl = 'https://www.ibw.ag/oeb';
export const ibwPageSha256 = '3a222337b34e37fef495fb336fbc40df2ef436ddccba3c999ab17ce02307b816';
export const ibwSources: readonly PublicSourcePin[] = Object.freeze(
  (
    [
      {
        url: 'https://www.ibw.ag/oeb',
        sha256: '7e1611731862ac8726fbc108dbd86edc09be048c3f7b3f43752e003a77ba3981',
        type: 'html',
        maxBytes: 1000000,
      },
      {
        url: 'https://www.ibw.ag/datenschutz',
        sha256: '14262e8367caa918ecfa25c60fde8da18455fe8b01a4744489c2e0d1d27e820c',
        type: 'html',
        maxBytes: 1000000,
      },
      {
        url: 'https://www.ibw.ag/cis-data/jquery/jquery-1.7.2.min.js',
        sha256: '47b68dce8cb6805ad5b3ea4d27af92a241f4e29a5c12a274c852e4346a0500b4',
        type: 'javascript',
        maxBytes: 500000,
      },
      {
        url: 'https://www.ibw.ag/cis-data/js/creanetlibrary.min.js',
        sha256: '5851ddeda15257d773da10916978c20140ddd333c2ebe1752d41c214ae8f4b0f',
        type: 'javascript',
        maxBytes: 500000,
      },
      {
        url: 'https://www.ibw.ag/cis-data/js/formcheck.min.js',
        sha256: 'f360a4f755d14d0ad5f990d1c740ddce40f22d4e09713b84e31e745ce6e1a1a8',
        type: 'javascript',
        maxBytes: 500000,
      },
    ] as const
  ).map((p) => Object.freeze(p)),
);
type Queue = { tail: Promise<void>; next: number; blockedUntil: number };
const queues = new WeakMap<typeof fetch, Queue>();
export function assertIbwSourcesAvailable(request: typeof fetch, now: () => number = Date.now) {
  if ((queues.get(request)?.blockedUntil ?? 0) > now()) throw changed();
}
export function paceIbwSourceReads(
  request: typeof fetch,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  let q = queues.get(request);
  if (!q) {
    q = { tail: Promise.resolve(), next: 0, blockedUntil: 0 };
    queues.set(request, q);
  }
  const queue = q;
  return (input, init) => {
    const task = queue.tail.then(async () => {
      assertIbwSourcesAvailable(request, now);
      const delay = Math.max(0, queue.next - now());
      if (delay) await sleep(delay);
      assertIbwSourcesAvailable(request, now);
      queue.next = now() + 2000;
      const response = await request(input, { ...init, signal: AbortSignal.timeout(20_000) });
      if (response.status === 403) queue.blockedUntil = Infinity;
      if (response.status === 429) {
        const h = response.headers.get('retry-after') ?? '';
        const delay = /^\d+$/.test(h) ? Number(h) * 1000 : Date.parse(h) - now();
        queue.blockedUntil = Math.max(
          queue.blockedUntil,
          now() + Math.max(300_000, Number.isFinite(delay) ? delay : 0),
        );
      }
      return response;
    });
    queue.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}
/** Read fixed official sources only. Bodies never determine further requests. */
export async function verifyIbwSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
): Promise<void> {
  const paced = paceIbwSourceReads(request, now, sleep);
  try {
    const r = await paced(ibwFormUrl, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Civic source verification (read-only; no client execution)',
      },
    });
    if (
      !r.ok ||
      r.redirected ||
      (r.url && r.url !== ibwFormUrl) ||
      !/^text\/html(?:;|$)/i.test(r.headers.get('content-type') ?? '') ||
      !r.body
    ) {
      const h = r.headers.get('retry-after') ?? '';
      const delay = /^\d+$/.test(h) ? Number(h) * 1000 : Date.parse(h) - now();
      if (Number.isFinite(delay) && delay > 0) retry(delay);
      await r.body?.cancel();
      throw changed();
    }
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const p = await reader.read();
        if (p.done) break;
        bytes += p.value.byteLength;
        if (bytes > 1_000_000) throw changed();
        chunks.push(p.value);
      }
      const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        Buffer.concat(chunks),
      );
      if (ibwPageFingerprint(html) !== ibwPageSha256) throw changed();
    } finally {
      await reader.cancel().catch(() => {});
    }
    await verifyPublicSourceManifest(paced, ibwSources, retry, now);
  } catch {
    const q = queues.get(request)!;
    q.blockedUntil = Math.max(q.blockedUntil, now() + 300_000);
    throw changed();
  }
}
