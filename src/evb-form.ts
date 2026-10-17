import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const evbFormUrl = 'https://www.ev-bueren.ch/online-schalter/';
export const evbScope =
  'Non-emergency public street-light defects in Büren an der Aare (BFS383), reported to EVB through its explicitly published lighting service. Excludes private lights, electricity outages and other municipal defects.';
export const evbCategories = [
  ['Lampe brennt nicht', 'Lampe brennt nicht'],
  ['Lampe brennt unregelmässig', 'Lampe brennt unregelmässig'],
  ['Lampe zerstört', 'Lampe zerstört'],
  ['anderer Grund', 'anderer Grund'],
] as const;
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () => new Error('The EVB Büren lighting form has changed. Preparation is paused.');
/** Inspect the whole selected form without executing scripts or retaining session tokens. */
export function inspectEvbForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        n.attrs.some((a) => a.name === 'id' && a.value === 'lbwpForm-2266-2'),
    );
    if (forms.length !== 1) throw changed();
    const technical = all(forms[0])
      .filter((n) => 'tagName' in n && n.tagName === 'input')
      .flatMap((n) =>
        'attrs' in n ? n.attrs.filter((a) => a.name === 'name').map((a) => a.value) : [],
      );
    const second = technical.filter((n) => /^second_nonce_[0-9a-f]{32}$/.test(n));
    const receipt = technical.filter((n) => /^to_recept_[0-9a-f]{32}$/.test(n));
    if (second.length !== 1 || receipt.length !== 1 || second[0].slice(13) !== receipt[0].slice(10))
      throw changed();
    const semantic = all(forms[0])
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n.tagName === 'input' &&
                a.name === 'name' &&
                /^(second_nonce|to_recept)_[0-9a-f]{32}$/.test(a.value)
                  ? a.value.replace(/[0-9a-f]{32}$/, '<opaque-suffix>')
                  : n.tagName === 'input' &&
                      a.name === 'value' &&
                      n.attrs.some(
                        (x) =>
                          x.name === 'name' &&
                          (['form-token', 'form-nonce'].includes(x.value) ||
                            /^second_nonce_[0-9a-f]{32}$/.test(x.value)),
                      )
                    ? '<opaque-token>'
                    : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in n) return n.value.replace(/\s+/g, ' ').trim();
        return null;
      })
      .filter((x) => x !== '' && x !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      '30a044b1556f7c1c76e5723d6d14465654aed30832ebcd81f00c2b9cfab0764b'
    )
      throw changed();
    return evbCategories.map(([service_code, service_name]) => ({
      service_code,
      service_name,
    }));
  } catch {
    throw changed();
  }
}

export function evbRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    evbCategories.map(([code]) => [
      code,
      {
        scope: evbScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Büren an der Aare'],
        extra_fields: [
          {
            code: 'first_name',
            description: 'First name',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'last_name',
            description: 'Last name (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp number if known; never invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lighting_location',
            description: 'Affected street, house number and locality',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'salutation',
            description: 'Salutation required by EVB',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['Frau', 'Herr'],
          },
          {
            code: 'privacy_consent',
            description: 'I have read and accept https://www.ev-bueren.ch/datenschutz/',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['Ja'],
          },
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm a public streetlamp in Büren; exclude private lights, outages and emergencies.',
            required: true,
            datatype: 'string',
            values: ['Public streetlamp confirmed'],
          },
        ],
        notes: [
          'Vorname, Telefon, Anrede, Leuchtenstandort und ausdrückliche Datenschutz-Zustimmung erforderlich. Nachname, E-Mail und tatsächliche Lampennummer optional.',
          'Nur öffentliche Strassenlampen in Büren; keine privaten Leuchten, Stromausfälle oder Notfälle. Die Bestätigung ist keine unabhängige Eigentumsprüfung.',
          'Keine Fotofelder: Quellfotos ausdrücklich ausschliessen. Technische Felder werden nicht als Einwohnerangaben abgefragt.',
          'Vorbereitung ohne Skriptausführung, Nonce-Anfrage, Validierung, POST oder Tracking. Zustellung und Annahme bleiben ungeprüft.',
        ],
      } satisfies Requirements,
    ]),
  );
}
