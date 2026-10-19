import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const obermumpfFormUrl =
  'https://www.obermumpf.ch/verwaltung/online-schalter/defekte-strassenlampen-meldung.html/198';
export const obermumpfPrivacyUrl = 'https://www.obermumpf.ch/services/datenschutz.html/32';
export const obermumpfReferralUrl = 'https://www.obermumpf.ch/portrait/elektrizitaet.html/14';
export const obermumpfCategory = 'Defekte Strassenlampen';
export const obermumpfScope =
  'Only nonurgent faults of actual municipal public streetlights within Obermumpf (BFS4256), at their confirmed precise point. Municipality handles small lamp repairs and receives reports; AEW has broader lighting maintenance responsibility. Neither supply nor boundary alone proves asset eligibility. Excludes private lights, outages, urgent hazards and neighbouring municipalities. Native private names, address, phone and email remain outside AI; optional genuine lamp number, no photos.';
export const obermumpfCategories = [
  { service_code: obermumpfCategory, service_name: obermumpfCategory },
];
export const obermumpfSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: obermumpfReferralUrl,
      sha256: '69709366078454c3e9d0b32ec1dccc4b8d0650d563a7b76c44781b44967c8a16',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: obermumpfPrivacyUrl,
      sha256: '5a40e09d01fa082e6e963ed4454fa032282d57f4842ee5b384fafc4eea57d132',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.obermumpf.ch/static/js/femodules/form/form.min.js?ver=1.8.117_1',
      sha256: 'cb83c53c3e6038d55b24b8fe257a51a852f5738893b8312d30b983973a811ec6',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.obermumpf.ch/static/js/global/helper/util/cffp.min.js',
      sha256: '39be0b02b2c15cc3fefe5d41e072fbce2b9751ac2b71ecb87550f14ec19d55fa',
      type: 'javascript',
      maxBytes: 1000000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The Obermumpf lighting form has changed. Preparation is paused.');
