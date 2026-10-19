import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const zofingenFormUrl =
  'https://www.zofingen.ch/verwaltung/bauverwaltung/meldeformular-schaeden-oder-maengel-an-gemeindeinfrastruktur.html/1521';
export const zofingenPrivacyUrl =
  'https://www.zofingen.ch/services/datenschutzerklaerung.html/1290';
export const zofingenReferralUrl = 'https://www.zofingen.ch/verwaltung/werkhof.html/43';
export const zofingenScope =
  'Only local preparation of nonurgent damage to confirmed municipal infrastructure in Zofingen BFS4289 at its actual point. Native categories: buildings, parks/greens, playgrounds, roads/pavements, signage, other municipal infrastructure. Excludes private property, urgent danger, utility supply/outages, police tips and neighbouring municipalities. Mandatory private combined name, daytime phone and email stay outside AI. Native photo is optional; local preparation accepts no photos.';
export const zofingenCategories = [
  'Gebäude',
  'Park- und Grünanlagen',
  'Spielplatz',
  'Strasse / Trottoir',
  'Signalisation',
  'Andere',
].map((service_code) => ({ service_code, service_name: service_code }));
export const zofingenSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: zofingenReferralUrl,
      sha256: 'e699db01502d2b5d5884e3b02db6ad9023a7ddbff6572a0266c919e46345c9a9',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: zofingenPrivacyUrl,
      sha256: '77a67ae3f1b816d52b42d724712806f21d7f2bb46e5a5b87a20aa78431fcb373',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.zofingen.ch/static/js/femodules/form/form.min.js?ver=1.8.117_1',
      sha256: 'cb83c53c3e6038d55b24b8fe257a51a852f5738893b8312d30b983973a811ec6',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.zofingen.ch/static/js/global/helper/util/cffp.min.js',
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
  new Error('The Zofingen infrastructure form has changed. Preparation is paused.');
/** Fingerprint the full builder and every script. Read-time state is checked and discarded; never execute or simulate interaction counters, fill traps or construct a POST. */
export function fingerprintZofingenForm(html: string) {
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
          (x) => 'tagName' in x && attr(x, 'name') === 'formId' && attr(x, 'value') === '2937',
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
export function inspectZofingenForm(html: string) {
  const pin = fingerprintZofingenForm(html);
  if (
    pin.form !== 'e42fda4de9f4c5b5943412add4ace352a640cbb136c1fd48916e8e5be5bc0727' ||
    pin.scripts !== '00e0310868ab4aeee1235810e6bbd6b106149ca52672c3f7fac89333772a65f1'
  )
    throw changed();
  return zofingenCategories.map((c) => ({ ...c }));
}
export async function readZofingenCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(zofingenFormUrl, {
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
    (response.url && new URL(response.url).href !== zofingenFormUrl) ||
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
  const categories = inspectZofingenForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, zofingenSources, retry, now);
  return categories;
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertZofingenSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyZofingenSources(
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
      assertZofingenSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertZofingenSourcesAvailable(request);
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
  assertZofingenSourcesAvailable(request);
  try {
    return await readZofingenCategories(paced, retry, now);
  } catch {
    shared.stopped = true;
    throw changed();
  }
}

export const loadZofingenCategories = verifyZofingenSources;
export function zofingenRequirements(): Record<string, Requirements> {
  const field = (
    code: string,
    description: string,
    contact: boolean,
    max_length = 250,
    required = true,
  ) => ({ code, description, contact, max_length, required, datatype: 'string' });
  return Object.fromEntries(
    zofingenCategories.map(({ service_code }) => [
      service_code,
      {
        scope: zofingenScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        phone_max_length: 100,
        email_max_length: 254,
        contact_fields: ['phone'],
        description_max_length: 4000,
        location_label_max_length: 250,
        bodies: ['Stadt Zofingen – Gemeindeinfrastruktur'],
        extra_fields: [
          field('contact_name', 'Private full name', true, 200),
          {
            ...field(
              'observation_date',
              'Actual date the damage was observed (YYYY-MM-DD)',
              false,
              10,
            ),
            format: 'past_iso_date',
          },
          field('asset_street', 'Actual affected municipal asset street and number', false),
          field('building', 'Affected municipal building, if relevant', false, 250, false),
          {
            code: 'municipal_asset_confirmed',
            description: 'Confirm actual municipal infrastructure in Zofingen',
            required: true,
            datatype: 'string',
            values: ['Actual municipal infrastructure in Zofingen confirmed'],
          },
          {
            code: 'privacy_acknowledgement',
            description: 'Confirm municipal privacy policy read',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['Zofingen privacy policy read and understood'],
          },
        ],
        notes: [
          'Nur lokale Vorbereitung nicht dringender Schäden an bestätigter Gemeindeinfrastruktur in Zofingen. Genauen Punkt und tatsächliche kommunale Zuständigkeit bestätigen; keine Privatobjekte, Stromausfälle, akute Gefahren oder Polizeihinweise.',
          'Nativ erforderlich: Name/Vorname, tagsüber erreichbares Telefon, E-Mail, Kategorie, tatsächliches Feststellungsdatum, Standort und Beschreibung. Gebäude freiwillig. Fotos sind nativ freiwillig; diese lokale Vorbereitung unterstützt keine Anhänge.',
          'Textlimits, nicht zukünftiges ISO-Datum, bestätigtes Gemeindeobjekt und Datenschutz-Lesebestätigung sind lokale Regeln, kein natives Zustimmungsfeld. Private Kontaktdaten bleiben ausserhalb der KI.',
          'Richtlinie beschreibt zweckgebundene Speicherung von Anfragen und Kontaktdaten für Bearbeitung/Rückfragen und keine Weitergabe ohne Einwilligung, aber keinen lückenlosen Übertragungsschutz oder feste Mängel-Löschfrist. Allgemeine Newsletter/Konto-/Zahlungsbedingungen sind keine Mängelbedingungen.',
          'Keine Übermittlung, nativen Interaktionszähler, Formularzustände, Schutzmechanismen oder Uploads. Versand, Eingang und Bearbeitung sind nicht verifiziert; nach unklarem Ausgang nicht automatisch erneut senden oder Kanal wechseln.',
        ],
      } satisfies Requirements,
    ]),
  );
}
