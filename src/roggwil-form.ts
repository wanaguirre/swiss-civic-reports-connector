import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const roggwilFormUrl =
  'https://www.gbr-roggwil.ch/e-schalter/stoerungsmeldung-strassenbeleuchtung/';
export const roggwilScope =
  'Non-emergency public street-light defects in Roggwil BE (BFS337), maintained by GBR on the municipality’s behalf. Excludes private lights, electricity outages and other municipal defects.';
export const roggwilCategories = [
  ['Lampe brennt nicht', 'Lampe brennt nicht'],
  ['Lampe brennt unregelmässig', 'Lampe brennt unregelmässig'],
  ['Leuchte zerstört', 'Leuchte zerstört'],
  ['Anderer Defekt', 'Anderer Defekt'],
] as const;
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () => new Error('The Roggwil lighting form has changed. Preparation is paused.');
/** Inspect the whole selected form without executing scripts or retaining session tokens. */
export function inspectRoggwilForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        n.attrs.some((a) => a.name === 'id' && a.value === 'formular'),
    );
    if (forms.length !== 1) throw changed();
    const semantic = all(forms[0])
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n.tagName === 'input' &&
                n.attrs.some((x) => x.name === 'id' && x.value === 'yform-formular-_csrf_token') &&
                a.name === 'value'
                  ? '<session-token>'
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
      'd442551bc46f1d54c97d610f61c9617092579944fc70d8df56218adfd30d576c'
    )
      throw changed();
    return roggwilCategories.map(([service_code, service_name]) => ({
      service_code,
      service_name,
    }));
  } catch {
    throw changed();
  }
}
export function roggwilRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    roggwilCategories.map(([code]) => [
      code,
      {
        scope: roggwilScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: false,
        contact_fields: [],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Roggwil (BE)'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['contact_street', 'Your street and house number'],
            ['contact_postcode', 'Your postcode'],
            ['contact_locality', 'Your locality'],
            ['lighting_street', 'Affected street and house number'],

            ['lighting_locality', 'Affected location locality'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            datatype: 'string' as const,
            contact: code.startsWith('contact_') || code === 'first_name' || code === 'last_name',
            max_length: 250,
          })),
          {
            code: 'lamp_number',
            description:
              'Actual lamp number from the affected streetlight; required, never invent one',
            required: true,
            datatype: 'string',
            max_length: 100,
          },
        ],
        notes: [
          'Nur nicht dringende Defekte an der öffentlichen Strassenbeleuchtung in Roggwil BE; keine privaten Leuchten oder Stromausfälle.',
          'Tatsächliche Lampennummer erforderlich. Kontaktadresse und Standort der Lampe getrennt angeben. Vorname, Nachname, E-Mail und Kontaktadresse erforderlich; Telefon optional.',
          'Bemerkungen erforderlich. Quellfotos helfen nur beim Entwurf und werden nicht übermittelt.',
          'Nur Vorbereitung in Civic. CAPTCHA, Versandannahme und Empfang sind nicht verifiziert; Senden und Statusabfrage bleiben gesperrt.',
        ],
      } satisfies Requirements,
    ]),
  );
}