/** Fingerprint the full builder and every script. Read-time state is checked and discarded; never execute or simulate interaction counters, fill traps or construct a POST. */
export function fingerprintObermumpfForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|turnstile|challenge/i.test(html))
      throw changed();
    const documentNodes = all(parse(html));
    if (documentNodes.some((n) => 'tagName' in n && attr(n, 'form') !== undefined)) throw changed();
    const forms = documentNodes.filter(
      (n): n is Element =>
        'tagName' in n &&
        n.tagName === 'form' &&
        all(n).some(
          (x) => 'tagName' in x && attr(x, 'name') === 'formId' && attr(x, 'value') === '36',
        ),
    );
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      builder = form.parentNode;
    if (
      !builder ||
      !('tagName' in builder) ||
      builder.tagName !== 'div' ||
      attr(builder, 'class') !== 'form-builder js-form-builder'
    )
      throw changed();
    const nodes = all(builder),
      inputs = all(form).filter((n): n is Element => 'tagName' in n && n.tagName === 'input');
    const dynamic: Element[] = [];
    for (const cls of ['cffp_mm', 'cffp_kp']) {
      const matches = inputs.filter((n) => attr(n, 'class') === cls);
      if (
        matches.length !== 1 ||
        attr(matches[0], 'type') !== 'hidden' ||
        attr(matches[0], 'value') !== ''
      )
        throw changed();
      dynamic.push(matches[0]);
    }
    const stamps = inputs.filter(
      (n) =>
        attr(n, 'type') === 'hidden' &&
        /^formfield\d{10}$/.test(attr(n, 'name') ?? '') &&
        attr(n, 'class') === undefined,
    );
    const honeypots = inputs.filter((n) => attr(n, 'id') === 'cffp_ef');
    if (
      stamps.length !== 1 ||
      !/^\d{13}$/.test(attr(stamps[0], 'value') ?? '') ||
      honeypots.length !== 1 ||
      attr(honeypots[0], 'type') !== 'text' ||
      attr(honeypots[0], 'value') !== ''
    )
      throw changed();
    dynamic.push(stamps[0], honeypots[0]);
    if (
      new Set(dynamic.map((n) => attr(n, 'name'))).size !== 4 ||
      dynamic.some((n) => !/^formfield\d{10}$/.test(attr(n, 'name') ?? ''))
    )
      throw changed();
    for (const [name, size] of [
      ['token', 64],
      ['submitionKey', 24],
    ] as const) {
      const fields = inputs.filter((n) => attr(n, 'name') === name);
      if (
        fields.length !== 1 ||
        attr(fields[0], 'type') !== 'hidden' ||
        !new RegExp(`^[A-Fa-f0-9]{${size}}$`).test(attr(fields[0], 'value') ?? '')
      )
        throw changed();
    }
    const semantic = nodes
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                a.name === 'name' && dynamic.includes(n)
                  ? `formfield${dynamic.indexOf(n)}`
                  : a.name === 'value' && n === stamps[0]
                    ? '<technical-time>'
                    : a.name === 'value' &&
                        n.tagName === 'input' &&
                        ['token'].includes(attr(n, 'name') ?? '')
                      ? '<technical-value>'
                      : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in n) return n.value.replace(/\s+/g, ' ').trim();
        return null;
      })
      .filter((x) => x !== '' && x !== null);
    const scripts = documentNodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => [
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim(),
      ]);
    return {
      form: createHash('sha256').update(JSON.stringify(semantic)).digest('hex'),
      scripts: createHash('sha256').update(JSON.stringify(scripts)).digest('hex'),
    };
  } catch {
    throw changed();
  }
}
export function inspectObermumpfForm(html: string) {
  const pin = fingerprintObermumpfForm(html);
  if (
    pin.form !== '903d289f0d6d6651e33a8145646212db9cfb06ae58027d858598371df07da21d' ||
    pin.scripts !== 'efe76e4d0c2f5a428afc7d4dacc3e35842788aa145ecef9a004e0cf503b60bd5'
  )
    throw changed();
  return [{ service_code: obermumpfCategory, service_name: obermumpfCategory }];
}
export async function readObermumpfCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(obermumpfFormUrl, {
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
    (response.url && new URL(response.url).href !== obermumpfFormUrl) ||
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
  const categories = inspectObermumpfForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, obermumpfSources, retry, now);
  return categories;
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertObermumpfSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyObermumpfSources(
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
      assertObermumpfSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertObermumpfSourcesAvailable(request);
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
  assertObermumpfSourcesAvailable(request);
  try {
    return await readObermumpfCategories(paced, retry, now);
  } catch {
    shared.stopped = true;
    throw changed();
  }
}

export const loadObermumpfCategories = verifyObermumpfSources;
export function obermumpfRequirements(): Record<string, Requirements> {
  const field = (
    code: string,
    description: string,
    contact: boolean,
    max_length = 100,
    required = true,
  ) => ({ code, description, contact, max_length, required, datatype: 'string' });
  return {
    [obermumpfCategory]: {
      scope: obermumpfScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      phone_max_length: 100,
      email_max_length: 254,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Gemeinde Obermumpf – Strassenbeleuchtung'],
      extra_fields: [
        field('first_name', 'Private first name', true),
        field('last_name', 'Private last name', true),
        field('reporter_street', 'Private reporter street', true, 250),
        field('contact_house_number', 'Private reporter house number', true),
        {
          ...field(
            'contact_postcode',
            'Private reporter postcode (1000–99999, no leading zeros)',
            true,
            5,
          ),
          format: 'postcode_1000_99999',
        },
        field('contact_locality', 'Private reporter locality', true),
        field('lamp_street', 'Actual defective lamp street', false, 250),
        field(
          'lamp_number',
          'Genuine lamp number if known (keep leading zeros)',
          false,
          100,
          false,
        ),
        {
          code: 'defect_type',
          description: 'Actual nonurgent lamp defect',
          required: true,
          datatype: 'string',
          values: [
            'Lampe brennt nicht',
            'Lampe brennt unregelmässig',
            'Leuchte zerstört',
            'Anderer Defekt',
          ],
        },
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm municipal privacy policy read',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Obermumpf privacy policy read and understood'],
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm actual municipal public lamp in Obermumpf',
          required: true,
          datatype: 'string',
          values: ['Actual municipal public lamp in Obermumpf confirmed'],
        },
      ],
      notes: [
        'Nur lokale Vorbereitung nicht dringender Defekte an bestätigten öffentlichen Strassenlampen in Obermumpf. Genauen Lampenpunkt und tatsächlichen Defekt bestätigen; keine Privatleuchten, Stromausfälle oder akute Gefahr.',
        'Nativ erforderlich: Lampenstrasse, Schadenart, private Vor-/Nachnamen, Strasse, Hausnummer, PLZ/Ort, Telefon und E-Mail. Kandelabernummer freiwillig; nur echte Nummer angeben und führende Nullen erhalten. Keine Fotoanhänge.',
        'Natives PLZ-Regelwerk erlaubt Zahlen von 1000 bis 99999; lokales Format verwirft führende Nullen. Textlimits, nützliche Beschreibung, bestätigte Zuständigkeit und Datenschutz-Lesebestätigung sind lokale Regeln, kein natives Zustimmungsfeld.',
        'Richtlinie beschreibt Speicherung von Anfragen und Kontaktdaten für Bearbeitung und Rückfragen, keine Weitergabe ohne Einwilligung und keine absolute Übertragungssicherheit. Keine feste Lampen-Löschfrist; Konto-/Newsletterbedingungen nicht automatisch auf Lampenmeldungen übertragen.',
        'Keine Interaktionszähler, Trap-, Client-, Karten- oder Challenge-Ausführung, Formularbefüllung, Nutzlast oder Übermittlung. Eingang, Annahme und Status ungeprüft. Bei unklarem Ausgang nicht erneut melden und nicht den Sendekanal wechseln.',
      ],
    },
  };
}
