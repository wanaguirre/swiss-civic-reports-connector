import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const tbwFormUrl = 'https://www.tbw.ch/unternehmen/kontakt/';
export const tbwPrivacyUrl = 'https://www.tbw.ch/datenschutz/';
export const tbwReferralUrl =
  'https://www.tbw.ch/news/artikel/umruestung-der-strassenbeleuchtung-in-weinfelden/';
export const tbwCategory = 'Unlit public streetlight';
export const tbwScope =
  'Text-only LOCAL preparation for a nonurgent unlit city streetlight maintained by TBW within Weinfelden (BFS4946), at the actual confirmed lamp point. Observe outside normal 00:15–05:15 shutdown. Regional utility supply does not establish lamp ownership or other municipality eligibility. Excludes emergencies, outages, private fixtures and other assets. Category, useful description, precise location and responsibility/time confirmations are local rules, not native fields. Private contact details remain outside AI. No photos, native payload, signed state/trap/client execution, sending or external completion.';
export const tbwCategories = [{ service_code: tbwCategory, service_name: tbwCategory }];
export const tbwSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://www.tbw.ch/news/artikel/umruestung-der-strassenbeleuchtung-in-weinfelden/',
      sha256: 'cba632fe3c211c40ec1301c29543d55b72ae71a1cbbc38a958191b6042604136',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/datenschutz/',
      sha256: '10e1bbe8b532152b9fbdee9f7d0b7f7ddfe1c178a553d73d1e9a75d8bbc1a341',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.weinfelden.ch/stadt/news/aktuell.html/310/news/9529/newsarchive/1',
      sha256: '4630cca0d27cf9f5f4d6c4b65f9d63b0c6b7e6631e981fb5c9524a740d32ec0d',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/515ba420917058b5f7e65599e64aa8c4/Javascript/vendor/js-cookie.min.js?1780496852',
      sha256: '7c82c3b271345c2ea5561914a910438df46aa613a25cd29ea4bb74fa89e3745e',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/515ba420917058b5f7e65599e64aa8c4/Javascript/cookieconsent.js?1780496852',
      sha256: 'bbbdfde1d5536bacb4ae6fe2f2b230ba65dccf3cb5fc8a279dd0e86919dc7b9c',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/typo3temp/assets/js/7f6f4007061a3385249e7e32f51dfafe.js?1784898765',
      sha256: '3fcd4d5f841caeeb937832f8d539e8387f781ea19d6c713fd19d98035cd6383d',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/pusha/dist/js/pusha.min.js?1784551618',
      sha256: 'b8a98a64eb40ccd31158f4be7ac7211a5aea16111309e733ded26afcf09a4676',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/main.js?1785307871',
      sha256: 'dd5cd5cececdc9922943bb562ed588b8f230069860239516d9c5145ffdfc466e',
      type: 'javascript',
      maxBytes: 1000000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () =>
  new Error('The TBW Weinfelden reporting contract has changed. Preparation is paused.');
/** Read and discard opaque state. Never deserialize it, execute scripts, fill traps or construct a native request. */
export function fingerprintTbwForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|turnstile|challenge/i.test(html))
      throw changed();
    const nodes = all(parse(html));
    if (nodes.some((n) => 'tagName' in n && attr(n, 'form') !== undefined)) throw changed();
    const forms = nodes.filter(
      (n): n is Element =>
        'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'kontakt-715',
    );
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      inner = all(form);
    const inputs = inner.filter((n): n is Element => 'tagName' in n && n.tagName === 'input');
    const opaqueNames = [
      'tx_form_formframework[kontakt-715][__state]',
      'tx_form_formframework[__trustedProperties]',
    ];
    const opaque: Element[] = [];
    for (const name of opaqueNames) {
      const fields = inputs.filter((n) => attr(n, 'name') === name);
      if (
        fields.length !== 1 ||
        attr(fields[0], 'type') !== 'hidden' ||
        !attr(fields[0], 'value')?.length ||
        (attr(fields[0], 'value')?.length ?? 0) > 100_000
      )
        throw changed();
      opaque.push(fields[0]);
    }
    const traps = inputs.filter((n) => attr(n, 'aria-hidden') === 'true');
    if (traps.length !== 1) throw changed();
    const trap = traps[0],
      random = attr(trap, 'data-id') ?? '';
    if (
      !/^[A-Za-z0-9]{20}$/.test(random) ||
      attr(trap, 'id') !== `kontakt-715-${random}` ||
      attr(trap, 'name') !== `tx_form_formframework[kontakt-715][${random}]` ||
      attr(trap, 'type') !== 'text' ||
      attr(trap, 'value') !== undefined
    )
      throw changed();
    const semantic = inner
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                a.name === 'value' && opaque.includes(n)
                  ? '<opaque-native-value>'
                  : n === trap && ['data-id', 'name', 'id'].includes(a.name)
                    ? a.value.replace(random, '<unexported-trap-name>')
                    : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    const scripts = nodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => {
        if (
          attr(n, 'nonce') !== undefined &&
          (!attr(n, 'nonce') || (attr(n, 'nonce')?.length ?? 0) > 256)
        )
          throw changed();
        return [
          n.attrs
            .map((a) => [a.name, a.name === 'nonce' ? '<csp-nonce>' : a.value])
            .sort(([a], [b]) => a.localeCompare(b)),
          n.childNodes
            .map((x) => ('value' in x ? x.value : ''))
            .join('')
            .trim(),
        ];
      });
    const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
    return { form: hash(semantic), scripts: hash(scripts) };
  } catch {
    throw changed();
  }
}
export function inspectTbwForm(html: string) {
  const pin = fingerprintTbwForm(html);
  if (
    pin.form !== 'eba0e656ba929b9ae04e980c3d4ea705795d9a76c7315fed7eb4e95842cd2fd8' ||
    pin.scripts !== 'dc0896a23044289fd2101770dae397aad8a13c4e0dfe3a4f1e0ad26bee402b20'
  )
    throw changed();
  return tbwCategories.map((c) => ({ ...c }));
}
export async function readTbwCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(tbwFormUrl, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Civic source verification (read-only; no client execution)',
    },
  });
  if (
    !response.ok ||
    response.redirected ||
    (response.url && new URL(response.url).href !== tbwFormUrl) ||
    !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
  ) {
    const value = response.headers.get('retry-after') ?? '';
    const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
    if (Number.isFinite(delay) && delay > 0) retry(delay);
    await response.body?.cancel();
    throw changed();
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
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
  const categories = inspectTbwForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, tbwSources, retry, now);
  return categories;
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertTbwSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyTbwSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let context = contexts.get(request);
  if (!context) {
    context = { tail: Promise.resolve(), next: 0, stopped: false };
    contexts.set(request, context);
  }
  const shared = context;
  const paced: typeof fetch = (input, init) => {
    const task = shared.tail.then(async () => {
      assertTbwSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertTbwSourcesAvailable(request);
      shared.next = now() + 2_000;
      try {
        const response = await request(input, init);
        if (response.status === 403 || response.status === 429) shared.stopped = true;
        return response;
      } catch {
        shared.stopped = true;
        throw changed();
      }
    });
    shared.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
  assertTbwSourcesAvailable(request);
  try {
    return await readTbwCategories(paced, retry, now);
  } catch {
    shared.stopped = true;
    throw changed();
  }
}

