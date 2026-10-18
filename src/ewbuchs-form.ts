import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const ewbuchsFormUrl = 'https://ewbuchs.ch/stoerungsmeldung-oeffentliche-beleuchtung';
export const ewbuchsOrganisationUrl =
  'https://buchs-sg.ch/wp-content/uploads/2025/07/Organisationsreglement_fuer_das_Elektrizitaets-_und_Wasserwerk_der_Stadt_Buchs.pdf';
export const ewbuchsPrivacyUrl = 'https://ewbuchs.ch/datenschutz';
export const ewbuchsScope =
  'Non-emergency municipal public streetlight faults in Buchs SG handled by the city unit EWB. Confirm the actual public lamp and municipal/EWB responsibility. Private lights, electricity outages, other municipalities and other municipal defects are excluded. This is not an independent lamp ownership check.';
export const ewbuchsCategories = [
  'Lampe leuchtet nicht',
  'Lampe leuchtet unregelmässig',
  'Kanderlaber beschädigt',
].map((label) => ({ service_code: label, service_name: label }));
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changed = () => new Error('The EWB Buchs lighting form has changed. Preparation is paused.');
const scripts = [
  '0ykyzfd0mwwu3',
  '34a_82-klmzvs',
  '1j_thxysdlwtc',
  'turbopack-1cvbnb3nlabgn',
  '2sq7xr4muqhuf',
  '2xc4yur3evast',
  '2sx_57ln8jnx_',
  '3ub9bde2g6gwo',
  '3s3_8rue27jsd',
  '0c0hxoamwjsbw',
  '34bwmeolpwmql',
].map((s) => `/_next/static/immutable/chunks/${s}.js`);
/** Read a JSON object literal, respecting quoted braces; never evaluate provider code. */
function objectAt(text: string, start: number): unknown {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw changed();
}
/** Pin the complete selected HTML, published literal form configuration and immutable client references. No JavaScript, server action or success handler is executed. */
export function inspectEwbuchsForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|turnstile|challenge/i.test(html))
      throw changed();
    const doc = all(parse(html));
    const forms = doc.filter(
      (n): n is Element =>
        'tagName' in n &&
        n.tagName === 'form' &&
        all(n).some(
          (x) =>
            'tagName' in x &&
            attr(x, 'name') === 'FORM_ID' &&
            attr(x, 'value') === 'KU2YR_V9RlGKZbYrQ50sLA',
        ),
    );
    if (forms.length !== 1) throw changed();
    const semantic = all(forms[0])
      .map((n) =>
        'tagName' in n
          ? [
              n.tagName,
              n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
            ]
          : 'value' in n
            ? n.value.replace(/\s+/g, ' ').trim()
            : null,
      )
      .filter((x) => x !== '' && x !== null);
    if (digest(semantic) !== 'ae92e761ce8ff46b1bd95ad06d10659adaeec83555e930a0924063ed3523c640')
      throw changed();
    const scriptNodes = doc.filter((n): n is Element => 'tagName' in n && n.tagName === 'script');
    if (
      JSON.stringify(scriptNodes.filter((n) => attr(n, 'src')).map((n) => attr(n, 'src'))) !==
      JSON.stringify(scripts)
    )
      throw changed();
    let flight = '';
    for (const n of scriptNodes) {
      const text = all(n)
        .filter((x): x is DefaultTreeAdapterMap['textNode'] => 'value' in x)
        .map((x) => x.value)
        .join('');
      const match = text.trim().match(/^self\.__next_f\.push\(([\s\S]*)\);?$/);
      if (!match) {
        // Only the reviewed React bootstrap snippets may accompany literal data.
        const hash = createHash('sha256').update(text.trim()).digest('hex');
        if (
          text.trim() &&
          ![
            '0b01e988e6c67342a3eaab511735151aa9346a9c260abca525a414f916a3b89d',
            'e3b4ce48f4a9f72e0b9fbccfd5f8f8cac14fc6b32ab2a804f51d4599b1cebf41',
            '3814cddd18b2095e01abb745a99e5ada90178e709c09879324c3b623f2d829ea',
          ].includes(hash)
        )
          throw changed();
        continue;
      }
      const data: unknown = JSON.parse(match[1]);
      if (Array.isArray(data) && data[0] === 1 && typeof data[1] === 'string') flight += data[1];
    }
    if (!flight.includes('28:I[86650,["$4","$18","$19","$1a"],"Form"]')) throw changed();
    const configs: unknown[] = [];
    for (const match of flight.matchAll(/"form":\s*(\{)/g))
      configs.push(objectAt(flight, match.index! + match[0].length - 1));
    if (
      configs.length !== 1 ||
      digest(configs[0]) !== '499c99f9ec4c367780e1eaf6161e19bdd49a532b6229474aa72fbbe877e03dee'
    )
      throw changed();
    return ewbuchsCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function ewbuchsRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    ewbuchsCategories.map((c) => [
      c.service_code,
      {
        scope: ewbuchsScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Buchs (SG)'],
        extra_fields: [
          {
            code: 'first_name',
            description: 'First name',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'last_name',
            description: 'Surname',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'contact_address',
            description: 'Your postal street and number; not the lamp location',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'contact_postcode_locality',
            description: 'Your postal postcode and locality; not the lamp location',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'salutation',
            description:
              'Your chosen salutation (optional); never infer it from the source default',
            required: false,
            contact: true,
            datatype: 'string',
            values: ['Frau', 'Herr', 'Divers'],
          },
          {
            code: 'company',
            description: 'Your company (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_street',
            description: 'Street of the defective public lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_house_number',
            description: 'Nearby house number (optional)',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm an actual municipal public lamp in Buchs SG handled by EWB; exclude private lamps and outages',
            required: true,
            datatype: 'string',
            values: ['Municipal public lamp in Buchs SG confirmed'],
          },
        ],
        notes: [
          'Nur öffentliche Lampen in Buchs SG in kommunaler/EWB-Zuständigkeit; genaue Lage und Zuständigkeit selbst bestätigen. Keine unabhängige Eigentumsprüfung.',
          'Name, Vorname, eigene Postadresse, PLZ/Ort, Telefon und Lampenstrasse sind erforderlich. E-Mail, Anrede, Firma und nahe Hausnummer sind freiwillig. Keine Anrede oder Adresse aus Quellplatzhaltern übernehmen.',
          'Beschreiben Sie den sichtbaren Defekt und den tatsächlichen Lampenstandort. Bestätigen Sie eine öffentliche Lampe in kommunaler/EWB-Zuständigkeit.',
          'Vorbereitung ohne Fotoanhänge: Quellfotos ausdrücklich aus dem Bericht ausschliessen.',
          'Senden, externe Erledigung und Status bleiben nicht verfügbar. Bei unklarem Sendeausgang nie automatisch erneut melden oder einen anderen Sendekanal verwenden.',
        ],
      },
    ]),
  );
}
