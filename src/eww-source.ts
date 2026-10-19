import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const changed = () => new Error('The Wettingen source has changed. Preparation is paused.');
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
/** Fingerprint the complete original UTF-8 page, replacing only checked attribute
 * value spans. No HTML serialization, whitespace stripping, native state return,
 * protection calculation, client execution or endpoint discovery occurs here. */
export function ewwPageFingerprint(html: string): string {
  if (Buffer.byteLength(html, 'utf8') > 1_000_000) throw changed();
  const doc = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError(error) {
      // The captured page has one unrelated self-closing non-void tag. Its bytes
      // remain fingerprinted; malformed or duplicated attributes are rejected.
      if (error.code !== 'non-void-html-element-start-tag-with-trailing-solidus') throw changed();
    },
  });
  const all = elements(doc);
  const ids = all.map((n) => attr(n, 'id')).filter((x) => x !== undefined);
  if (new Set(ids).size !== ids.length) throw changed();
  const form = one(all.filter((n) => n.tagName === 'form' && attr(n, 'id') === 'formmanager_8'));
  const nodes = elements(form);
  const edits: { start: number; end: number; replacement: string }[] = [];
  function replace(n: Element, name: string, replacement: string) {
    const location = n.sourceCodeLocation?.attrs?.[name];
    const value = attr(n, name);
    if (
      !location ||
      value === undefined ||
      html.slice(location.startOffset, location.endOffset) !== `${name}="${value}"`
    )
      throw changed();
    const start = location.startOffset + name.length + 2;
    edits.push({ start, end: start + value.length, replacement });
  }
  function state(n: Element, name: string, shape: RegExp) {
    if (!shape.test(attr(n, name) ?? '')) throw changed();
    replace(n, name, '[checked-state]');
  }
  state(form, 'data-sky-sprotectvalue', /^[A-Z0-9]{8}$/);
  for (const [name, shape] of [
    ['mySProtectSysFld10', /^[A-Z0-9]{8}$/],
    ['mySProtectSysFld20', /^[A-Z0-9]{8}$/],
    ['mySProtectSysFld40', /^[!#-~]{6}$/],
  ] as const) {
    const n = one(nodes.filter((n) => n.tagName === 'input' && attr(n, 'name') === name));
    if (attr(n, 'type') !== 'hidden') throw changed();
    state(n, 'value', shape);
  }
  // Empty Fld30/Fld50 and all other fields remain unmodified in the full hash.
  const rotatingIds = new Set<string>();
  function id(value: string | undefined): string {
    if (!value || !/^[a-f0-9]{7,8}$/.test(value) || rotatingIds.has(value)) throw changed();
    rotatingIds.add(value);
    return value;
  }
  function classToken(n: Element, prefix: string, value: string, marker: string) {
    const c = attr(n, 'class') ?? '';
    const token = `${prefix}${value}`;
    if (c.split(/\s+/).filter((x) => x === token).length !== 1 || c.split(token).length !== 2)
      throw changed();
    replace(n, 'class', c.replace(token, `${prefix}${marker}`));
  }
  const texts = nodes.filter(
    (n) => n.tagName === 'div' && (attr(n, 'class') ?? '').split(/\s+/).includes('sky-form__text'),
  );
  if (texts.length !== 4) throw changed();
  texts.forEach((n, index) => {
    const value = id(attr(n, 'id')?.replace(/^formmanager_8_/, ''));
    if (attr(n, 'id') !== `formmanager_8_${value}`) throw changed();
    const marker = `[text-${index}]`;
    replace(n, 'id', `formmanager_8_${marker}`);
    classToken(n, 'sky-form__columns--', value, marker);
  });
  for (const salutation of ['Herr', 'Frau']) {
    const radio = one(
      nodes.filter(
        (n) =>
          n.tagName === 'input' && attr(n, 'name') === 'gender' && attr(n, 'value') === salutation,
      ),
    );
    if (attr(radio, 'type') !== 'radio') throw changed();
    const value = id(attr(radio, 'id'));
    const parent = radio.parentNode;
    if (!parent || !('tagName' in parent) || parent.tagName !== 'div') throw changed();
    const label = one(
      elements(parent).filter((n) => n.tagName === 'label' && attr(n, 'for') === value),
    );
    if (attr(label, 'id') !== `labelFor${value}`) throw changed();
    const marker = `[gender-${salutation}]`;
    replace(radio, 'id', marker);
    replace(label, 'for', marker);
    replace(label, 'id', `labelFor${marker}`);
    classToken(parent, 'sky-form__radio--', value, marker);
  }
  const submit = one(nodes.filter((n) => n.tagName === 'input' && attr(n, 'type') === 'submit'));
  const value = id(attr(submit, 'id'));
  if (attr(submit, 'name') !== value) throw changed();
  const wrapper = one(
    nodes.filter(
      (n) =>
        n.tagName === 'div' &&
        attr(n, 'id') === `formmanager_8_${value}` &&
        elements(n).includes(submit),
    ),
  );
  replace(submit, 'id', '[submit]');
  replace(submit, 'name', '[submit]');
  classToken(submit, 'sky-form__input--', value, '[submit]');
  replace(wrapper, 'id', 'formmanager_8_[submit]');
  classToken(wrapper, 'sky-form__columns--', value, '[submit]');
  edits.sort((a, b) => b.start - a.start);
  let end = html.length;
  for (const e of edits) {
    if (e.end > end) throw changed();
    html = html.slice(0, e.start) + e.replacement + html.slice(e.end);
    end = e.start;
  }
  return createHash('sha256').update(html, 'utf8').digest('hex');
}

export const ewwFormUrl = 'https://www.energiewettingen.ch/de/kundencenter/stoerungsdienst.html';
export const ewwPrivacyUrl = 'https://www.energiewettingen.ch/de/datenschutz.html';
export const ewwIdentityUrl = 'https://www.energiewettingen.ch/de/uns.html';
export const ewwPageSha256 = '3751f4887f5d3fa5f5b8c611b79ca6cf26c294f8c81c867d8662c0126a8a394b';
export const ewwSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://www.energiewettingen.ch/de/uns.html',
      sha256: '8082c4c20620d239f69568fe1120559ff605c12b560166146c19c4a3a3e0782b',
      type: 'html' as const,
      maxBytes: 1000000,
    },
    {
      url: 'https://www.energiewettingen.ch/de/datenschutz.html',
      sha256: '16d15b0e4a10c883c1c0d77e4f3506d4097e18ba9287b7d27839d77148bd7b22',
      type: 'html' as const,
      maxBytes: 1000000,
    },
    {
      url: 'https://www.energiewettingen.ch/standard/compressed/12b3f97c48d93259b6ba514ba31b5ba3.js',
      sha256: '5256bdfbf134f26d3dfcc3c451b35c8ae1374eaa0eac6114ef22472d6e7fb35b',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.energiewettingen.ch/standard/compressed/9e7c49c1ea534517ba7f18d017abb565.js',
      sha256: '6d589337f770bf3275912ae3896af95d6fbfb37ea6e02d556eb521b11f7fc326',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.energiewettingen.ch/standard/compressed/c4621152977fe12b97754493eb1e7b75.js',
      sha256: '9fffce68cc89b7cbada03bc599bc1443237a0a31a6bbe888142fbc0f2c492bb3',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.energiewettingen.ch/standard/compressed/infotext-040da2cf754cfb8d33cc69a7042e8fb4.js',
      sha256: '88cce01581130e5f5de0df78ab76032af3ce926f470258023ce2b67875ba201c',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.energiewettingen.ch/js/utils/cookieUtil.js',
      sha256: 'b349c0ae1725263773d4f3f124601d7601b85d6a344296438aeb1fb2d3e521fc',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.energiewettingen.ch/js/models/cookie.js',
      sha256: 'c9945a9584605020c13cf64d89aea29948c40aa61ccd3acc76ef54f828eab7e1',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
  ].map((p) => Object.freeze(p)),
);

type Queue = { tail: Promise<void>; next: number; blockedUntil: number };
const queues = new WeakMap<typeof fetch, Queue>();
export function assertEwwSourcesAvailable(request: typeof fetch, now: () => number = Date.now) {
  if ((queues.get(request)?.blockedUntil ?? 0) > now()) throw changed();
}
export function paceEwwSourceReads(
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
      assertEwwSourcesAvailable(request, now);
      const delay = Math.max(0, queue.next - now());
      if (delay) await sleep(delay);
      assertEwwSourcesAvailable(request, now);
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
export async function verifyEwwSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
): Promise<void> {
  const paced = paceEwwSourceReads(request, now, sleep);
  try {
    const r = await paced(ewwFormUrl, {
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
      (r.url && r.url !== ewwFormUrl) ||
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
      if (ewwPageFingerprint(html) !== ewwPageSha256) throw changed();
    } finally {
      await reader.cancel().catch(() => {});
    }
    await verifyPublicSourceManifest(paced, ewwSources, retry, now);
  } catch {
    const q = queues.get(request)!;
    q.blockedUntil = Math.max(q.blockedUntil, now() + 300_000);
    throw changed();
  }
}
