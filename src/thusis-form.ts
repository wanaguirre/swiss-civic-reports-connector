import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const thusisFormUrl = 'https://thusis.ch/formulare/schadenmitteilung-freizeitinfrastruktur/';
export const thusisNoticeUrl =
  'https://thusis.ch/2026/06/formular-schadenmitteilungen-gemeindeinfrastruktur/';
export const thusisScope =
  'Non-emergency damage to municipal leisure facilities in Thusis, such as public playgrounds and barbecue facilities. Confirm the actual public municipal asset and exact location. Private assets, emergencies and other municipal defects are excluded.';
export const thusisCategories = [
  { service_code: 'Freizeitinfrastruktur', service_name: 'Schaden an Freizeitinfrastruktur' },
];
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () => new Error('The Thusis damage form has changed. Preparation is paused.');
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const nonce = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{10}$/.test(value)) throw changed();
  return value;
};
/** Inspect and discard read-time state only. No upload URL, nonce, client, trap,
 * AJAX or postback is executed, simulated or returned for later sending. */
export function inspectThusisForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|altcha|turnstile/i.test(html))
      throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'gform_36',
    );
    if (forms.length !== 1 || nodes.some((n) => 'tagName' in n && attr(n, 'form') === 'gform_36'))
      throw changed();
    const selected = all(forms[0]);
    if (selected.some((n) => 'tagName' in n && ['template', 'iframe'].includes(n.tagName)))
      throw changed();
    const states = selected.filter(
      (n): n is Element => 'tagName' in n && attr(n, 'name') === 'state_36',
    );
    const uploads = selected.filter(
      (n): n is Element => 'tagName' in n && attr(n, 'id') === 'gform_multifile_upload_36_4',
    );
    if (
      states.length !== 1 ||
      states[0].tagName !== 'input' ||
      attr(states[0], 'type') !== 'hidden' ||
      !/^[A-Za-z0-9+/]{55}=$/.test(attr(states[0], 'value') ?? '') ||
      uploads.length !== 1
    )
      throw changed();
    const settings = JSON.parse(attr(uploads[0], 'data-settings') ?? 'null');
    nonce(settings?.multipart_params?._gform_file_upload_nonce_36_4);
    settings.multipart_params._gform_file_upload_nonce_36_4 = '<read-time-upload-nonce>';
    const semantic = selected
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                a.name === 'value' && attr(n, 'name') === 'state_36'
                  ? '<read-time-state>'
                  : a.name === 'data-settings' && n === uploads[0]
                    ? JSON.stringify(settings)
                    : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        return 'value' in n ? n.value.replace(/\s+/g, ' ').trim() : null;
      })
      .filter((x) => x !== '' && x !== null);
    const scripts = nodes
      .filter((n): n is Element => 'tagName' in n && n.tagName === 'script')
      .map((n) => {
        let body = n.childNodes
          .map((x) => ('value' in x ? x.value : ''))
          .join('')
          .trim();
        if (attr(n, 'id') === 'gform_gravityforms_theme-js-extra') {
          const match =
            /^var gform_theme_config = (\{.*\});\s*\/\/# sourceURL=gform_gravityforms_theme-js-extra$/s.exec(
              body,
            );
          if (!match) throw changed();
          const config = JSON.parse(match[1]);
          for (const [key, value] of [
            ['ajax_submission_nonce', config?.common?.form?.ajax?.ajax_submission_nonce],
            ['config_nonce', config?.config_nonce],
          ] as const) {
            const literal = JSON.stringify(key) + ':' + JSON.stringify(nonce(value));
            if (body.split(literal).length !== 2) throw changed();
            body = body.replace(literal, JSON.stringify(key) + ':"<read-time-' + key + '>"');
          }
        }
        return [n.attrs.map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)), body];
      });
    if (
      digest(semantic) !== 'bf93da5ec2f6764f0de311af8de966cabc43a3680d71a81bbfdc26ccca3cdc63' ||
      digest(scripts) !== '4b02dd40bad0a8b6432175d071585667c92750fa90d2d2be60a48d9f81f0e276'
    )
      throw changed();
    return thusisCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function thusisRequirements(): Record<string, Requirements> {
  return {
    [thusisCategories[0].service_code]: {
      scope: thusisScope,
      photo_required: true,
      max_photos: 3,
      email_required: false,
      email_supported: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Gemeinde Thusis – Freizeitinfrastruktur'],
      extra_fields: [
        {
          code: 'municipal_leisure_asset_confirmed',
          description: 'Confirm the damaged leisure facility is a public municipal asset in Thusis',
          required: true,
          datatype: 'string',
          values: ['Municipal leisure asset in Thusis confirmed'],
        },
      ],
      notes: [
        'Nur nicht dringende Schäden an Freizeitinfrastruktur der Gemeinde Thusis, zum Beispiel Grillstellen und Spielplätze. Tatsächlichen Standort und öffentliche kommunale Zuständigkeit bestätigen.',
        'Standort, Schadenbeschreibung und Bilder sind im offiziellen Formular erforderlich. Es werden keine Kontaktdaten abgefragt; keine Kontaktdaten hinzufügen.',
        'Mindestens ein, höchstens drei Fotos. Civic entfernt eingebettete Metadaten aus den vorbereiteten Bildern.',
        'Nur lokale Vorbereitung. Die Gemeinde erhält keine Fotos oder Meldung. Senden und Statusabfrage sind noch nicht verfügbar. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
