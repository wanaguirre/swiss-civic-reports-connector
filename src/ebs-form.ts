import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const ebsFormUrl = 'https://www.ebs.swiss/privatkunden/service/kundendienst/strassenlampen/';
export const ebsMandateUrl =
  'https://www.ebs.swiss/geschaeftskunden/energie/netz/oeffentliche-beleuchtung/';
export const ebsCategory = 'Defekte Strassenlampe';
// Other choices on the provider form require independent municipal assessment.
export const ebsMunicipalities = {
  sattel: {
    name: 'Sattel',
    bfsId: 1371,
    referralUrl: 'https://www.sattel.ch/online-schalter/74653/detail',
  },
  schwyz: {
    name: 'Schwyz',
    bfsId: 1372,
    referralUrl: 'https://www.gemeindeschwyz.ch/dienstleistungen/60689',
  },
} as const;
export type EbsMunicipality = keyof typeof ebsMunicipalities;
export function isEbsMunicipality(name: string): name is EbsMunicipality {
  return Object.hasOwn(ebsMunicipalities, name);
}
export function ebsScope(name: EbsMunicipality) {
  return `Non-emergency defects of public streetlamps in ${ebsMunicipalities[name].name}, explicitly referred by the municipality to ebs Energie AG. Not private lights, electricity outages, other municipal defects or emergencies. Municipal boundary and resident confirmation do not independently verify responsibility for an individual asset.`;
}
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () => new Error('The ebs lighting form has changed. Preparation is paused.');

/** Pin the selected CF7 form, labels, validation, all municipality choices and protection.
 * Only the four generated honeypot IDs are normalized, after checking their label/input pairs.
 * No scripts, form action, validation or provider submission are executed. */
export function inspectEbsForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        n.attrs.some((a) => a.name === 'action' && a.value.endsWith('#wpcf7-f1628-o1')),
    );
    if (forms.length !== 1) throw changed();
    const nodes = all(forms[0]);
    const generated = new Map<string, string>();
    for (const name of ['street', 'city', 'postalcode', 'website']) {
      const inputs = nodes.filter(
        (n) =>
          'tagName' in n &&
          n.tagName === 'input' &&
          n.attrs.some((a) => a.name === 'name' && a.value === name),
      );
      if (inputs.length !== 1 || !('attrs' in inputs[0])) throw changed();
      const id = inputs[0].attrs.find((a) => a.name === 'id')?.value;
      if (!id || !/^wpcf7-[a-f0-9]{13}-field$/.test(id)) throw changed();
      const labels = nodes.filter(
        (n) =>
          'tagName' in n &&
          n.tagName === 'label' &&
          n.attrs.some((a) => a.name === 'for' && a.value === id),
      );
      if (labels.length !== 1 || generated.has(id)) throw changed();
      generated.set(id, `honeypot-${name}-field`);
      generated.set(id.replace(/-field$/, '-wrapper'), `honeypot-${name}-wrapper`);
    }
    const semantic = nodes
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                ['id', 'for'].includes(a.name) ? (generated.get(a.value) ?? a.value) : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      '2de340366f1505073f093336e3c148a46376a0ecfe4ee465624d2d76558a9e3a'
    )
      throw changed();
    return [{ service_code: ebsCategory, service_name: ebsCategory }];
  } catch {
    throw changed();
  }
}

export function ebsRequirements(name: EbsMunicipality): Record<string, Requirements> {
  return {
    [ebsCategory]: {
      scope: ebsScope(name),
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 2000,
      location_label_max_length: 250,
      bodies: [ebsMunicipalities[name].name],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          datatype: 'string' as const,
          contact: true,
          max_length: 400,
        })),
        {
          code: 'lighting_street',
          description: 'Actual street of the defective public lamp',
          required: true,
          datatype: 'string',
          max_length: 400,
        },
        {
          code: 'nearby_house_number',
          description: 'Actual nearest house number; never invent one',
          required: true,
          datatype: 'string',
          max_length: 400,
        },
        {
          code: 'lamp_number',
          description: 'Actual lamp number if known; never invent one',
          required: false,
          datatype: 'string',
          max_length: 400,
        },
        {
          code: 'additional_remarks',
          description: 'Your additional remarks (required; Civic preparation limit 500 characters)',
          required: true,
          datatype: 'string',
          max_length: 500,
        },
        {
          code: 'public_lamp_confirmed',
          description: `Confirm a public streetlamp in ${ebsMunicipalities[name].name}; exclude private lights and emergencies`,
          required: true,
          datatype: 'string',
          values: ['Public streetlamp confirmed'],
        },
      ],
      notes: [
        `Nur nicht dringende Defekte an öffentlichen Strassenlampen in ${ebsMunicipalities[name].name}. Die Gemeinde verweist ausdrücklich an ebs Energie AG.`,
        'Vorname, Nachname, E-Mail und Telefon sind erforderlich. Strasse und nächste Hausnummer betreffen den Lampenstandort; die tatsächliche Kandelabernummer ist optional und darf nicht erfunden werden.',
        'Art des Defekts und Bemerkungen sind laut Formularvalidierung erforderlich, auch wenn bei Bemerkungen der Hinweis im sichtbaren Label fehlt. Beschreibung maximal 2000 Zeichen; einzelne Textfelder maximal 400 laut Markup. Bemerkungen im Anbieterformular maximal 2000, in Civic auf 500 Zeichen begrenzt. Civic verlangt zusätzlich Standortbestätigung und eine öffentliche Lampe; Standortlabel maximal 250 ist eine Civic-Vorbereitungsgrenze.',
        'Keine Fotos: Quellfotos können beim Entwurf helfen, müssen aber ausdrücklich von der Übermittlung ausgeschlossen werden.',
        'Nur Vorbereitung. Senden, externe Fertigstellung und Statusabfrage sind unbestätigt und gesperrt. Ein unklarer Ausgang bleibt unbestätigt; niemals automatisch erneut senden.',
      ],
    },
  };
}
