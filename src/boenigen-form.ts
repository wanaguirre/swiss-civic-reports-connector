import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

const url = 'https://boenigen.ch/services/schaden-melden/';
export const boenigenScope =
  'Non-emergency damage reports to the municipality of Bönigen. The official form has one general damage class, not separate asset categories. Not emergencies or private-property disputes.';
const changed = () =>
  new Error('The Bönigen damage form has changed or is unavailable. Preparation is paused.');
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): DefaultTreeAdapterMap['element'][] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: DefaultTreeAdapterMap['element'], key: string) =>
  n.attrs.find((a) => a.name === key)?.value;
const fields = [
  ['input_1', 'text'],
  ['input_3', 'text'],
  ['input_4', 'text'],
  ['input_5', 'text'],
  ['input_6', 'tel'],
  ['input_7', 'email'],
  ['input_8', 'textarea'],
  ['input_9', 'file'],
] as const;
const hidden = [
  'MAX_FILE_SIZE',
  'gform_submission_method',
  'gform_theme',
  'gform_style_settings',
  'is_submit_31',
  'gform_submit',
  'gform_currency',
  'gform_unique_id',
  'state_31',
  'gform_target_page_number_31',
  'gform_source_page_number_31',
  'gform_field_values',
];

/** Public schema only. Never retain state tokens or implement unverified writes. */
export function inspectBoenigenForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const document = all(parse(html));
    const forms = document.filter((n) => n.tagName === 'form' && attr(n, 'id') === 'gform_31');
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      nodes = all(form);
    if (
      attr(form, 'method')?.toLowerCase() !== 'post' ||
      attr(form, 'enctype') !== 'multipart/form-data' ||
      new URL(attr(form, 'action') ?? '', url).href !== url ||
      attr(form, 'data-formid') !== '31'
    )
      throw changed();
    if (
      nodes.some(
        (n) =>
          n.tagName === 'iframe' ||
          /captcha|turnstile|challenge|honeypot/i.test(
            ['name', 'id', 'class', 'src'].map((k) => attr(n, k)).join(' '),
          ),
      )
    )
      throw changed();
    const controls = nodes.filter((n) =>
      ['input', 'textarea', 'select', 'button'].includes(n.tagName),
    );
    if (controls.length !== fields.length + hidden.length + 1) throw changed();
    for (const [name, type] of fields) {
      const matches = controls.filter((n) => attr(n, 'name') === name);
      if (matches.length !== 1) throw changed();
      const n = matches[0],
        required = type !== 'file';
      if (
        (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
        (attr(n, 'aria-required') === 'true' || attr(n, 'required') !== undefined) !== required ||
        ['disabled', 'readonly', 'multiple', 'form', 'formaction'].some(
          (k) => attr(n, k) !== undefined,
        )
      )
        throw changed();
      const max = attr(n, 'maxlength');
      if (
        max !== undefined &&
        (!/^\d+$/.test(max) || Number(max) < (type === 'textarea' ? 5000 : 254))
      )
        throw changed();
      if (type === 'file' && attr(n, 'accept') !== undefined) throw changed();
    }
    for (const name of hidden) {
      const matches = controls.filter((n) => attr(n, 'name') === name);
      if (
        matches.length !== 1 ||
        attr(matches[0], 'type') !== 'hidden' ||
        attr(matches[0], 'disabled') !== undefined
      )
        throw changed();
    }
    const value = (name: string) =>
      attr(
        controls.find((n) => attr(n, 'name') === name)!,
        'value',
      );
    if (
      Number(value('MAX_FILE_SIZE')) !== 67108864 ||
      value('gform_submit') !== '31' ||
      value('is_submit_31') !== '1' ||
      value('gform_target_page_number_31') !== '0' ||
      value('gform_source_page_number_31') !== '1'
    )
      throw changed();
    const buttons = controls.filter((n) => n.tagName === 'button');
    if (
      buttons.length !== 1 ||
      attr(buttons[0], 'type') !== 'submit' ||
      attr(buttons[0], 'id') !== 'gform_submit_button_31'
    )
      throw changed();
    return [{ service_code: 'schaden-melden', service_name: 'Schaden melden' }];
  } catch {
    throw changed();
  }
}

export function boenigenRequirements(): Record<string, Requirements> {
  return {
    'Schaden melden': {
      scope: boenigenScope,
      photo_required: false,
      email_required: true,
      phone_required: true,
      contact_fields: ['phone'],
      max_photos: 1,
      max_photo_bytes: 5_000_000,
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Bönigen'],
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
          code: 'reporter_address',
          description: 'Reporter postal street address',
          required: true,
          datatype: 'string',
          contact: true,
          max_length: 250,
        },
        {
          code: 'reporter_postcode_city',
          description: 'Reporter postcode and locality',
          required: true,
          datatype: 'string',
          contact: true,
          max_length: 250,
        },
      ],
      notes: [
        'Allgemeine, nicht dringende Schadenmeldung in Bönigen. Das Formular hat keine weiteren Schadenkategorien.',
        'Vorname, Name, Kontaktadresse, Ort, Telefon und E-Mail sind erforderlich. Die Kontaktadresse ist nicht der Schadenstandort.',
        'Civic benötigt einen bestätigten Schadenstandort und eine deutsche Beschreibung. Ein Foto bis 5 MB ist freiwillig; die lokale Textgrenze beträgt 5000 Zeichen.',
        'Vorbereitung bleibt in Civic. Senden und Statusverfolgung sind bis zur Prüfung von Anhang, Zustellung und Empfangsbestätigung gesperrt.',
      ],
    },
  };
}
