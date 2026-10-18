import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const wilLightingFormUrl =
  'https://www.stadtwil.ch/form/strassenbeleuchtung-stoerungsmeldung';
export const wilLightingScope =
  'Non-emergency faults in municipal public streetlights in Wil (SG), BFS3427. The resident must confirm the actual municipal public lamp. A municipal point and resident confirmation do not independently verify asset ownership. Private fixtures, power outages, emergencies and other municipal defects are excluded.';
export const wilLightingCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Leuchte zerstört',
  'Anderer Defekt',
].map((label) => ({ service_code: label, service_name: label }));
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The Wil SG lighting form has changed. Preparation is paused.');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Pin selected fields, labels, validation, empty decoy and published client references.
 * Only shape-checked read-time CSRF values are discarded. No client, upload registry,
 * honeypot or POST is executed, simulated or retained for later sending. */
export function inspectWilLightingForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|altcha|turnstile|challenge/i.test(html))
      throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'main-form',
    );
    if (forms.length !== 1) throw changed();
    const selected = all(forms[0]);
    if (
      nodes.some((n) => 'tagName' in n && attr(n, 'form') === 'main-form') ||
      selected.some((n) => 'tagName' in n && n.tagName === 'template')
    )
      throw changed();
    const semantic = selected
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => {
                let value = a.value;
                if (a.name === 'value' && attr(n, 'name') === 'csrf_token') {
                  if (!/^\d{14}##[a-f0-9]{40}$/.test(value)) throw changed();
                  value = '<read-time-csrf>';
                }
                if (['data-image-upload-url', 'data-file-upload-url'].includes(a.name)) {
                  const url = new URL(value),
                    token = url.searchParams.get('csrf-token');
                  if (
                    !token ||
                    !/^[a-f0-9]{64}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/.test(token) ||
                    url.searchParams.getAll('csrf-token').length !== 1
                  )
                    throw changed();
                  url.searchParams.set('csrf-token', '<read-time-csrf>');
                  value = url.href;
                }
                return [a.name, value];
              })
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    if (digest(semantic) !== '70f2b01b2f0c31d9c2d6e307fda337722574e4827a3c56fcaa93968ff8515dff')
      throw changed();
    const scripts = nodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => [
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim(),
      ]);
    if (digest(scripts) !== '20c94366ed97118144dbe7038010fc8e5d40cdfaf88d5ceeecd62275c437cda4')
      throw changed();
    return wilLightingCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function wilLightingRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    wilLightingCategories.map((c) => [
      c.service_code,
      {
        scope: wilLightingScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Stadt Wil – Departement Bau, Umwelt und Verkehr'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 250,
          })),
          {
            code: 'lighting_street',
            description: 'Street of the defective municipal public lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_locality',
            description:
              'Actual locality of the defective lamp in Wil SG; not your contact address',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_house_number',
            description: 'Nearby house number if one exists; never invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lamp_number',
            description:
              'Actual lamp number if readable; preserve leading zeros and never invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'public_lamp_confirmed',
            description: 'Confirm the actual municipal public lamp in Wil SG',
            required: true,
            datatype: 'string',
            values: ['Municipal public lamp in Wil SG confirmed'],
          },
        ],
        notes: [
          'Nur nicht dringende Störungen an öffentlichen Strassenlampen der Stadt Wil (SG). Private Leuchten, Stromausfälle und andere Schäden sind ausgeschlossen.',
          'Vorname, Nachname, Telefon und E-Mail sind erforderlich. Die tatsächliche Strasse und der Ort der Lampe bleiben von Ihren Kontaktdaten getrennt. Haus- und Lampennummer nur angeben, wenn tatsächlich bekannt oder ablesbar.',
          'Die Beschreibung und die Bestätigung der öffentlichen Lampe dienen nur der lokalen Prüfung in Civic. Das gelesene offizielle Formular hat kein freies Beschreibungsfeld. Lokale Zeichenlimits sind keine veröffentlichten Serverlimits.',
          'Keine Fotoanhänge. Quellfotos ausdrücklich ausschliessen. Allgemeine Upload-Konfiguration ist kein ausgewähltes Fotofeld.',
          'Nur Vorbereitung. Senden, externe Erledigung und Statusabfrage sind nicht verfügbar. Bei unklarem Ausgang niemals automatisch erneut melden, einen Entwurf neu anlegen oder den Sendekanal wechseln.',
        ],
      } as Requirements,
    ]),
  );
}
