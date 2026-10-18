import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const ckwFormUrl =
  'https://www.ckw.ch/kontakt/stoerungen/stoerung-melden/defekte-strassenlampe-melden';
export const ckwComponentUrl =
  'https://www.ckw.ch/_Resources/Static/Packages/Internezzo.IncidentReport/App/static/js/main.js?bust=c3a88c6e';
export const ckwCategories = [
  'Strassenlampe flackert/pumpt',
  'Strassenlampe brennt nicht mehr',
] as const;
export const ckwMunicipalities = {
  dagmersellen: {
    name: 'Dagmersellen',
    bfsId: 1125,
    referralUrl: 'https://dagmersellen.ch/wirtschaft/versorgung/',
  },
  sursee: {
    name: 'Sursee',
    bfsId: 1103,
    referralUrl: 'https://www.sursee.ch/strom/25442',
  },
  schenkon: {
    name: 'Schenkon',
    bfsId: 1099,
    referralUrl:
      'https://www.schenkon.ch/gemeinde/verwaltung/dienstleistungen-nuetzliche-links.html/41/service/455',
  },
  ruswil: {
    name: 'Ruswil',
    bfsId: 1098,
    referralUrl: 'https://ruswil.ch/institutionsweiterleitungen/abteilung-bau-infrastruktur/',
  },
  oberkirch: {
    name: 'Oberkirch',
    bfsId: 1095,
    referralUrl: 'https://www.oberkirch.ch/online-schalter/84767/detail',
  },
  knutwil: { name: 'Knutwil', bfsId: 1089, referralUrl: 'https://www.knutwil.ch/strom' },
  eich: {
    name: 'Eich',
    bfsId: 1084,
    referralUrl: 'https://www.eich.ch/freizeit-wirtschaft/umwelt-und-energie/versorgung/',
  },
  bueron: {
    name: 'Büron',
    bfsId: 1082,
    referralUrl: 'https://www.bueron.ch/index.php?apid=11679111',
  },
  werthenstein: {
    name: 'Werthenstein',
    bfsId: 1009,
    referralUrl: 'https://werthenstein.ch/wirtschaft-finanzen/infrastruktur/werkdienst/',
  },
  adligenswil: {
    name: 'Adligenswil',
    bfsId: 1051,
    referralUrl:
      'https://www.adligenswil.ch/public/upload/assets/5652/2026-04-21%20%C3%9Cbersicht%20Werke%20Partner.pdf?fp=5',
  },
} as const;
export type CkwMunicipality = keyof typeof ckwMunicipalities;
export function isCkwMunicipality(name: string): name is CkwMunicipality {
  return Object.hasOwn(ckwMunicipalities, name);
}
export function ckwScope(name: CkwMunicipality): string {
  return `Non-emergency flickering or unlit individual public streetlamps in ${ckwMunicipalities[name].name}, explicitly referred to CKW by the municipality. Requires the actual lamp number from its plaque. Not private lights, electricity outages, whole-street faults, damaged fixtures or other municipal defects. Municipal boundary and resident confirmation do not independently verify CKW ownership of an individual asset.`;
}
// Retained for consumers of the original Werthenstein-only API.
export const werthensteinLightingScope = ckwScope('werthenstein');
type Node = DefaultTreeAdapterMap['node'];
const all = (node: Node): Node[] => [
  node,
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const changed = () =>
  new Error('The CKW public lighting configuration has changed. Preparation is paused.');

/** Pin the entire selected public configuration and component URLs, not unrelated newsletter/contact overlays.
 * Source reviewed separately; this does not execute or prove deployed component bytes or acceptance. */
export function inspectCkwForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const sections = all(parse(html)).filter(
      (node) =>
        'tagName' in node &&
        node.tagName === 'section' &&
        node.attrs.some(
          (a) => a.name === 'data-nezzo-react-app-root' && a.value === 'incidentreport',
        ),
    );
    if (sections.length !== 1) throw changed();
    const semantic = all(sections[0])
      .map((node) => {
        if ('tagName' in node)
          return [
            node.tagName,
            node.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in node) return node.value.replace(/\s+/g, ' ').trim();
        return undefined;
      })
      .filter((value) => value !== '' && value !== undefined);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      'efdb730ca83d7d2a70cba222d29af563f20da2905fe49bacb8d359ed2bcae3ce'
    )
      throw changed();
    return ckwCategories.map((name) => ({ service_code: name, service_name: name }));
  } catch {
    throw changed();
  }
}

export function ckwRequirements(name: CkwMunicipality): Record<string, Requirements> {
  const municipality = ckwMunicipalities[name].name;
  return Object.fromEntries(
    ckwCategories.map((category) => [
      category,
      {
        scope: ckwScope(name),
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: false,
        contact_fields: [],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: [municipality],
        extra_fields: [
          {
            code: 'lamp_number',
            description:
              'Actual number from the public lamp plaque, for example K1-12; never invent one',
            required: true,
            datatype: 'string',
            max_length: 7,
            format: 'ckw_lamp_number',
          },
          {
            code: 'public_lamp_confirmed',
            description: `Confirm an individual public streetlamp in ${municipality}, referred to CKW; exclude private lamps and emergencies`,
            required: true,
            datatype: 'string',
            values: ['Public streetlamp confirmed'],
          },
        ],
        notes: [
          ...(name === 'sursee'
            ? [
                'Die Stadt ist Eigentümerin; CKW betreibt und unterhält die Beleuchtung. Sonstige Beschädigungen gehören zum Bereich Tiefbau und sind in diesen beiden Vorbereitungsklassen nicht enthalten.',
              ]
            : []),
          ...(name === 'oberkirch'
            ? [
                'Die Gemeinde nennt im Normalfall zwei bis drei Wochen bis zur Reparatur. Dies ist keine Notfallmeldung und keine Zusage für einen bestimmten Termin.',
              ]
            : []),
          `Nur flackernde oder ausgefallene einzelne öffentliche Strassenlampen in ${municipality}. Andere Störungen und ganze Strassenzüge sind in dieser Vorbereitung nicht enthalten.`,
          'Für diese Vorbereitung wird die tatsächliche Nummer auf der Plakette benötigt. CKW erwartet einen Grossbuchstaben, ein bis zwei Ziffern, einen Bindestrich, ein bis zwei Ziffern und optional einen Grossbuchstaben. Keine Nummer erfinden.',
          'Keine Fotoanhänge oder Kontaktangaben für diese beiden Formularzweige. Civic benötigt einen bestätigten Standort und eine Beschreibung; seine Textgrenzen sind keine veröffentlichten CKW-Grenzen.',
          'Der Entwurf bleibt in Civic. Es wird nichts übermittelt. Senden, Fortsetzen im offiziellen Formular und Statusabfragen sind derzeit nicht verfügbar.',
        ],
      } satisfies Requirements,
    ]),
  );
}

export function werthensteinLightingRequirements(): Record<string, Requirements> {
  return ckwRequirements('werthenstein');
}
