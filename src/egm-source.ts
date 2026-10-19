import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The Mülligen EGM source has changed. Preparation is paused.');
function one<T>(items: T[]): T {
  if (items.length !== 1) throw changed();
  return items[0];
}
export const egmFormUrl = 'https://egm-strom.ch/onlineschalter/defekte-lampen/';
export const egmIdentityUrl = 'https://egm-strom.ch/ueber-uns/';
export const egmPrivacyUrl = 'https://egm-strom.ch/datenschutz/';
export type EgmPage = 'form' | 'identity' | 'privacy';
/** Full original UTF8 bytes remain significant except precisely located shaped
 * read-time state and trap-label text. No protection answer, token, native state,
 * code, upload URL or payload is calculated, executed or returned for reuse. */
export function egmPageFingerprint(html: string, kind: EgmPage): string {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const nodes = all(
    parse(html, {
      sourceCodeLocationInfo: true,
      onParseError() {
        throw changed();
      },
    }),
  );
  const edits: { start: number; end: number; value: string }[] = [];
  function textEdit(n: Node, shape: RegExp, value: string) {
    if (!('value' in n) || !shape.test(n.value) || !n.sourceCodeLocation) throw changed();
    edits.push({
      start: n.sourceCodeLocation.startOffset,
      end: n.sourceCodeLocation.endOffset,
      value,
    });
  }
  function attributeEdit(n: Element, name: string, shape: RegExp, marker: string) {
    const value = attr(n, name),
      loc = n.sourceCodeLocation?.attrs?.[name];
    if (!loc || value === undefined || !shape.test(value)) throw changed();
    const raw = html.slice(loc.startOffset, loc.endOffset);
    const match = /^([a-z-]+)=(['"])([\s\S]*)\2$/.exec(raw);
    if (!match || match[1] !== name || match[3] !== value) throw changed();
    const start = loc.startOffset + name.length + 2;
    edits.push({ start, end: start + value.length, value: marker });
  }
  const forms = nodes.filter((n): n is Element => 'tagName' in n && n.tagName === 'form');
  if (forms.length !== (kind === 'form' ? 2 : 1)) throw changed();
  for (const [id, length, trap] of kind === 'form'
    ? [
        [7, 792, 12],
        [2, 612, 7],
      ]
    : [[2, 612, 7]]) {
    const form = one(forms.filter((n) => attr(n, 'id') === `gform_${id}`));
    const selected = all(form);
    if (nodes.some((n) => 'tagName' in n && attr(n, 'form') === `gform_${id}`)) throw changed();
    const state = one(
      selected.filter((n): n is Element => 'tagName' in n && attr(n, 'name') === `state_${id}`),
    );
    if (state.tagName !== 'input' || attr(state, 'type') !== 'hidden') throw changed();
    attributeEdit(
      state,
      'value',
      new RegExp(`^[A-Za-z0-9+/=]{${length}}$`),
      `[checked-state-${id}]`,
    );
    const label = one(
      selected.filter(
        (n): n is Element =>
          'tagName' in n && n.tagName === 'label' && attr(n, 'for') === `input_${id}_${trap}`,
      ),
    );
    const span = one(label.childNodes);
    if (!('tagName' in span) || span.tagName !== 'span') throw changed();
    textEdit(
      one(span.childNodes),
      /^(?:Phone|Name|Email|Comments|Comment|Website|Company|Facebook|Twitter|X\/Twitter|Instagram|Fax|URL|Address)$/,
      `[checked-trap-label-${id}]`,
    );
  }
  if (kind === 'form') {
    const upload = one(
      nodes.filter(
        (n): n is Element => 'tagName' in n && attr(n, 'id') === 'gform_multifile_upload_7_10',
      ),
    );
    const settings = JSON.parse(attr(upload, 'data-settings') ?? 'null');
    const value = settings?.multipart_params?._gform_file_upload_nonce_7_10;
    const loc = upload.sourceCodeLocation?.attrs?.['data-settings'];
    if (!loc || typeof value !== 'string' || !/^[a-f0-9]{10}$/.test(value)) throw changed();
    const raw = html.slice(loc.startOffset, loc.endOffset);
    if (raw.split(value).length !== 2) throw changed();
    const start = loc.startOffset + raw.indexOf(value);
    edits.push({ start, end: start + value.length, value: '[checked-upload-state]' });
  }
  for (const [id, key] of [
    ['eae-main-js-extra', 'nonce'],
    ['gform_gravityforms_theme-js-extra', 'ajax_submission_nonce'],
    ['gform_gravityforms_theme-js-extra', 'config_nonce'],
  ]) {
    const script = one(
      nodes.filter(
        (n): n is Element => 'tagName' in n && n.tagName === 'script' && attr(n, 'id') === id,
      ),
    );
    const body = one(script.childNodes);
    if (!('value' in body) || !body.sourceCodeLocation) throw changed();
    const match = one([...body.value.matchAll(new RegExp(`"${key}":"([a-f0-9]{10})"`, 'g'))]);
    const start = body.sourceCodeLocation.startOffset + match.index! + match[0].indexOf(match[1]);
    edits.push({ start, end: start + 10, value: `[checked-${key}]` });
  }
  edits.sort((a, b) => b.start - a.start);
  let end = html.length;
  for (const e of edits) {
    if (e.end > end || e.start < 0) throw changed();
    html = html.slice(0, e.start) + e.value + html.slice(e.end);
    end = e.start;
  }
  return createHash('sha256').update(html, 'utf8').digest('hex');
}
export const egmSources = Object.freeze([
  Object.freeze({
    url: egmFormUrl,
    kind: 'form' as const,
    sha256: '54580587d510f8133c660160c89525e146654bc115233cac6fcd184aa44cafe7',
  }),
  Object.freeze({
    url: egmIdentityUrl,
    kind: 'identity' as const,
    sha256: 'ec57c3f52ca4fe791395e3080bd86b8521260cbbcfe430f5a51e3c3c2f4ec35b',
  }),
  Object.freeze({
    url: egmPrivacyUrl,
    kind: 'privacy' as const,
    sha256: 'bcc905de6da5933e10f71f514d71cc134fc383505bfbbb7c89513ea3feb17fc5',
  }),
]);
type Queue = { tail: Promise<void>; next: number; blocked: boolean };
const queues = new WeakMap<typeof fetch, Queue>();
export function assertEgmSourcesAvailable(request: typeof fetch) {
  if (queues.get(request)?.blocked) throw changed();
}
/** Fixed GETs only, paced across instances.403/429 stop all further EGM reads
 * for this request context; never follow redirects/cookies or discover endpoints. */
export async function verifyEgmSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
) {
  let q = queues.get(request);
  if (!q) {
    q = { tail: Promise.resolve(), next: 0, blocked: false };
    queues.set(request, q);
  }
  const queue = q;
  for (const pin of egmSources) {
    const task = queue.tail.then(async () => {
      assertEgmSourcesAvailable(request);
      const delay = Math.max(0, queue.next - now());
      if (delay) await sleep(delay);
      assertEgmSourcesAvailable(request);
      queue.next = now() + 2000;
      const r = await request(pin.url, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Civic source verification (read-only; no client execution)',
        },
      });
      if ([403, 429].includes(r.status)) queue.blocked = true;
      if (
        !r.ok ||
        r.redirected ||
        (r.url && r.url !== pin.url) ||
        !/^text\/html(?:;|$)/i.test(r.headers.get('content-type') ?? '') ||
        !r.body
      ) {
        const h = r.headers.get('retry-after') ?? '';
        const delay = /^\d+$/.test(h) ? Number(h) * 1000 : Date.parse(h) - now();
        if (Number.isFinite(delay) && delay > 0) retry(delay);
        await r.body?.cancel();
        throw changed();
      }
      const reader = r.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const p = await reader.read();
          if (p.done) break;
          bytes += p.value.byteLength;
          if (bytes > 1000000) throw changed();
          chunks.push(p.value);
        }
        const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          Buffer.concat(chunks),
        );
        if (egmPageFingerprint(html, pin.kind) !== pin.sha256) throw changed();
      } finally {
        await reader.cancel().catch(() => {});
      }
    });
    queue.tail = task.then(
      () => undefined,
      () => undefined,
    );
    await task;
  }
}
