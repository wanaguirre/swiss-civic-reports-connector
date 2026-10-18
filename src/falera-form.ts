import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const faleraFormUrl = 'https://www.falera.net/kontakt/kontaktformular/';
export const faleraWorksUrl = 'https://www.falera.net/verwaltung/werkhofstrassenwesen/';
export const faleraScope =
  'Non-emergency questions and problems concerning municipal public works in Falera, BFS3572: roads, paths, public lighting, winter maintenance, waste and municipal tourist facilities. Confirm the actual public asset and municipal works responsibility. The boundary and resident confirmation do not independently verify ownership. Private assets, power outages and emergencies are excluded. The official general contact form has no category or issue-location field; the routing label and location are for local review only.';
export const faleraCategories = [
  {
    service_code: 'Werkhof/Strassenwesen',
    service_name: 'Werkhof/Strassenwesen – Fragen und Probleme',
  },
];
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The Falera contact form has changed. Preparation is paused.');
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
/** Read and discard shaped form state. Akismet, its empty trap and client timestamp
 * are never executed, simulated or retained for sending. The unrelated generated
 * slider ID is checked against its single DOM node before masking its selector. */
export function inspectFaleraForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'gform_2',
    );
    if (
      forms.length !== 1 ||
      nodes.some(
        (n) =>
          'tagName' in n &&
          (attr(n, 'form') === 'gform_2' ||
            ['g-recaptcha', 'cf-turnstile', 'frc-captcha', 'altcha'].some((c) =>
              (attr(n, 'class') ?? '').split(/\s+/).includes(c),
            ) ||
            n.tagName === 'altcha-widget'),
      )
    )
      throw changed();
    const selected = all(forms[0]);
    if (selected.some((n) => 'tagName' in n && ['template', 'iframe'].includes(n.tagName)))
      throw changed();
    for (const [name, pattern] of [
      ['state_2', /^[A-Za-z0-9+/]{55}=$/],
      ['ak_js', /^\d{3}$/],
    ] as const) {
      const found = selected.filter(
        (n): n is Element => 'tagName' in n && attr(n, 'name') === name,
      );
      if (
        found.length !== 1 ||
        found[0].tagName !== 'input' ||
        attr(found[0], 'type') !== 'hidden' ||
        !pattern.test(attr(found[0], 'value') ?? '')
      )
        throw changed();
    }
    const semantic = selected
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                a.name === 'value' && ['state_2', 'ak_js'].includes(attr(n, 'name') ?? '')
                  ? `<read-time-${attr(n, 'name')}>`
                  : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    if (digest(semantic) !== '7f226f670784d2ec1cc4ca96def36f29729800521388f48b07a03ddd416b569c')
      throw changed();
    const sliders = nodes.filter(
      (n): n is Element => 'tagName' in n && (attr(n, 'id') ?? '').startsWith('layerslider_2_'),
    );
    if (
      sliders.length !== 1 ||
      !/^layerslider_2_[a-z0-9]{12,13}$/.test(attr(sliders[0], 'id') ?? '')
    )
      throw changed();
    const slider = attr(sliders[0], 'id')!;
    const scripts = nodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => [
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim()
          .replaceAll('#' + slider, '#<read-time-slider-id>'),
      ]);
    if (digest(scripts) !== 'a5ef81dbbae8225ae10081bb8e7072451ad80eed62f0b010872d65c0cc36975a')
      throw changed();
    return faleraCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function faleraRequirements(): Record<string, Requirements> {
  return {
    [faleraCategories[0].service_code]: {
      scope: faleraScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: false,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Gemeindeverwaltung Falera – Werkhof/Strassenwesen'],
      extra_fields: [
        {
          code: 'contact_name',
          description: 'First name and surname',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'contact_address',
          description: 'Your contact street/address (optional; not the issue location)',
          required: false,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'contact_postal_locality',
          description: 'Your contact postal code and locality (optional; not the issue location)',
          required: false,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'municipal_works_confirmed',
          description: 'Confirm the affected public asset belongs to municipal works in Falera',
          required: true,
          datatype: 'string',
          values: ['Municipal works responsibility in Falera confirmed'],
        },
      ],
      notes: [
        'Nur nicht dringende Fragen und Probleme zu öffentlichen Anlagen im Zuständigkeitsbereich Werkhof/Strassenwesen Falera. Tatsächlichen Standort und Zuständigkeit bestätigen.',
        'Vorname/Name, E-Mail und Kommentar sind erforderlich. Ihre Adresse, PLZ/Ort und Telefonnummer sind freiwillig und bleiben vom Standort des Problems getrennt.',
        'Die offizielle Kontaktseite hat keine Kategorie und kein eigenes Feld für den Problemstandort. Die Zuordnung und Standortbestätigung dienen der lokalen Prüfung; die Textlängen sind lokale Sicherheitsgrenzen.',
        'Keine Fotoanhänge. Quellfotos ausdrücklich ausschliessen. Kontaktdaten bleiben ausserhalb der KI-Textbearbeitung.',
        'Nur Vorbereitung. Senden, externe Erledigung und Statusabfrage sind nicht verfügbar. Annahme und Empfang sind nicht verifiziert; bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
