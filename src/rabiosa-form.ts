import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const rabiosaFormUrl = 'https://rabiosa-energie.ch/formulare.html';
export const rabiosaMandateUrl = 'https://rabiosa-energie.ch/netzbau.html';
export const rabiosaScope =
  'Non-emergency defects of actual public streetlights maintained by Rabiosa Energie within Churwalden (BFS3911). Confirm the maintained public lamp and exact point. Private fixtures, power outages, urgent hazards, other assets and neighbouring municipalities are excluded. A municipal boundary alone does not verify lamp ownership.';
export const rabiosaCategories = [
  { service_code: 'Defekte Strassenleuchte', service_name: 'Defekte Strassenleuchte' },
];
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, name: string) => n.attrs.find((a) => a.name === name)?.value;
const element = (n: Node): n is Element => 'tagName' in n;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changed = () => new Error('The Rabiosa lighting form has changed. Preparation is paused.');

/** Inspect source only. Discard shaped read-time state; never swap the trap fields,
 * execute its inline client, reuse a request token or construct a POST payload. */
export function inspectRabiosaForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|altcha|turnstile/i.test(html))
      throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element =>
        element(n) &&
        n.tagName === 'form' &&
        all(n).some(
          (x) =>
            element(x) && attr(x, 'name') === 'FORM_SUBMIT' && attr(x, 'value') === 'auto_form_1',
        ),
    );
    if (forms.length !== 1 || nodes.some((n) => element(n) && attr(n, 'form') !== undefined))
      throw changed();
    let block: Node | undefined = forms[0];
    while (
      block &&
      !(element(block) && attr(block, 'class')?.split(/\s+/).includes('ce_accordion'))
    )
      block = 'parentNode' in block ? (block.parentNode ?? undefined) : undefined;
    if (!block) throw changed();
    const selected = all(block);
    if (selected.some((n) => element(n) && ['template', 'iframe'].includes(n.tagName)))
      throw changed();
    const tokens = selected.filter(
      (n): n is Element => element(n) && attr(n, 'name') === 'REQUEST_TOKEN',
    );
    const traps = selected.filter((n): n is Element => element(n) && attr(n, 'id') === 'ctrl_8_3');
    if (
      tokens.length !== 1 ||
      traps.length !== 1 ||
      tokens[0].tagName !== 'input' ||
      attr(tokens[0], 'type') !== 'hidden' ||
      !/^[0-9a-f]{30,32}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{58}$/.test(
        attr(tokens[0], 'value') ?? '',
      ) ||
      traps[0].tagName !== 'input' ||
      attr(traps[0], 'type') !== 'text' ||
      !/^[A-Za-z0-9_-]{22}$/.test(attr(traps[0], 'name') ?? '') ||
      !/^[A-Za-z0-9_-]{22}$/.test(attr(traps[0], 'value') ?? '') ||
      attr(traps[0], 'name') === attr(traps[0], 'value')
    )
      throw changed();
    const semantic = selected
      .map((n) => {
        if (element(n))
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n === tokens[0] && a.name === 'value'
                  ? '<read-time-request-token>'
                  : n === traps[0] && ['name', 'value'].includes(a.name)
                    ? '<read-time-trap>'
                    : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    const scripts = nodes
      .filter((n): n is Element => element(n) && n.tagName === 'script')
      .map((n) => [
        n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim(),
      ]);
    if (
      digest(semantic) !== 'c1e9660ffb443dade60d3e8a2c429a4750ead8ca438f15cc061b84d8c62bba51' ||
      digest(scripts) !== '60364112dc526223a81e5fd3275a7fe617b755c88e672e0b126f486ac7ed9bb7'
    )
      throw changed();
    return rabiosaCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}

export function rabiosaRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    rabiosaCategories.map(({ service_code }) => [
      service_code,
      {
        scope: rabiosaScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: false,
        name_required: false,
        contact_fields: ['name', 'phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Rabiosa Energie – Strassenbeleuchtung Churwalden'],
        extra_fields: [
          {
            code: 'lighting_street',
            description: 'Actual street of the defective public lamp',
            required: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'lighting_locality',
            description: 'Actual lamp locality within Churwalden; not your contact address',
            required: true,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp number if known; preserve leading zeros and never invent one',
            required: false,
            datatype: 'string',
            max_length: 255,
          },
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm this actual public lamp in Churwalden is maintained by Rabiosa Energie',
            required: true,
            datatype: 'string',
            values: ['Public lamp in Churwalden maintained by Rabiosa Energie confirmed'],
          },
        ],
        notes: [
          'Nur nicht dringende Defekte an öffentlichen Strassenlampen in Churwalden, die Rabiosa Energie unterhält. Tatsächlichen Standort und Zuständigkeit bestätigen.',
          'Strasse und Ort sind im Quellformular erforderlich. Lampennummer, Mitteilung und alle Kontaktdaten sind freiwillig. Civic verlangt zusätzlich eine nützliche Beschreibung und die Zuständigkeitsbestätigung; Längenbegrenzungen sind lokale Vorgaben.',
          'Kontaktdaten bleiben von der Lampenadresse getrennt und werden nicht an die KI weitergegeben. Keine Fotoanhänge; Quellfotos ausdrücklich ausschliessen.',
          'Nur lokale Vorbereitung. Keine Übermittlung, Formularbefüllung, externe Erledigung oder Statusabfrage. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
        ],
      } satisfies Requirements,
    ]),
  );
}
