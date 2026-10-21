import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const erstfeldFormUrl =
  'https://www.gemeindewerke-erstfeld.ch/kundencenter/online-schalter/defekte-strassenlampe/';
export const erstfeldMandateUrl =
  'https://www.gemeindewerke-erstfeld.ch/dienstleistungen/weitere-dienstleistungen/oeffentliche-beleuchtung/';
export const erstfeldCategory = 'Defekte Strassenlampe';
export const erstfeldScope =
  'Non-emergency faults or damage to public streetlamps in Erstfeld (BFS1206), operated and maintained by Gemeindewerke Erstfeld. Not private lights, electricity outages, other municipal defects or emergencies. A municipal boundary and resident confirmation do not independently prove responsibility for an individual asset.';
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () => new Error('The Erstfeld lighting form has changed. Preparation is paused.');

/** Pin the complete selected Avia form, including its labels, validation classes and empty honeypot.
 * No provider scripts or form actions are executed; unrelated page forms are outside this contract. */
export function inspectErstfeldForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        n.attrs.some((a) => a.name === 'data-avia-form-id' && a.value === '1'),
    );
    if (forms.length !== 1) throw changed();
    const semantic = all(forms[0])
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      'da3a7231aec3fa8fb694c333c8177a752b5f9def55a3035608e70e32157ffee4'
    )
      throw changed();
    return [{ service_code: erstfeldCategory, service_name: erstfeldCategory }];
  } catch {
    throw changed();
  }
}

export function erstfeldRequirements(): Record<string, Requirements> {
  return {
    [erstfeldCategory]: {
      scope: erstfeldScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Erstfeld'],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
          ['contact_street', 'Your postal street address'],
          ['contact_postcode_locality', 'Your postcode and locality'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          datatype: 'string' as const,
          contact: true,
          max_length: 250,
        })),
        {
          code: 'lighting_location',
          description: 'Actual street and nearby house number of the defective lamp',
          required: true,
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
          code: 'public_lamp_confirmed',
          description:
            'Confirm a public streetlamp in Erstfeld; exclude private lamps and emergencies',
          required: true,
          datatype: 'string',
          values: ['Public streetlamp confirmed'],
        },
      ],
      notes: [
        'Nur nicht dringende Störungen oder Schäden an öffentlichen Strassenlampen in Erstfeld. Gemeindewerke Erstfeld betreibt und unterhält diese Beleuchtung.',
        'Vorname, Nachname, eigene Kontaktadresse mit PLZ/Ort, Telefon und E-Mail sind erforderlich. Die Kontaktadresse ist nicht der Standort der Lampe.',
        'Tatsächliche Lampennummer wenn bekannt, niemals erfinden. Civic verlangt zusätzlich einen bestätigten Standort, die Strasse mit nächster Hausnummer und eine Beschreibung. Die Zeichenlimits sind Civic-Vorbereitungsgrenzen, keine veröffentlichten Anbieterlimits.',
        'Reine Textmeldung: Quellfotos können beim Entwurf helfen, müssen aber ausdrücklich von der Übermittlung ausgeschlossen werden.',
        'Nur Vorbereitung in Civic. Senden, externe Formularfertigstellung und Statusabfrage sind nicht verifiziert und bleiben gesperrt. Bei unklarem Ausgang niemals automatisch erneut senden.',
      ],
    },
  };
}
