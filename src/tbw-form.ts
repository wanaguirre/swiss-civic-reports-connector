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
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/component-service/lib/component-service.js?v=a0831c7c',
      sha256: '9ba4ec00fa05c64635885b2b7839f895b8ac682ae6da10594408f4f8db417852',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/event-throttle/lib/event-throttle.js?v=6d53ac4e',
      sha256: 'd8f1a8ea4476e2eca809b88eb7c44113b1b136a9389b791ef8eab981b302076f',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/customProperties/customProperties.js?v=3fd15df0',
      sha256: '55d1346b1cef795c51b04899c0ca90525ea4ffcd0e74f891c0343e8c7b731aec',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/scrollDirection/scrollDirection.js?v=ffd65244',
      sha256: '6a4afe21adf88508a04afa61b3923f8ced1d17386c4920e5e29d3c43716c073e',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/hero/hero.js?v=66080488',
      sha256: '2d238f1906f3b79103866c975b4b99ef784247a52283f9fc8e9d1a1496afd164',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/in-view/lib/in-view.js?v=81d2f1eb',
      sha256: 'a31fbcbf1d24bb950b941ffba1e8827de2655c400c43439606f6a5ab69eb03c4',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/panel/panel.js?v=cc5b72b3',
      sha256: '072637238e1afe700e92b658f773ddb39f07b0a5aadc37c66d1063152859f24c',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/navigation/navigation.js?v=73cbec49',
      sha256: '270e1ca3623663546e534da1adb0c3753ae69388482bba4e7409d57d3159e2ba',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.tbw.ch/_assets/9936fbff2fa9683e2f00411c767453f4/Javascript/components/toggler/lib/toggler.js?v=4d6ddf3f',
      sha256: 'c07933c3bda9f24e8129dc948bb6b29c90e8357abd3b5703699161782bf02c70',
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
    const components = nodes
      .filter(
        (n): n is Element =>
          'tagName' in n &&
          (attr(n, 'data-modules') !== undefined ||
            (attr(n, 'class') ?? '').includes('js-koch-component')),
      )
      .map((n) => [
        n.tagName,
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
      ]);
    return { form: hash(semantic), scripts: hash(scripts), components: hash(components) };
  } catch {
    throw changed();
  }
}
export function inspectTbwForm(html: string) {
  const pin = fingerprintTbwForm(html);
  if (
    pin.form !== 'eba0e656ba929b9ae04e980c3d4ea705795d9a76c7315fed7eb4e95842cd2fd8' ||
    pin.scripts !== 'dc0896a23044289fd2101770dae397aad8a13c4e0dfe3a4f1e0ad26bee402b20' ||
    pin.components !== 'd4b7521267de7ffb21c08ffb3583fd627a6af25defc96ab75c5407e57f2245c8'
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
  // The shared paced request serializes all batches and permanently stops after any failure.
  for (let offset = 0; offset < tbwSources.length; offset += 10)
    await verifyPublicSourceManifest(request, tbwSources.slice(offset, offset + 10), retry, now);
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
