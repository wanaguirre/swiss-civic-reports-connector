import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const energiaEngiadinaFormUrl =
  'https://www.ee-energia-engiadina.ch/de/defekte-strassenlaterne';
export const energiaEngiadinaMandateUrl =
  'https://www.ee-energia-engiadina.ch/de/oeffentliche-beleuchtung';
export const energiaEngiadinaScope =
  'Non-emergency faults of public streetlights maintained by EE Energia Engiadina within Scuol (BFS3762). Confirm the actual lamp, provider responsibility and exact point. Private fixtures, power outages, urgent hazards, other defects and unnamed neighbouring municipalities are excluded. A municipal boundary and resident confirmation do not independently verify lamp ownership.';
export const energiaEngiadinaCategories = [
  'Leuchte aus',
  'Leuchte beschädigt',
  'Leuchte anderer Defekt',
  'Mast beschädigt',
  'Mastdeckel fehlt/offen/beschädigt',
].map((label) => ({ service_code: label, service_name: label }));
const formId = 'webform-submission-defekte-strassenbeleuchtung-node-47-add-form';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, name: string) => n.attrs.find((a) => a.name === name)?.value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changed = () =>
  new Error('The EE Energia Engiadina lighting form has changed. Preparation is paused.');

/** Inspect public source only. Discard technical read-time values without unlocking
 * Antibot, transforming its key, executing clients or constructing a POST payload. */
export function inspectEnergiaEngiadinaForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|altcha|turnstile/i.test(html))
      throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === formId,
    );
    if (forms.length !== 1 || nodes.some((n) => 'tagName' in n && attr(n, 'form') === formId))
      throw changed();
    const selected = all(forms[0]);
    if (selected.some((n) => 'tagName' in n && ['template', 'iframe'].includes(n.tagName)))
      throw changed();
    const builds = selected.filter(
      (n): n is Element => 'tagName' in n && attr(n, 'name') === 'form_build_id',
    );
    if (
      builds.length !== 1 ||
      builds[0].tagName !== 'input' ||
      attr(builds[0], 'type') !== 'hidden' ||
      !/^form-[A-Za-z0-9_-]{43}$/.test(attr(builds[0], 'value') ?? '') ||
      attr(builds[0], 'data-drupal-selector') !==
        attr(builds[0], 'value')?.toLowerCase().replaceAll('_', '-')
    )
      throw changed();
    const semantic = selected
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n === builds[0] && ['value', 'data-drupal-selector'].includes(a.name)
                  ? '<read-time-build>'
                  : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    let settingsCount = 0;
    const scripts = nodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => {
        let body = n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim();
        if (attr(n, 'data-drupal-selector') === 'drupal-settings-json') {
          settingsCount++;
          const config = JSON.parse(body);
          const forms = config?.antibot?.forms;
          const urls = config?.ajaxTrustedUrl;
          if (
            !/^[A-Za-z0-9_-]{22}$/.test(config?.csp?.nonce ?? '') ||
            !forms ||
            Object.keys(forms).length !== 1 ||
            forms[formId]?.id !== formId ||
            !/^[A-Za-z0-9_-]{43}$/.test(forms[formId]?.key ?? '') ||
            !urls ||
            Object.keys(urls).length !== 1 ||
            !/^form_action_[A-Za-z0-9_-]{43}$/.test(Object.keys(urls)[0]) ||
            Object.values(urls)[0] !== true
          )
            throw changed();
          config.csp.nonce = '<read-time-csp-nonce>';
          forms[formId].key = '<read-time-antibot-config>';
          config.ajaxTrustedUrl = { '<read-time-trusted-action>': true };
          body = JSON.stringify(config);
        }
        return [n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)), body];
      });
    if (
      settingsCount !== 1 ||
      digest(semantic) !== '5a803709475add5f5daa40a6007b639b70e2523e6f62cb6f9269e77803b752cd' ||
      digest(scripts) !== 'de67818d6976ac055d59219ad589de21ddb19181c360ac66d7de88092e61879e'
    )
      throw changed();
    return energiaEngiadinaCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}

export function energiaEngiadinaRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    energiaEngiadinaCategories.map(({ service_code }) => [
      service_code,
      {
        scope: energiaEngiadinaScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: false,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['EE Energia Engiadina – Öffentliche Beleuchtung Scuol'],
        extra_fields: [
          ...[
            ['last_name', 'Surname'],
            ['first_name', 'First name'],
            ['contact_address', 'Your postal street address; not the lamp location'],
            ['contact_postcode', 'Your postal postcode; not the lamp location'],
            ['contact_locality', 'Your postal locality; not the lamp location'],
          ].map(([code, description]) => ({
            code,
            description,
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 255,
          })),
          {
            code: 'lighting_municipality',
            description: 'Confirm the actual municipality of the public lamp',
            required: true,
            datatype: 'string',
            values: ['Scuol'],
          },
          {
            code: 'lighting_street',
            description: 'Actual street or place of the defective public lamp',
            required: true,
            datatype: 'string',
            max_length: 255,
          },
          ...[
            ['near_house_number', 'Nearby house number, if known'],
            ['lamp_number', 'Actual mast number, if known; never invent one'],
            ['nearby_landmark', 'Nearby landmark, if helpful'],
          ].map(([code, description]) => ({
            code,
            description,
            required: false,
            datatype: 'string',
            max_length: 255,
          })),
          {
            code: 'public_lamp_confirmed',
            description: 'Confirm this public lamp in Scuol is maintained by EE Energia Engiadina',
            required: true,
            datatype: 'string',
            values: ['Public lamp in Scuol maintained by EE Energia Engiadina confirmed'],
          },
        ],
        notes: [
          'Nur nicht dringende Defekte an öffentlichen Strassenlampen in Scuol, die EE Energia Engiadina unterhält. Tatsächlichen Standort und Zuständigkeit bestätigen; bei akuter Gefahr den zuständigen Notdienst nutzen.',
          'Gemeinde, Strasse/Platz und eine Schadenart sind erforderlich. Civic bereitet eine der fünf veröffentlichten Schadenarten vor; die Quelle bietet mehrere Kontrollkästchen. Eine nützliche Beschreibung und die Zuständigkeitsbestätigung sind zusätzliche lokale Vorgaben.',
          'Hausnummer, echte Mastnummer, nahe Orientierungspunkte und alle Kontaktdaten sind freiwillig. Eigene Kontaktdaten bleiben von der Lampenadresse getrennt und werden nicht an die KI weitergegeben.',
          'Keine Fotoanhänge. Quellfotos ausdrücklich vom Bericht ausschliessen.',
          'Nur lokale Vorbereitung. Keine Übermittlung, Formularbefüllung, externe Erledigung oder Statusabfrage. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
        ],
      } satisfies Requirements,
    ]),
  );
}
