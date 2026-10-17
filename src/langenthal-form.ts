import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const langenthalFormUrl = 'https://ib-langenthal.ch/services/stoerungsmeldung/';
export const langenthalScope =
  'Non-emergency defective lights on public roads and squares in Langenthal. The city explicitly refers these reports to IBL. Excludes private roads without public right of way, private lights, electricity outages and other defects.';
export const langenthalCategories = [
  ['lampe-brennt-nicht', 'Lampe brennt nicht'],
  ['lampe-brennt-unregelmaessig', 'Lampe brennt unregelmässig'],
  ['leuchte-zerstoert', 'Leuchte zerstört'],
  ['masttuerchen-fehlt', 'Masttürchen fehlt'],
  ['anderer-defekt', 'Anderer Defekt'],
] as const;
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const text = (n: Node): string =>
  'value' in n ? n.value : 'childNodes' in n ? n.childNodes.map(text).join('') : '';
const changed = () => new Error('The Langenthal lighting form has changed. Preparation is paused.');
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : v !== null && typeof v === 'object'
      ? '{' +
        Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => JSON.stringify(k) + ':' + canonical(x))
          .join(',') +
        '}'
      : JSON.stringify(v);
/** Read JSON literals only; never execute the Ninja Forms script or submit its actions. */
export function inspectLangenthalForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const scripts = all(parse(html))
      .filter((n) => 'tagName' in n && n.tagName === 'script')
      .map(text)
      .filter((s) => /form\.id=['"]15['"]/.test(s));
    if (scripts.length !== 1 || [...scripts[0].matchAll(/form\.id=['"]15['"]/g)].length !== 1)
      throw changed();
    const match = scripts[0].match(
      /form\.id='15';form\.settings=(.*?);form\.fields=(.*?);nfForms\.push\(form\);/s,
    );
    if (!match) throw changed();
    const schema = { settings: JSON.parse(match[1]), fields: JSON.parse(match[2]) };
    if (
      createHash('sha256').update(canonical(schema)).digest('hex') !==
      'eac87b620592ae1987b3c26c93fd5260ac012afc25ff9d6a67c29f7e11aa7b51'
    )
      throw changed();
    return langenthalCategories.map(([service_code, service_name]) => ({
      service_code,
      service_name,
    }));
  } catch {
    throw changed();
  }
}
export function langenthalRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    langenthalCategories.map(([code]) => [
      code,
      {
        scope: langenthalScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Langenthal'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['contact_street', 'Your street and house number'],
            ['contact_postcode', 'Your postcode'],
            ['contact_locality', 'Your locality'],
            ['lighting_street', 'Affected street and house number'],
            ['lighting_postcode', 'Affected location postcode'],
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
            description: 'Actual pole number if known; never invent one',
            required: false,
            datatype: 'number',
            max_length: 100,
          },
        ],
        notes: [
          'Nur defekte Leuchten auf öffentlichen Strassen und Plätzen in Langenthal; keine Privatstrassen ohne öffentliches Wegrecht.',
          'Meldeadresse und persönliche Kontaktadresse getrennt angeben. Vorname, Nachname, Telefon, E-Mail und Kontaktadresse sind erforderlich.',
          'Reine Textmeldung. Quellfotos dürfen beim Entwurf helfen, werden aber nicht übermittelt.',
          'Vorbereitung bleibt in Civic. Senden und Statusabfrage bleiben bis zur Prüfung von Annahme und Empfang gesperrt.',
        ],
      } satisfies Requirements,
    ]),
  );
}
