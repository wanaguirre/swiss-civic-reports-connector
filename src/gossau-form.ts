import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

const FORM = 'https://www.gossau-zh.ch/problem-melden/';
export const gossauScope =
  'Non-emergency problems with public infrastructure in Gossau ZH, such as damaged bus stops, streetlights or public noticeboards. Not emergencies, private-property disputes or general administrative requests.';
const changed = () =>
  new Error('The Gossau reporting form has changed or is unavailable. Preparation is paused.');
type Node = DefaultTreeAdapterMap['node'];
function elements(root: Node) {
  const nodes = [root],
    found: DefaultTreeAdapterMap['element'][] = [];
  while (nodes.length) {
    const node = nodes.pop()!;
    if ('tagName' in node) found.push(node);
    if ('childNodes' in node) nodes.push(...node.childNodes);
  }
  return found;
}
const attr = (node: DefaultTreeAdapterMap['element'], name: string) =>
  node.attrs.find((a) => a.name === name)?.value;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw changed();
  return value as Record<string, unknown>;
};
// Read a bounded JSON literal, never execute municipal JavaScript or keep tokens.
function literal(source: string, pattern: RegExp): unknown {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw changed();
  const start = matches[0].index! + matches[0][0].length;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) {
        if (!/^\s*;/.test(source.slice(i + 1))) throw changed();
        return JSON.parse(source.slice(start, i + 1));
      }
    } else if (!depth && !/\s/.test(c)) throw changed();
  }
  throw changed();
}
const spec = [
  [72, 'betreff_1664481426515', 'textbox', true],
  [73, 'beschreibung_1664481452816', 'textarea', true],
  [66, 'strasse_nr_1664481497350', 'address', true],
  [67, 'plz_ort_1664479171697', 'zip', true],
  [74, 'html_1664481515179', 'html', false],
  [449, 'anrede_1709277317814', 'listselect', true],
  [63, 'name_1664479095999', 'lastname', true],
  [64, 'firstname_1664479089798', 'firstname', true],
  [68, 'telefon_1664479187397', 'phone', true],
  [69, 'email_1664479206514', 'email', true],
  [75, 'bild_hochladen_1664481566101', 'file_upload', false],
  [239, 'bestaetigung_1680025635932', 'checkbox', true],
  [240, 'html_1680025645928', 'html', false],
  [71, 'submit_1664479234146', 'submit', false],
] as const;
export function inspectGossauForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = elements(parse(html)),
      scripts = nodes.filter((n) => n.tagName === 'script');
    const source = scripts
      .filter((n) => !attr(n, 'src'))
      .map((n) => n.childNodes.map((c) => ('value' in c ? c.value : '')).join(''))
      .join('\n');
    const ids = [...source.matchAll(/\bform\.id\s*=\s*(['"])([^'"]+)\1\s*;/g)];
    if (ids.length !== 1 || ids[0][2] !== '7') throw changed();
    for (const asset of [
      'https://www.gossau-zh.ch/wp-content/plugins/ninja-forms/assets/js/min/front-end.js?ver=3.15.5',
      'https://www.gossau-zh.ch/wp-content/plugins/ninja-forms-uploads/assets/js/front-end/controllers/fieldFile.js?ver=3.3.35',
    ])
      if (scripts.filter((n) => attr(n, 'src') === asset).length !== 1) throw changed();
    const settings = record(literal(source, /\bform\.settings\s*=\s*/g));
    const front = record(literal(source, /\bvar\s+nfFrontEnd\s*=\s*/g));
    const fields = literal(source, /\bform\.fields\s*=\s*/g);
    if (
      settings.title !== 'Problem melden' ||
      settings.logged_in !== '' ||
      !Array.isArray(settings.conditions) ||
      settings.conditions.length ||
      front.adminAjax !== new URL('/wp-admin/admin-ajax.php', FORM).href ||
      !Array.isArray(fields) ||
      fields.length !== spec.length
    )
      throw changed();
    const byId = new Map<number, Record<string, unknown>>();
    for (const [index, [id, key, type, required]] of spec.entries()) {
      const field = record(fields[index]);
      if (
        field.id !== id ||
        field.key !== key ||
        field.type !== type ||
        (required
          ? field.required !== 1 && field.required !== true
          : ![undefined, false, 0, ''].includes(field.required as never)) ||
        field.disabled ||
        field.readonly ||
        (field.default && type !== 'html') ||
        (id !== 68 && ![undefined, '', 0].includes(field.input_limit as never)) ||
        (id !== 68 && (field.mask || field.custom_mask))
      )
        throw changed();
      byId.set(id, field);
    }
    const phone = byId.get(68)!,
      photo = byId.get(75)!,
      consent = byId.get(239)!,
      salutation = byId.get(449)!;
    if (
      phone.input_limit !== 10 ||
      phone.input_limit_type !== 'characters' ||
      phone.mask !== 'custom' ||
      phone.custom_mask !== '9999999999' ||
      photo.upload_multi_count !== 1 ||
      photo.upload_types !== '.jpg,.jpeg,.png,.gif' ||
      photo.max_file_size !== 0 ||
      photo.min_file_size !== 0 ||
      photo.save_to_server !== 1 ||
      photo.media_library !== 'false' ||
      consent.default_value !== 'unchecked' ||
      !Array.isArray(salutation.options) ||
      JSON.stringify(salutation.options.map((o) => record(o).value)) !==
        JSON.stringify(['Frau', 'Herr', 'Divers'])
    )
      throw changed();
    const policies = elements(parse(String(byId.get(240)!.default ?? '')))
      .filter((n) => n.tagName === 'a')
      .map((n) => attr(n, 'href'))
      .sort();
    if (
      JSON.stringify(policies) !==
      JSON.stringify(['https://gossau-zh.ch/Datenschutz/', 'https://gossau-zh.ch/agb/'])
    )
      throw changed();
    return [{ service_code: 'problem-melden', service_name: 'Problem melden' }];
  } catch {
    throw changed();
  }
}
export function gossauRequirements(): Record<string, Requirements> {
  return {
    'Problem melden': {
      scope: gossauScope,
      photo_required: false,
      email_required: true,
      phone_required: true,
      phone_digits: 10,
      contact_fields: ['phone'],
      max_photos: 1,
      max_photo_bytes: 5_000_000,
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Gossau ZH'],
      extra_fields: [
        {
          code: 'report_title',
          description: 'Report title',
          required: true,
          datatype: 'string',
          max_length: 100,
          translate: true,
        },
        {
          code: 'issue_postcode_city',
          description: 'Issue postcode and locality',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'salutation',
          description: 'Salutation (choose yourself)',
          required: true,
          datatype: 'string',
          contact: true,
          values: ['Frau', 'Herr', 'Divers'],
        },
        {
          code: 'first_name',
          description: 'First name',
          required: true,
          datatype: 'string',
          max_length: 100,
          contact: true,
        },
        {
          code: 'last_name',
          description: 'Last name',
          required: true,
          datatype: 'string',
          max_length: 100,
          contact: true,
        },
      ],
      notes: [
        'Nicht dringende Probleme an der öffentlichen Infrastruktur in Gossau ZH. Der bestätigte Standort bezeichnet die betroffene Strasse/Hausnummer; PLZ und Ort beziehen sich auf das Problem.',
        'Anrede selbst auswählen. Vorname, Name, E-Mail und eine Telefonnummer mit genau zehn Ziffern sind erforderlich (ohne Leerzeichen oder +41).',
        'Ein Foto ist freiwillig. Civic begrenzt Fotos auf 5 MB, den Betreff auf 100 und die Beschreibung auf 5000 Zeichen; dies sind lokale Vorbereitungslimits.',
        'Die Gemeinde verlangt vor dem Senden Zustimmung zu AGB und Datenschutz, beide im offiziellen Formular verlinkt. Vorbereitung erteilt keine Zustimmung. Senden und Statusverfolgung sind noch nicht verfügbar.',
      ],
    },
  };
}
