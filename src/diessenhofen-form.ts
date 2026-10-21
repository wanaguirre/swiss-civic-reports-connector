import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const diessenhofenFormUrl = 'https://www.diessenhofen.ch/stadtmelder.html/234';
export const diessenhofenPrivacyUrl = 'https://www.diessenhofen.ch/datenschutzerklaerung.html/156';
export const diessenhofenReferralUrl =
  'https://www.diessenhofen.ch/gemeinde/verwaltung/abteilungen/werkhof.html/66';
export const diessenhofenCategory = 'Stadtmelder';
export const diessenhofenScope =
  'Local text-only preparation of nonurgent observations about confirmed municipal roads or public space at their exact point within Diessenhofen (BFS4545). Stadtmelder is a general feedback channel, not an enumerated maintenance-category form. Works duties alone do not establish ownership of every asset. Excludes emergencies, utility outages, private assets and neighbouring municipalities. Private names, address, email and optional phone remain outside AI. No photos, native payload, client execution or sending.';
export const diessenhofenCategories = [
  { service_code: diessenhofenCategory, service_name: diessenhofenCategory },
];
export const diessenhofenSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: diessenhofenReferralUrl,
      sha256: 'bb17a1c669c293f592781f71dfc5b67dcb1f82c583f219484b4b398fe8604972',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: diessenhofenPrivacyUrl,
      sha256: '39c43d23fe6976f4f580d0728223b365ed517f95f23c8da69a8bd6313f974ee0',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.diessenhofen.ch/static/js/femodules/form/form.min.js?ver=1.8.117_1',
      sha256: 'cb83c53c3e6038d55b24b8fe257a51a852f5738893b8312d30b983973a811ec6',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.diessenhofen.ch/static/js/global/helper/util/cffp.min.js',
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
const changed = () =>
  new Error('The Diessenhofen Stadtmelder form has changed. Preparation is paused.');
/** Fingerprint the full builder and every script. Read-time state is checked and discarded; never execute or simulate interaction counters, fill traps or construct a POST. */
export function fingerprintDiessenhofenForm(html: string) {
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
          (x) => 'tagName' in x && attr(x, 'name') === 'formId' && attr(x, 'value') === '3',
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
export function inspectDiessenhofenForm(html: string) {
  const pin = fingerprintDiessenhofenForm(html);
  if (
    pin.form !== '0e0b7fd8b340c1f8f1550e4da1adbf6cd1cbbf2fe733460edf3b74a530ef07ad' ||
    pin.scripts !== 'cfc749556fdf53238ffece8742c17012f41626d1a16e8295df56b77ac97b6ae2'
  )
    throw changed();
  return [{ service_code: diessenhofenCategory, service_name: diessenhofenCategory }];
}
export async function readDiessenhofenCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(diessenhofenFormUrl, {
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
    (response.url && new URL(response.url).href !== diessenhofenFormUrl) ||
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
  const categories = inspectDiessenhofenForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, diessenhofenSources, retry, now);
  return categories;
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertDiessenhofenSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyDiessenhofenSources(
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
      assertDiessenhofenSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertDiessenhofenSourcesAvailable(request);
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
  assertDiessenhofenSourcesAvailable(request);
  try {
    return await readDiessenhofenCategories(paced, retry, now);
  } catch {
    shared.stopped = true;
    throw changed();
  }
}

export const loadDiessenhofenCategories = verifyDiessenhofenSources;
export function diessenhofenRequirements(): Record<string, Requirements> {
  const field = (code: string, description: string, max_length = 100, required = true) => ({
    code,
    description,
    contact: true,
    max_length,
    required,
    datatype: 'string',
  });
  return {
    [diessenhofenCategory]: {
      scope: diessenhofenScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: false,
      phone_max_length: 50,
      email_max_length: 254,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Stadtgemeinde Diessenhofen – Stadtmelder'],
      extra_fields: [
        field('first_name', 'Private first name'),
        field('last_name', 'Private last name'),
        field('reporter_street', 'Private reporter street', 250),
        field('contact_house_number', 'Private reporter house number', 100, false),
        {
          ...field(
            'contact_postcode',
            'Private reporter postcode (1000–99999, no leading zeros)',
            5,
          ),
          format: 'postcode_1000_99999',
        },
        field('contact_locality', 'Private reporter locality'),
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm municipal privacy policy read',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Diessenhofen privacy policy read and understood'],
        },
        {
          code: 'public_asset_confirmed',
          description: 'Confirm actual municipal public-space responsibility in Diessenhofen',
          required: true,
          datatype: 'string',
          values: ['Actual municipal road or public space in Diessenhofen confirmed'],
        },
      ],
      notes: [
        'Nur lokale Textvorbereitung nicht dringender Beobachtungen zu bestätigten Gemeindestrassen oder öffentlichem Raum in Diessenhofen. Stadtmelder ist ein allgemeiner Rückmeldekanal ohne vorgegebene Schadenkategorien. Keine Privatobjekte, Versorgungsstörungen oder akute Gefahr.',
        'Nativ erforderlich sind private Vor-/Nachnamen, Strasse, PLZ/Ort und E-Mail. Hausnummer, Telefon und Bemerkungen sind nativ freiwillig. Eine nützliche Beschreibung, genaue Beobachtungsstelle, Zuständigkeitsbestätigung, Textlimits und Datenschutz-Lesebestätigung sind lokale Regeln. Keine Fotos.',
        'Die Richtlinie speichert Kontaktformular-Anfragen und Kontaktdaten für Bearbeitung und Rückfragen und beschreibt keine Weitergabe ohne Einwilligung. Keine feste Meldungs-Löschfrist oder absolute Übertragungssicherheit festgestellt; Konto- und Newsletterbedingungen nicht automatisch auf Meldungen übertragen.',
        'Keine Interaktionszähler, Trap-, Client- oder Challenge-Ausführung, Nutzlast oder Übermittlung. Eingang und Annahme ungeprüft. Bei unklarem Ausgang nicht erneut melden und nicht den Sendekanal wechseln.',
      ],
    },
  };
}
