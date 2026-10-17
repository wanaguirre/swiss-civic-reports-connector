import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const marthalenFormUrl = 'https://eg-m.ch/online-schalter/';
export const marthalenTermsUrl = 'https://eg-m.ch/datenschutzerklaerung/';
export const marthalenScope =
  'Non-emergency defects in public lighting on roads, paths and squares in Marthalen, maintained by EGM on behalf of the municipality. Not private lights, electricity outages or other municipal defects.';
export const marthalenCategories = [
  'Lampe brennt nicht mehr',
  'Lampe brennt manchmal nicht',
  'Mechanischer Defekt',
  'Anderer Defekt',
] as const;
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (node: Node): Element[] => [
  ...('tagName' in node ? [node] : []),
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const attr = (node: Element, key: string) => node.attrs.find((a) => a.name === key)?.value;
const text = (node: Node): string =>
  'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
const changed = () => new Error('The Marthalen lighting form has changed. Preparation is paused.');
const fields = [
  ['name', 'text', true],
  ['field_bb2dbe6', 'text', true],
  ['email', 'email', true],
  ['field_891898f', 'tel', false],
  ['field_e2ac3bf', 'text', false],
  ['field_a1f5b62', 'text', false],
  ['field_0819583', 'select', false],
  ['message', 'textarea', false],
  ['field_e037bf7', 'checkbox', true],
] as const;
const hidden = {
  post_id: '2236',
  form_id: 'a1a202b',
  referer_title: 'Online Schalter',
  queried_id: '14',
};

/** Inspect only the actual lighting popup; unrelated login and CF7 CAPTCHA forms are not this contract. */
export function inspectMarthalenForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const doc = all(parse(html));
    const forms = doc.filter(
      (node) =>
        node.tagName === 'form' &&
        all(node).some(
          (field) => attr(field, 'name') === 'form_id' && attr(field, 'value') === hidden.form_id,
        ),
    );
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      nodes = all(form);
    if (
      attr(form, 'method')?.toLowerCase() !== 'post' ||
      !(attr(form, 'class') ?? '').split(/\s+/).includes('elementor-form') ||
      new URL(attr(form, 'action') ?? '', marthalenFormUrl).href !== marthalenFormUrl ||
      (attr(form, 'enctype') !== undefined && attr(form, 'enctype') !== 'multipart/form-data')
    )
      throw changed();
    if (
      nodes.some(
        (node) =>
          node.tagName === 'iframe' ||
          /captcha|turnstile|challenge|honeypot/i.test(
            ['name', 'id', 'class', 'src'].map((key) => attr(node, key)).join(' '),
          ),
      )
    )
      throw changed();
    const controls = nodes.filter((node) =>
      ['input', 'select', 'textarea', 'button'].includes(node.tagName),
    );
    if (controls.length !== fields.length + Object.keys(hidden).length + 1) throw changed();
    for (const [name, expected] of Object.entries(hidden)) {
      const matches = controls.filter((node) => attr(node, 'name') === name);
      if (
        matches.length !== 1 ||
        attr(matches[0], 'type') !== 'hidden' ||
        attr(matches[0], 'value') !== expected
      )
        throw changed();
    }
    for (const [code, type, required] of fields) {
      const matches = controls.filter((node) => attr(node, 'name') === `form_fields[${code}]`);
      if (matches.length !== 1) throw changed();
      const node = matches[0];
      if (
        (node.tagName === 'input' ? attr(node, 'type') : node.tagName) !== type ||
        (attr(node, 'required') !== undefined || attr(node, 'aria-required') === 'true') !==
          required
      )
        throw changed();
      const limit = attr(node, 'maxlength');
      if (
        limit !== undefined &&
        (!/^\d+$/.test(limit) || Number(limit) < (type === 'textarea' ? 5000 : 254))
      )
        throw changed();
      if (type === 'checkbox' && attr(node, 'checked') !== undefined) throw changed();
    }
    if (
      controls.some((node) =>
        ['disabled', 'readonly', 'multiple', 'form', 'formaction'].some(
          (key) => attr(node, key) !== undefined,
        ),
      )
    )
      throw changed();
    const buttons = controls.filter((node) => node.tagName === 'button');
    if (buttons.length !== 1 || attr(buttons[0], 'type') !== 'submit') throw changed();
    const options = nodes.filter((node) => node.tagName === 'option');
    const expected = ['bitte auswählen', ...marthalenCategories];
    if (
      options.length !== expected.length ||
      options.some(
        (node, i) =>
          attr(node, 'value') !== expected[i] ||
          text(node).trim() !== expected[i] ||
          attr(node, 'disabled') !== undefined,
      )
    )
      throw changed();
    const terms = nodes.filter(
      (node) =>
        node.tagName === 'a' &&
        new URL(attr(node, 'href') ?? '', marthalenFormUrl).href === marthalenTermsUrl,
    );
    if (terms.length !== 1) throw changed();
    return marthalenCategories.map((name) => ({ service_code: name, service_name: name }));
  } catch {
    throw changed();
  }
}

export function marthalenRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    marthalenCategories.map((category) => [
      category,
      {
        scope: marthalenScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: false,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Marthalen'],
        extra_fields: [
          {
            code: 'first_name',
            description: 'First name',
            required: true,
            datatype: 'string',
            contact: true,
            max_length: 100,
          },
          {
            code: 'last_name',
            description: 'Last name',
            required: true,
            datatype: 'string',
            contact: true,
            max_length: 100,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp/pole number, if known; do not invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
        ],
        notes: [
          'Nur öffentliche Beleuchtung in Marthalen. EGM betreibt und unterhält sie im Auftrag der Gemeinde.',
          'Standort mit Strasse und nächster Hausnummer angeben; eine bekannte Kandelabernummer kann ergänzt werden. Keine Anlagennummer erfinden.',
          'Vorname, Nachname, E-Mail und Zustimmung zur Datenschutzerklärung sind erforderlich. Telefon ist freiwillig.',
          'Reine Textmeldung: Ein Quellfoto kann beim Entwurf helfen, wird aber ausdrücklich nicht an EGM übermittelt.',
          'Vorbereitung bleibt in Civic. Senden und Statusabfrage bleiben bis zur Prüfung von Annahme und Empfang gesperrt.',
        ],
      } satisfies Requirements,
    ]),
  );
}
