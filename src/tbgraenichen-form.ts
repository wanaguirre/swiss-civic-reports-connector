import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

export const tbgraenichenFormUrl = 'https://www.tbgraenichen.ch/defekte-strassenbeleuchtung';
export const tbgraenichenPrivacyUrl = 'https://www.tbgraenichen.ch/datenschutz';
export const tbgraenichenScope =
  'Non-emergency defects of actual public streetlights maintained by TB Gränichen within Gränichen (BFS4006). Confirm the actual maintained public lamp and point; municipal boundaries do not prove ownership. Private fixtures, supply outages, urgent hazards, other assets and neighbouring municipalities are excluded.';
export const tbgraenichenCategories = [
  { service_code: 'Defekte Strassenbeleuchtung', service_name: 'Defekte Strassenbeleuchtung' },
];
export const tbgraenichenCmsSource: PublicSourcePin = Object.freeze({
  url: 'https://www.tbgraenichen.ch/pages/js/cms.js',
  sha256: '7c85a12e4c6de92dc16e01c2d89a08415bda919810bddefb429d5cd518115b0b',
  type: 'javascript',
  maxBytes: 20_000,
});
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const element = (n: Node): n is Element => 'tagName' in n;
const attr = (n: Element, name: string) => n.attrs.find((a) => a.name === name)?.value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changed = () =>
  new Error('The TB Gränichen lighting form has changed. Preparation is paused.');

/** Factual fingerprints only. Discard shaped read-time values, never reuse state,
 * fill the trap, execute reCAPTCHA or copy/execute the provider's client code. */
export function fingerprintTbgraenichenForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element => element(n) && n.tagName === 'form' && attr(n, 'id') === 'frmGenerator18',
    );
    if (forms.length !== 1 || nodes.some((n) => element(n) && attr(n, 'form') !== undefined))
      throw changed();
    const selected = all(forms[0]);
    if (selected.some((n) => element(n) && ['template', 'iframe'].includes(n.tagName)))
      throw changed();
    const state = ['csrfToken', 'frsId'].map((name) => {
      const matches = selected.filter((n): n is Element => element(n) && attr(n, 'name') === name);
      if (
        matches.length !== 1 ||
        matches[0].tagName !== 'input' ||
        attr(matches[0], 'type') !== 'hidden' ||
        !(name === 'csrfToken' ? /^[a-z0-9]{40}$/ : /^[0-9]{1,12}$/).test(
          attr(matches[0], 'value') ?? '',
        )
      )
        throw changed();
      return matches[0];
    });
    const form = selected
      .map((n) => {
        if (element(n))
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                state.includes(n) && a.name === 'value'
                  ? `<read-time-${attr(n, 'name')}>`
                  : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    const scripts = nodes
      .filter((n): n is Element => element(n) && n.tagName === 'script')
      .map((n) => [
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim(),
      ]);
    return { form: digest(form), scripts: digest(scripts) };
  } catch {
    throw changed();
  }
}
export function inspectTbgraenichenForm(html: string) {
  const pin = fingerprintTbgraenichenForm(html);
  if (
    pin.form !== 'd7c31d1c457791207ecbbba465ea4f9c639d274b8c39db717d506471d60f9a3b' ||
    pin.scripts !== '24ae00dc86d223193d43aebe2dd09e44ab083345403ef5cb0b2b5bee48f9c068'
  )
    throw changed();
  return tbgraenichenCategories.map((c) => ({ ...c }));
}
export async function loadTbgraenichenCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const response = await request(tbgraenichenFormUrl, {
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
    (response.url && new URL(response.url).href !== tbgraenichenFormUrl) ||
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
  const categories = inspectTbgraenichenForm(Buffer.concat(chunks).toString('utf8'));
  await verifyPublicSourceManifest(request, [tbgraenichenCmsSource], retry, now);
  return categories;
}
export function tbgraenichenRequirements(): Record<string, Requirements> {
  return {
    [tbgraenichenCategories[0].service_code]: {
      scope: tbgraenichenScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      phone_max_length: 50,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['TB Gränichen Energie AG – Strassenbeleuchtung'],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Surname'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 100,
        })),
        {
          code: 'lighting_street',
          description: 'Actual defective lamp street and number',
          required: true,
          datatype: 'string',
          max_length: 255,
        },
        {
          code: 'lamp_number',
          description: 'Actual lamp number if known; preserve leading zeros and never invent one',
          required: false,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm this actual public lamp in Gränichen is maintained by TB Gränichen',
          required: true,
          datatype: 'string',
          values: ['Public lamp in Gränichen maintained by TB Gränichen confirmed'],
        },
      ],
      notes: [
        'Nur nicht dringende Defekte an öffentlichen Strassenlampen in Gränichen, die TB Gränichen unterhält. Tatsächlichen Standort und Zuständigkeit bestätigen.',
        'Strasse/Nr., Vorname, Nachname, Telefon und E-Mail sind im Quellformular erforderlich. Lampennummer und Bemerkungen sind freiwillig. Civic verlangt eine nützliche Beschreibung; Längenbegrenzungen sind lokale Vorgaben.',
        'Kontaktdaten bleiben privat und ausserhalb der KI. Keine Fotoanhänge. Die verlinkte Datenschutzseite enthält im gelesenen Inhalt keine auswertbaren Aufbewahrungs- oder Weitergaberegeln.',
        'Nur lokale Vorbereitung. Keine reCAPTCHA-Ausführung, Übermittlung, Formularbefüllung, externe Erledigung oder Statusabfrage. Bei unklarem Ausgang niemals erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
