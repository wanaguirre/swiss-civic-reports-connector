import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const tbsFormUrl = 'https://www.tbsuhr.ch/support/stoerung/stoerungsformular.html/82';
export const tbsPrivacyUrl = 'https://www.tbsuhr.ch/services/datenschutz.html/8';
export const tbsReferralUrl = 'https://www.suhr.ch/allethemenbereiche/thema/91718';
export const tbsCategory = 'Strassenbeleuchtung';
export const tbsScope =
  'Non-emergency defects of actual TBS-maintained public streetlights within Suhr (BFS4012). Confirm the actual maintained public lamp and point. Municipal boundaries do not prove asset ownership. Private fixtures, supply outages, water/TV/heating faults, urgent hazards and neighbouring municipalities are excluded.';
export const tbsSources: readonly PublicSourcePin[] = Object.freeze([
  Object.freeze({
    url: 'https://www.tbsuhr.ch/static/js/femodules/form/form.min.js?ver=1.8.117_1',
    sha256: 'cb83c53c3e6038d55b24b8fe257a51a852f5738893b8312d30b983973a811ec6',
    type: 'javascript',
    maxBytes: 50_000,
  }),
  Object.freeze({
    url: 'https://www.tbsuhr.ch/static/js/global/helper/util/cffp.min.js',
    sha256: '39be0b02b2c15cc3fefe5d41e072fbce2b9751ac2b71ecb87550f14ec19d55fa',
    type: 'javascript',
    maxBytes: 10_000,
  }),
  Object.freeze({
    url: tbsPrivacyUrl,
    sha256: 'b464ba482e84c89b1f0d6beb7c5313f09e197804a416fdc378fe5dedc329009f',
    type: 'html',
    maxBytes: 500_000,
  }),
]);
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The TBS Suhr lighting form has changed. Preparation is paused.');
/** Fingerprint the full builder and every script. Read-time state is checked and discarded; never execute or simulate interaction counters, fill traps or construct a POST. */
export function fingerprintTbsForm(html: string) {
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
          (x) => 'tagName' in x && attr(x, 'name') === 'formId' && attr(x, 'value') === '11',
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
                        ['token', 'submitionKey'].includes(attr(n, 'name') ?? '')
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
export function inspectTbsForm(html: string) {
  const pin = fingerprintTbsForm(html);
  if (
    pin.form !== '8b073db127fd877055232e657ef5c99248bf8fbdbbf730af2f0a5705cec4d962' ||
    pin.scripts !== '936bbbb13690033b64babb9e58533159dc5833ea1519f0f6cfae203dc1463146'
  )
    throw changed();
  return [{ service_code: tbsCategory, service_name: tbsCategory }];
}
export async function loadTbsCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(tbsFormUrl, {
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
    (response.url && new URL(response.url).href !== tbsFormUrl) ||
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
  const categories = inspectTbsForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, tbsSources, retry, now);
  return categories;
}
export function tbsRequirements(): Record<string, Requirements> {
  const field = (
    code: string,
    description: string,
    required: boolean,
    contact: boolean,
    max_length: number,
    format?: Requirements['extra_fields'][number]['format'],
  ) => ({
    code,
    description,
    required,
    contact,
    datatype: 'string',
    max_length,
    ...(format ? { format } : {}),
  });
  return {
    [tbsCategory]: {
      scope: tbsScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      phone_max_length: 50,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['TBS Strom AG – Strassenbeleuchtung Suhr'],
      extra_fields: [
        field('first_name', 'First name', true, true, 100),
        field('last_name', 'Last name', true, true, 100),
        field('reporter_street', 'Reporter street', true, true, 250),
        field('contact_house_number', 'Reporter house number (optional)', false, true, 100),
        field(
          'contact_postcode',
          'Reporter postcode (1000–99999, no leading zeros)',
          true,
          true,
          5,
          'postcode_1000_99999',
        ),
        field('contact_locality', 'Reporter locality', true, true, 100),
        {
          code: 'contact_method',
          description: 'Preferred contact method',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['viaE-Mail', 'viaTelefon'],
        },
        field('lighting_street', 'Actual defective lamp street', true, false, 250),
        field(
          'lighting_house_number',
          'Nearby house number of the lamp (optional)',
          false,
          false,
          100,
        ),
        field(
          'lighting_postcode',
          'Actual lamp postcode (1000–99999, no leading zeros)',
          true,
          false,
          5,
          'postcode_1000_99999',
        ),
        field('lighting_locality', 'Actual lamp locality within Suhr', true, false, 100),
        field('fault_date', 'Actual fault date (YYYY-MM-DD)', true, false, 10, 'past_iso_date'),
        field('fault_time', 'Actual fault time (HH:mm)', true, false, 5, 'local_time'),
        {
          code: 'priority',
          description: 'Nonurgent priority',
          required: true,
          datatype: 'string',
          values: ['Niedrig', 'Mittel'],
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm this actual public lamp in Suhr is maintained by TBS',
          required: true,
          datatype: 'string',
          values: ['Public lamp in Suhr maintained by TBS confirmed'],
        },
      ],
      notes: [
        'Nur nicht dringende Defekte an öffentlichen Strassenlampen in Suhr, die TBS unterhält. Tatsächlichen Standort und Zuständigkeit bestätigen.',
        'Private Vor-/Nachnamen, Kontaktadresse, E-Mail, Telefon und Kontaktweg sind von Strasse/PLZ/Ort der defekten Lampe getrennt. Beide Hausnummern sind freiwillig. Kontaktdaten bleiben ausserhalb der KI.',
        'Tatsächliches Datum und Uhrzeit angeben, nie schätzen oder automatisch ersetzen. Civic beschränkt das Datum auf heute oder früher, PLZ auf 1000–99999 ohne führende Null, Priorität auf Niedrig/Mittel und fordert eine nützliche Beschreibung; Textlimits sind lokale Vorgaben.',
        'Keine Fotoanhänge. Die Anbieterinformation beschreibt Speicherung für Anfrage/Rückfragen und E-Mail-Übertragung; allgemeine Empfänger- und Auslandsregeln gelten. Keine feste Aufbewahrungsdauer für Störungsmeldungen festgestellt.',
        'Nur lokale Vorbereitung. Keine Interaktionssimulation, Formularbefüllung, Übermittlung, externe Erledigung oder Statusabfrage. Bei unklarem Ausgang niemals erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
