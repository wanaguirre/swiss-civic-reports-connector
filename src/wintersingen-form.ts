import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const wintersingenFormUrl =
  'https://www.wintersingen.ch/form/stoerungsmeldung-strassenbeleuch';
export const wintersingenReferralUrl = 'https://www.wintersingen.ch/online-schalter?page=1';
export const wintersingenScope =
  'Non-emergency municipal streetlight faults within Wintersingen (BFS2866). Not private lights, power outages or other municipal issues. Confirm the actual public lamp location separately from the reporter postal address; the source labels the reporter street as in Wintersingen.';
// Preparation choices use the published labels. No municipal payload/identifier is fabricated.
export const wintersingenCategories = [
  { service_code: 'Lampe brennt nicht', service_name: 'Lampe brennt nicht' },
  { service_code: 'Lampe brennt unregelmässig', service_name: 'Lampe brennt unregelmässig' },
  { service_code: 'Leuchte zerstört', service_name: 'Leuchte zerstört' },
  { service_code: 'Anderer Defekt', service_name: 'Anderer Defekt' },
] as const;
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () =>
  new Error('The Wintersingen lighting form has changed. Preparation is paused.');
/** Pin the selected form; only build identity and opaque time token rotate. Never emulate or submit them. */
export function inspectWintersingenForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        n.attrs.some(
          (a) =>
            a.name === 'id' &&
            a.value === 'webform-submission-stoerungsmeldung-strassenbeleuch-add-form',
        ),
    );
    if (forms.length !== 1) throw changed();
    const form = forms[0];
    const inputs = all(form).filter((n) => 'tagName' in n && n.tagName === 'input');
    for (const name of ['form_build_id', 'honeypot_time']) {
      const fields = inputs.filter(
        (n) => 'attrs' in n && n.attrs.some((a) => a.name === 'name' && a.value === name),
      );
      if (fields.length !== 1 || !('attrs' in fields[0])) throw changed();
      const value = fields[0].attrs.find((a) => a.name === 'value')?.value ?? '';
      if (!(name === 'form_build_id' ? /^form-[\w-]{10,200}$/ : /^[A-Za-z0-9_-]{43}$/).test(value))
        throw changed();
      if (
        name === 'form_build_id' &&
        !/^form-[\w-]{10,200}$/.test(
          fields[0].attrs.find((a) => a.name === 'data-drupal-selector')?.value ?? '',
        )
      )
        throw changed();
    }
    const semantic = all(form)
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n.tagName === 'input' &&
                n.attrs.some((x) => x.name === 'name' && x.value === 'form_build_id') &&
                ['value', 'data-drupal-selector'].includes(a.name)
                  ? '<dynamic-build>'
                  : n.tagName === 'input' &&
                      n.attrs.some((x) => x.name === 'name' && x.value === 'honeypot_time') &&
                      a.name === 'value'
                    ? '<dynamic-time>'
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
      'd918ef5403fb038333e2a746948157468e7a59e16af438a02a756a37f1a1408c'
    )
      throw changed();
    return wintersingenCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function wintersingenRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    wintersingenCategories.map(({ service_code }) => [
      service_code,
      {
        scope: wintersingenScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Wintersingen'],
        extra_fields: [
          {
            code: 'first_name',
            description: 'First name',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'last_name',
            description: 'Surname',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'contact_street_number',
            description: 'Your street and house number in Wintersingen (reporter address)',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'contact_postcode_locality',
            description: 'Your postcode and locality (reporter address)',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'lighting_street_number',
            description: 'Actual street and nearby house number of the defective public lamp',
            required: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'lamp_number',
            description: 'Actual number on the lamp plaque, if known; never invent it',
            required: false,
            datatype: 'string',
            max_length: 255,
          },
        ],
        notes: [
          'Nur öffentliche Strassenlampen innerhalb Wintersingen. Tatsächlichen Lampenstandort bestätigen; keine privaten Leuchten, Stromausfälle oder anderen Anliegen.',
          'Vorname, Nachname, eigene Strasse/Hausnummer, PLZ/Wohnort, E-Mail und tagsüber erreichbare Telefonnummer erforderlich. Die Quelle beschriftet die eigene Strasse mit in Wintersingen; keine Wohnadresse aus dem Lampenstandort ableiten.',
          'Betroffene Strasse/Hausnummer und Schadenart erforderlich; echte Lampennummer und Kommentar freiwillig. Keine erfundenen Kennungen. Civic verlangt zusätzlich eine nützliche Beschreibung; das ist eine lokale Vorbereitungsvorgabe.',
          'Quellfotos ausdrücklich ausschliessen. Diese Meldung kann keine Fotos enthalten.',
          'Nur lokale Vorbereitung. Keine Übermittlung, Formularbefüllung, externe Erledigung oder Statusabfrage. Unklaren Ausgang nicht automatisch wiederholen oder auf anderem Kanal senden.',
        ],
      } satisfies Requirements,
    ]),
  );
}
