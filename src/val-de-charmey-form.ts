import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const valDeCharmeyFormUrl =
  'https://val-de-charmey.ch/administration/guichet-virtuel/signalement-de-defauts/';
export const valDeCharmeyCategory = 'Signalement de défauts';
export const valDeCharmeyScope =
  'Non-emergency defects in municipal public spaces in Val-de-Charmey, including faulty streetlights, impassable paths and vandalism. Excludes emergencies, private-property disputes and administrative requests. Confirm the exact place and municipal responsibility. Reports, coordinates and any attached photo are intended for public publication; keep personal and sensitive information out.';
const changed = () =>
  new Error('The Val-de-Charmey defect form has changed. Preparation is paused.');
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Node, key: string) =>
  'attrs' in n ? n.attrs.find((a) => a.name === key)?.value : undefined;
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v !== null && typeof v === 'object'
      ? `{${Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
          .join(',')}}`
      : JSON.stringify(v);
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw changed();
  return v as Record<string, unknown>;
};
/** Read a complete JSON configuration literal as data, never execute page scripts. */
function literal(source: string, name: string): Record<string, unknown> {
  const matches = [...source.matchAll(new RegExp(`\\bvar\\s+${name}\\s*=\\s*`, 'g'))];
  if (matches.length !== 1) throw changed();
  const start = matches[0].index! + matches[0][0].length;
  let depth = 0,
    quote = false,
    escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quote = false;
    } else if (c === '"') quote = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) {
        if (!/^\s*;/.test(source.slice(i + 1))) throw changed();
        return record(JSON.parse(source.slice(start, i + 1)));
      }
    } else if (!depth && !/\s/.test(c)) throw changed();
  }
  throw changed();
}

export function inspectValDeCharmeyForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n) => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'cspmsl_form',
    );
    if (forms.length !== 1) throw changed();
    const selected = all(forms[0]);
    if (selected.filter((n) => attr(n, 'name') === 'nonce_CMB2phpcspmsl_form').length !== 1)
      throw changed();
    // Only the dynamic nonce value is normalized; the honeypot, empty controls,
    // labels, validation, hidden constants, upload and coordinate attributes stay pinned.
    const semantic = selected
      .map((n) =>
        'tagName' in n
          ? [
              n.tagName,
              n.attrs
                .map((a) => [
                  a.name,
                  attr(n, 'name') === 'nonce_CMB2phpcspmsl_form' && a.name === 'value'
                    ? '[dynamic nonce]'
                    : a.value,
                ])
                .sort(([a], [b]) => a.localeCompare(b)),
            ]
          : 'value' in n
            ? n.value.replace(/\s+/g, ' ').trim()
            : null,
      )
      .filter((v) => v !== '' && v !== null);
    if (hash(semantic) !== '276ec7742379d0f06f38ac766c7458b9d6cd7a63ef6254a3fe2d87dbfb433a1f')
      throw changed();
    const scripts = nodes.filter((n) => 'tagName' in n && n.tagName === 'script');
    const source = scripts
      .filter((n) => !attr(n, 'src'))
      .map((n) =>
        'childNodes' in n ? n.childNodes.map((c) => ('value' in c ? c.value : '')).join('') : '',
      )
      .join('\n');
    const vars = literal(source, 'cspmsl_vars'),
      form = literal(source, 'cspmsl_form_vars'),
      map = literal(source, 'progress_map_vars');
    if (typeof form.cspmsl_ajax_nonce !== 'string' || !form.cspmsl_ajax_nonce) throw changed();
    form.cspmsl_ajax_nonce = '[dynamic nonce]';
    const selectedMap = record(record(map.map_script_args).map3044);
    // Full selected map settings include anonymous/publication/protection options,
    // invisible media fields and status taxonomy. Never infer a provider category
    // or status ID from those settings. Exclude resident listing data entirely.
    if (
      hash([vars, form, map.ajax_url, selectedMap.map_object_id, selectedMap.map_settings]) !==
      '2dc0e9b444b30110c4ee888432e9d86dc9f60bac0991775a105ad3992bdce765'
    )
      throw changed();
    for (const asset of [
      'progress-map-submit-locations/assets/js/main/main.min.js?ver=2.1',
      'codespacing-progress-map/assets/js/main/progress_map.min.js?ver=5.7.3',
      'codespacing-progress-map/admin/libs/metabox-cs-file-input/js/script.js?ver=1.0',
      'codespacing-progress-map/admin/libs/metabox-cs-gmaps/js/script.js?ver=1.1',
      'codespacing-progress-map/admin/libs/metabox/js/cmb2.min.js?ver=2.10.1',
    ])
      if (
        scripts.filter(
          (n) => attr(n, 'src') === `https://val-de-charmey.ch/wp-content/plugins/${asset}`,
        ).length !== 1
      )
        throw changed();
    // Local routing class only: the selected municipal form has no category selector.
    return [{ service_code: 'signalement-de-defauts', service_name: valDeCharmeyCategory }];
  } catch {
    throw changed();
  }
}

export function valDeCharmeyRequirements(): Record<string, Requirements> {
  return {
    [valDeCharmeyCategory]: {
      scope: valDeCharmeyScope,
      photo_required: false,
      max_photos: 1,
      max_photo_bytes: 5_000_000,
      email_required: false,
      email_supported: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Val-de-Charmey'],
      extra_fields: [
        {
          code: 'report_title',
          description: 'Titre du défaut',
          required: true,
          datatype: 'string',
          max_length: 100,
          translate: true,
        },
        {
          code: 'public_space_confirmed',
          description:
            'Confirmer un défaut non urgent dans un espace public communal de Val-de-Charmey',
          required: true,
          datatype: 'string',
          values: ['Espace public communal de Val-de-Charmey confirmé'],
        },
        {
          code: 'public_publication_choice',
          description:
            'Le titre, les détails, la position et la photo jointe sont destinés à être publics. Choisir vous-même après vérification',
          required: true,
          datatype: 'string',
          values: ['Je souhaite préparer ce contenu pour publication publique'],
        },
      ],
      notes: [
        'Formulaire sans coordonnées du déclarant. Ne pas inclure votre nom, adresse e-mail, téléphone ou autre information personnelle dans le texte ou la photo.',
        'Le titre, les détails, la position et toute photo jointe sont destinés à être publiés. Vérifiez les personnes, plaques et informations sensibles visibles. Votre choix est conservé localement ; Civic ne publie rien.',
        'Une photo facultative. Civic prépare un JPEG de 5 Mo maximum, un titre de 100 caractères et un texte de 5000 caractères. Ce sont des limites de préparation de Civic.',
        'Confirmez la position exacte du défaut et la responsabilité de la commune pour cet espace public.',
        'Préparation uniquement : Civic ne transmet et ne publie rien. L’envoi et le suivi ne sont pas encore disponibles. Si un envoi est incertain, ne renvoyez pas le même signalement par un autre canal.',
      ],
    },
  };
}
