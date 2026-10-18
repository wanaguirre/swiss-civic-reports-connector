import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const netzulgFormUrl =
  'https://www.netzulg.ch/kundenservice/notfall/defekte-strassenbeleuchtung';
export const netzulgCategory = 'Defekte Strassenbeleuchtung';
export type NetzulgMunicipality = 'oberhofen' | 'steffisburg';
const municipalities = {
  oberhofen: { name: 'Oberhofen am Thunersee', bfsId: 934 },
  steffisburg: { name: 'Steffisburg', bfsId: 939 },
} as const;
export function netzulgScope(name: NetzulgMunicipality) {
  const municipality = municipalities[name];
  return `Non-emergency defects in public streetlamps in ${municipality.name} (BFS${municipality.bfsId}), through its explicitly published NetZulg referral. Excludes private lights, electricity outages, emergencies and other municipal defects. Repairs are grouped into periodic maintenance several times a year.`;
}
type Node = DefaultTreeAdapterMap['node'];
const all = (node: Node): Node[] => [
  node,
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const changed = () => new Error('The NetZulg lighting form has changed. Preparation is paused.');

/** Pin the complete observed form; no script execution, validation or submission. */
export function inspectNetzulgForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (node) =>
        'tagName' in node &&
        node.tagName === 'form' &&
        node.attrs.some((a) => a.name === 'id' && a.value === 'contactForm20'),
    );
    if (forms.length !== 1) throw changed();
    // A newly added challenge outside the form must also stop preparation.
    if (
      nodes.some(
        (node) =>
          'attrs' in node &&
          node.attrs.some(
            (a) =>
              ['class', 'id', 'name', 'src'].includes(a.name) &&
              /(?:g-recaptcha|h-captcha|cf-turnstile|captchaInput|recaptcha\/api)/i.test(a.value),
          ),
      )
    )
      throw changed();
    const configurations = [
      ...html.matchAll(/cx\.variables\.set\((\{[\s\S]*?\}),\s*['"]contrexx['"]\);/g),
    ]
      .map((match) => JSON.parse(match[1]) as Record<string, unknown>)
      .filter((value) => value.mode === 'frontend');
    if (
      configurations.length !== 1 ||
      configurations[0].csrf !== false ||
      configurations[0].language !== 'de'
    )
      throw changed();
    const semantic = all(forms[0])
      .map((node) => {
        if ('tagName' in node)
          return [
            node.tagName,
            node.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in node) return node.value.replace(/\s+/g, ' ').trim();
        return null;
      })
      .filter((value) => value !== '' && value !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      '1252259de4222c549b4992e771e6a9652b2fb1f6f82f63b5a498506558a4aa94'
    )
      throw changed();
    return [{ service_code: netzulgCategory, service_name: netzulgCategory }];
  } catch {
    throw changed();
  }
}

export function netzulgRequirements(name: NetzulgMunicipality): Record<string, Requirements> {
  return {
    [netzulgCategory]: {
      scope: netzulgScope(name),
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: false,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: [municipalities[name].name],
      extra_fields: [
        {
          code: 'salutation',
          description: 'Salutation required by NetZulg',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Frau', 'Frau und Herr', 'Herr', 'Herr und Frau', 'keine Angabe'],
        },
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
          description: 'Last name',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'lighting_location',
          description: 'Actual street and location of the affected public lamp',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'lamp_number',
          description:
            name === 'steffisburg'
              ? 'Actual lamp number requested by Steffisburg; never invent one'
              : 'Actual lamp number if known; never invent one',
          required: name === 'steffisburg',
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'public_lamp_confirmed',
          description: `Confirm a public streetlamp in ${municipalities[name].name}; exclude private lights, outages and emergencies.`,
          required: true,
          datatype: 'string',
          values: ['Public streetlamp confirmed'],
        },
      ],
      notes: [
        'NetZulg verlangt Anrede, Vorname, Nachname, E-Mail und Strasse/Standort. Telefon und Bemerkungen sind optional. Civic benötigt eine Beschreibung und begrenzt Textlängen für die Vorbereitung.',
        name === 'steffisburg'
          ? 'Die Gemeinde Steffisburg verlangt die tatsächliche Leuchtennummer; das optionale Formularfeld hebt diese Vorgabe nicht auf.'
          : 'Oberhofen bittet um die Leuchtennummer, wenn möglich. Fehlende Nummern nicht erfinden.',
        'Nur öffentliche Strassenlampen innerhalb der Gemeinde. Die Bestätigung ist keine unabhängige Eigentumsprüfung; NetZulg-Partnergemeinden sind nicht automatisch Beleuchtungsgebiete.',
        'Keine Fotoanhänge. Reparaturen werden gesammelt und mehrmals jährlich ausgeführt; kein Notfallkanal.',
        'Vorbereitung ohne Skriptausführung, CAPTCHA, Validierung oder POST. Zustellung, Annahme und Tracking ungeprüft; Senden bleibt deaktiviert.',
      ],
    },
  };
}
