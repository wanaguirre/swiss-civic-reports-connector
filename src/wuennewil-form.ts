import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const wuennewilFormUrl =
  'https://wuennewil-flamatt.ch/formulaires/storungsmeldung-strassenbeleuchtung/';
export const wuennewilCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Leuchte zerstört',
  'Anderer Defekt',
] as const;
export const wuennewilScope =
  'Non-emergency faults of municipal public streetlamps in Wünnewil-Flamatt. Excludes private lighting, electricity outages, emergencies and other maintenance. Confirm municipal responsibility for the individual public lamp; a municipality boundary alone does not establish ownership.';

type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Node, key: string) =>
  'attrs' in n ? n.attrs.find((a) => a.name === key)?.value : undefined;
const changed = () =>
  new Error('The Wünnewil-Flamatt lighting form has changed. Preparation is paused.');
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

/** Read a bounded configuration literal without evaluating municipal JavaScript. */
function conditionalLiteral(source: string) {
  const matches = [...source.matchAll(/window\[['"]gf_form_conditional_logic['"]\]\[30\]\s*=\s*/g)];
  if (matches.length !== 1) throw changed();
  const start = matches[0].index! + matches[0][0].length;
  let depth = 0,
    quote = '',
    escaped = false,
    canonical = '';
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      canonical += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
      canonical += c;
    } else if (c === '{' || c === '[') {
      depth++;
      canonical += c;
    } else if (c === '}' || c === ']') {
      canonical += c;
      if (--depth === 0) {
        if (!/^\s*;/.test(source.slice(i + 1))) throw changed();
        return canonical;
      }
    } else if (!/\s/.test(c)) {
      if (!depth) throw changed();
      canonical += c;
    }
  }
  throw changed();
}

export function inspectWuennewilForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n) => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'gform_30',
    );
    if (forms.length !== 1) throw changed();
    const selected = all(forms[0]);
    if (selected.filter((n) => attr(n, 'name') === 'state_30').length !== 1) throw changed();
    // Only the signed dynamic state value is omitted. Keep its field and every
    // other attribute, page, label, validation marker, constant and empty control.
    const semantic = selected
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                attr(n, 'name') === 'state_30' && a.name === 'value' ? '[dynamic state]' : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((v) => v !== '' && v !== null);
    if (hash(semantic) !== 'dfccb57580d0390ad7dbbff6d9d1b45da083f97fbc1025130c778e3d63bacbe1')
      throw changed();
    const inline = nodes
      .filter((n) => 'tagName' in n && n.tagName === 'script' && !attr(n, 'src'))
      .map((n) =>
        'childNodes' in n ? n.childNodes.map((c) => ('value' in c ? c.value : '')).join('') : '',
      )
      .join('\n');
    if (
      hash(conditionalLiteral(inline)) !==
      'b25e3604a6cd1dfb42912b0ec5976fa557b4a6de1401028b769034c6ed00fa2b'
    )
      throw changed();
    for (const script of ['gravityforms.js', 'conditional_logic.js'])
      if (
        nodes.filter(
          (n) =>
            'tagName' in n &&
            n.tagName === 'script' &&
            attr(n, 'src') ===
              `https://wuennewil-flamatt.ch/wp-content/plugins/gravityforms/js/${script}?ver=3.1.3`,
        ).length !== 1
      )
        throw changed();
    return wuennewilCategories.map((service_code) => ({
      service_code,
      service_name: service_code,
    }));
  } catch {
    throw changed();
  }
}

export function wuennewilRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    wuennewilCategories.map((category) => [
      category,
      {
        scope: wuennewilScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Wünnewil-Flamatt'],
        extra_fields: [
          {
            code: 'salutation',
            description: 'Salutation',
            required: true,
            datatype: 'string',
            values: ['Frau', 'Herr'],
            contact: true,
          },
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['contact_street', 'Your postal street and number'],
            ['contact_locality', 'Your postal locality'],
            ['contact_postcode', 'Your postcode'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            datatype: 'string',
            contact: true,
            max_length: 250,
          })),
          {
            code: 'work_phone',
            description: 'Work telephone (optional)',
            required: false,
            datatype: 'string',
            contact: true,
            max_length: 80,
          },
          {
            code: 'lighting_location',
            description: 'Actual street and number of the affected lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_locality',
            description: 'Affected lamp locality',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_district',
            description: 'Affected lamp district (optional)',
            required: false,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp number if known; never invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          ...(category === 'Anderer Defekt'
            ? [
                {
                  code: 'other_defect',
                  description: 'Other defect details (required by Civic)',
                  required: true,
                  datatype: 'string',
                  max_length: 1000,
                  translate: true,
                },
              ]
            : []),
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm a municipal public streetlamp in Wünnewil-Flamatt; exclude private lamps and emergencies',
            required: true,
            datatype: 'string',
            values: ['Municipal public streetlamp confirmed'],
          },
        ],
      } satisfies Requirements,
    ]),
  );
}
