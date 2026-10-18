import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const waldstattFormUrl =
  'https://ortskorporation.ch/-1/ortskorporation-waldstatt/strassenbeleuchtung~52/storungsmeldung~68/';
export const waldstattReferralUrl =
  'https://www.waldstatt.ch/politik-verwaltung/verwaltung/wasserversorgung-strassenbeleuchtung.html/334';
export const waldstattMandateUrl =
  'https://ortskorporation.ch/-1/ortskorporation-waldstatt/strassenbeleuchtung~52/allgemeines~53/';
export const waldstattCategory = 'Strassenbeleuchtung';
export const waldstattScope =
  'Non-emergency defects in public streetlighting in Waldstatt, operated by Ortskorporation on municipal mandate: roads in the built-up municipal area and pedestrian crossings on cantonal roads. Not private lights, electricity outages, water emergencies or other municipal defects. Confirm the actual public lamp location.';
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () => new Error('The Waldstatt lighting form has changed. Preparation is paused.');
/** Inspect the selected DynPG form only. Read-time technical values are checked, masked and discarded, never submitted. */
export function inspectWaldstattForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        all(n).some(
          (x) =>
            'tagName' in x &&
            x.attrs.some((a) => a.name === 'name' && a.value === 'F100_Firma-96570089-/required'),
        ),
    );
    if (forms.length !== 1) throw changed();
    const nodes = all(forms[0]);
    for (const [name, pattern] of [
      ['dynpgform', /^[A-F0-9]{32}$/],
      ['from_ts', /^\d{10}$/],
    ] as const) {
      const fields = nodes.filter(
        (n) =>
          'tagName' in n &&
          n.tagName === 'input' &&
          n.attrs.some((a) => a.name === 'name' && a.value === name),
      );
      if (
        fields.length !== 1 ||
        !('attrs' in fields[0]) ||
        !fields[0].attrs.some((a) => a.name === 'type' && a.value === 'hidden') ||
        !pattern.test(fields[0].attrs.find((a) => a.name === 'value')?.value ?? '')
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
                n.tagName === 'input' &&
                a.name === 'value' &&
                n.attrs.some((x) => x.name === 'name' && ['dynpgform', 'from_ts'].includes(x.value))
                  ? '<read-time-technical>'
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
      '84070c94590ac64505eeddf2e75966b7fb39270eec2ac58effc21a78450d81eb'
    )
      throw changed();
    return [{ service_code: waldstattCategory, service_name: waldstattCategory }];
  } catch {
    throw changed();
  }
}
export function waldstattRequirements(): Record<string, Requirements> {
  return {
    [waldstattCategory]: {
      scope: waldstattScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Ortskorporation Waldstatt'],
      extra_fields: [
        {
          code: 'reporter_name',
          description: 'Name (the official source also permits a company)',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'contact_address',
          description: 'Your reporter address, separate from the lamp location',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'form_date',
          description: 'Date requested by the official form; enter it yourself',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'lighting_location',
          description:
            'Actual street and nearby house number or landmark identifying the defective public lamp',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
      ],
      notes: [
        'Nur öffentliche Strassenbeleuchtung im überbauten Gebiet von Waldstatt sowie Fussgängerübergänge bei Staatsstrassen gemäss kommunalem Auftrag. Standort und Zuständigkeit bestätigen.',
        'Name oder Firma, eigene Adresse, Telefon und Datum sind im Quellformular erforderlich. Reporteradresse von der Lampe getrennt halten. Datum selbst eingeben; nicht aus KI oder Koordinaten ableiten. Die Quelle schreibt kein Datumsformat vor.',
        'Civic verlangt eine nützliche Beschreibung und Lampen-Ortsangabe. Keine Lampennummer oder Höhe erfinden.',
        'Kein E-Mail- oder Fotoeingabefeld: Konto-E-Mail bleibt ausgeschlossen, Quellfotos ausdrücklich ausschliessen. Nur Vorbereitung; Senden, externe Erledigung und Statusabfrage nicht verfügbar.',
        'Annahme und Empfang sind nicht verifiziert. Einen unklaren Ausgang niemals automatisch wiederholen, neu erstellen oder auf einem anderen Kanal senden.',
      ],
    },
  };
}