export const loadTbwCategories = verifyTbwSources;
export function tbwRequirements(): Record<string, Requirements> {
  const contact = (code: string, description: string, max_length = 100, required = true) => ({
    code,
    description,
    contact: true,
    datatype: 'string',
    max_length,
    required,
  });
  return {
    [tbwCategory]: {
      scope: tbwScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      email_max_length: 254,
      phone_required: false,
      phone_max_length: 50,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Technische Betriebe Weinfelden AG – city streetlighting'],
      extra_fields: [
        { ...contact('salutation', 'Private salutation'), values: ['Frau', 'Herr'] },
        contact('first_name', 'Private first name'),
        contact('last_name', 'Private last name'),
        contact('reporter_street', 'Private street and house number', 250),
        contact('contact_postcode', 'Private postcode', 20),
        contact('contact_locality', 'Private locality'),
        contact('contact_mobile_phone', 'Private MOBILE phone (required)', 50),
        contact('contact_postbox', 'Private postbox (optional)', 100, false),
        {
          ...contact('privacy_acknowledgement', 'TBW privacy policy read'),
          values: ['TBW privacy policy read and understood'],
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm actual TBW-maintained city lamp in Weinfelden',
          required: true,
          datatype: 'string',
          values: ['TBW-maintained city streetlight in Weinfelden confirmed'],
        },
        {
          code: 'outside_shutdown_confirmed',
          description: 'Confirm fault observed outside normal 00:15–05:15 shutdown',
          required: true,
          datatype: 'string',
          values: ['Unlit lamp observed outside normal 00:15–05:15 shutdown'],
        },
      ],
      notes: [
        'Nur lokale Textvorbereitung einer nicht dringenden unbeleuchteten Stadtlampe in Weinfelden, ausserhalb normaler Abschaltung 00:15–05:15. Keine privaten Anlagen, Stromausfälle, akute Gefahr oder anderen Gemeinden. Keine nativen Schadenkategorien; Kategorie und nützliche Beschreibung sind lokale Regeln.',
        'Private Anrede, getrennte Namen, Strasse/Hausnummer, PLZ/Ort, MOBILTELEFON, E-Mail und Datenschutz-Lesebestätigung erforderlich. Privattelefon und Postfach sind nativ freiwillig. Exakter Lampenpunkt und Zuständigkeits-/Zeitbestätigung sind lokale Regeln. Keine Fotos.',
        'Datenschutz wirksam 22.09.2026: Bearbeitung und Beantwortung; Websitehosting Schweiz, teils EWR und mögliche weltweite/US-Bearbeitung mit Garantien. Keine feste Meldungsfrist. Kundenportal mit reCAPTCHA ist ein anderer Dienst. Kontaktform ohne verifizierte Annahme oder Client-Verhalten.',
        'Native TYPO3-Zustände, Trap und CSP-Nonce werden nur geprüft/verworfen, nie ausgeführt oder als Nutzlast verwendet. Kein Versand, externer Abschluss oder Tracking. Bei unklarem Ausgang nicht wiederholen oder den Kanal wechseln.',
      ],
    },
  };
}
