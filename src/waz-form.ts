import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const wazFormUrl =
  'https://www.werkezuerichsee.ch/formulare/stoerungsmeldung-strassenbeleuchtung';
export const wazCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Leuchte beschädigt',
  'Störender Lichtkegel',
  'Anderer Defekt',
] as const;
export const wazScope =
  'Non-emergency public street-lighting defects maintained by Werke am Zürichsee within the selected municipality. Individual resident reports only; not company reports, private lighting, electricity outages or other municipal defects.';
const handle = 'stoerungsmeldungStrassenbeleuchtung';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (node: Node): Element[] => [
  ...('tagName' in node ? [node] : []),
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const attr = (node: Element, key: string) => node.attrs.find((a) => a.name === key)?.value;
const text = (node: Node): string =>
  'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
const changed = () =>
  new Error('The Werke am Zürichsee lighting form has changed. Preparation is paused.');
// Names alone are misleading: vorname is the conditional company, name is first name.
const fields = [
  ['vorname', 'text', true, 'Firma'],
  ['name1', 'text', true, 'Name'],
  ['name', 'text', true, 'Vorname'],
  ['strasseHausnummer', 'text', false, 'Strasse/Hausnummer'],
  ['plz', 'text', true, 'PLZ'],
  ['ort', 'text', true, 'Ort'],
  ['telefon', 'text', true, 'Telefon'],
  ['emailAddress', 'email', true, 'E-Mail'],
  ['message', 'textarea', false, 'Kandelabernummer'],
  ['strasseHausnummer1', 'text', true, 'Strasse'],
  ['strasseHausnummerDerBeleuchtung', 'text', false, 'Hausnummer'],
  ['plz1', 'text', true, 'PLZ'],
  ['ort1', 'text', true, 'Ort'],
  ['beschreibungDesDefekts', 'textarea', true, 'Beschreibung des Defekts'],
  ['betroffeneStrassenlampe', 'textarea', false, 'Bemerkungen'],
] as const;
const hidden = { action: 'formie/submissions/submit', submitAction: 'submit', handle, siteId: '1' };

/** Read-only contract inspection. Tokens are never retained or refreshed; there is no POST transport. */
export function inspectWazForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const doc = all(parse(html));
    const forms = doc.filter((n) => n.tagName === 'form' && attr(n, 'data-form-handle') === handle);
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      nodes = all(form);
    if (
      attr(form, 'method') !== 'post' ||
      attr(form, 'enctype') !== 'multipart/form-data' ||
      new URL(attr(form, 'action') ?? '', wazFormUrl).href !== wazFormUrl ||
      attr(form, 'data-form-submit-method') !== 'ajax' ||
      attr(form, 'data-form-submit-action') !== 'message'
    )
      throw changed();
    const config = JSON.parse(attr(form, 'data-fui-form') ?? '{}');
    if (
      config.formId !== 565 ||
      config.formHandle !== handle ||
      config.settings?.submitMethod !== 'ajax' ||
      config.settings?.submitAction !== 'message' ||
      config.settings?.hasMultiplePages !== false ||
      config.settings?.currentPageId !== 9 ||
      config.settings?.pages?.length !== 1 ||
      config.settings.pages[0].id !== 9 ||
      config.settings.pages[0].settings?.enablePageConditions !== false ||
      config.settings?.baseActionUrl !== 'https://www.werkezuerichsee.ch/index.php?p=actions' ||
      config.settings?.refreshTokenUrl !==
        'https://www.werkezuerichsee.ch/index.php?p=actions/formie/forms/refresh-tokens&form=FORM_PLACEHOLDER'
    )
      throw changed();
    const modules = config.registeredJs?.map((m: { module: string }) => m.module);
    if (JSON.stringify(modules) !== JSON.stringify(['FormieCheckboxRadio', 'FormieConditions']))
      throw changed();
    if (
      /captcha|turnstile|challenge/i.test(JSON.stringify(config)) ||
      nodes.some(
        (n) =>
          n.tagName === 'iframe' ||
          /captcha|turnstile|challenge/i.test(
            ['id', 'name', 'class', 'src'].map((k) => attr(n, k)).join(' '),
          ),
      )
    )
      throw changed();
    const controls = nodes.filter((n) =>
      ['input', 'textarea', 'select', 'button'].includes(n.tagName),
    );
    if (
      controls.length !== 32 ||
      controls.some((n) =>
        ['disabled', 'readonly', 'form', 'formaction', 'multiple'].some(
          (k) => attr(n, k) !== undefined,
        ),
      )
    )
      throw changed();
    const find = (name: string) => controls.filter((n) => attr(n, 'name') === name);
    for (const [name, value] of Object.entries(hidden)) {
      const found = find(name);
      if (
        found.length !== 1 ||
        attr(found[0], 'type') !== 'hidden' ||
        attr(found[0], 'value') !== value
      )
        throw changed();
    }
    for (const name of ['CRAFT_CSRF_TOKEN', 'returnUrl']) {
      const found = find(name);
      if (found.length !== 1 || attr(found[0], 'type') !== 'hidden' || !attr(found[0], 'value'))
        throw changed();
    }
    for (const [name, type, required, label] of fields) {
      const found = find(`fields[${name}]`);
      if (found.length !== 1) throw changed();
      const n = found[0];
      if (
        (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
        (attr(n, 'required') !== undefined) !== required
      )
        throw changed();
      const labels = nodes.filter((l) => l.tagName === 'label' && attr(l, 'for') === attr(n, 'id'));
      if (
        !attr(n, 'id') ||
        labels.length !== 1 ||
        text(labels[0])
          .replace(/\s*\*\s*$/, '')
          .trim() !== label
      )
        throw changed();
      if (attr(n, 'maxlength') !== undefined) throw changed();
    }
    for (const [name, values, required] of [
      ['anrede1', ['Frau', 'Herr', 'Keine Angabe', 'Firma'], false],
      ['artDesSchadens', wazCategories, true],
    ] as const) {
      const found = find(`fields[${name}]`);
      if (
        found.length !== values.length ||
        found.some(
          (n, i) =>
            attr(n, 'type') !== 'radio' ||
            attr(n, 'value') !== values[i] ||
            (attr(n, 'required') !== undefined) !== required ||
            attr(n, 'checked') !== undefined,
        )
      )
        throw changed();
    }
    const conditions = nodes.filter((n) => attr(n, 'data-field-conditions') !== undefined);
    if (conditions.length !== 2) throw changed();
    for (const [target, field, value] of [
      ['vorname', 'anrede1', 'Firma'],
      ['beschreibungDesDefekts', 'artDesSchadens', 'Anderer Defekt'],
    ]) {
      const matches = conditions.filter((n) =>
        all(n).some((c) => attr(c, 'name') === `fields[${target}]`),
      );
      const expected = {
        showRule: 'show',
        conditionRule: 'all',
        conditions: [{ field: `fields[${field}]`, condition: '=', value }],
        isNested: false,
      };
      if (
        matches.length !== 1 ||
        JSON.stringify(JSON.parse(attr(matches[0], 'data-field-conditions')!)) !==
          JSON.stringify(expected)
      )
        throw changed();
    }
    const honey = find('beesknees'),
      buttons = controls.filter((n) => n.tagName === 'button');
    if (
      honey.length !== 1 ||
      attr(honey[0], 'type') !== 'text' ||
      attr(honey[0], 'required') !== undefined ||
      (attr(honey[0], 'value') ?? '') !== '' ||
      buttons.length !== 1 ||
      attr(buttons[0], 'type') !== 'submit' ||
      attr(buttons[0], 'data-submit-action') !== 'submit'
    )
      throw changed();
    return wazCategories.map((name) => ({ service_code: name, service_name: name }));
  } catch {
    throw changed();
  }
}

export function wazRequirements(municipality: string): Record<string, Requirements> {
  const extras = [
    ['first_name', 'First name', true, true],
    ['last_name', 'Last name', true, true],
    ['reporter_postcode', 'Reporter postal code', true, true],
    ['reporter_locality', 'Reporter locality', true, true],
    ['reporter_address', 'Reporter street and house number (optional)', false, true],
    ['lighting_street', 'Street of the defective light', true, false],
    ['lighting_postcode', 'Postal code of the defective light', true, false],
    ['lighting_locality', 'Locality of the defective light', true, false],
    ['lighting_house_number', 'House number near the light (optional)', false, false],
    ['lamp_number', 'Actual pole number, if known; do not invent one', false, false],
  ] as const;
  return Object.fromEntries(
    wazCategories.map((category) => [
      category,
      {
        scope: wazScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: [municipality],
        extra_fields: extras.map(([code, description, required, contact]) => ({
          code,
          description,
          required,
          contact,
          datatype: 'string',
          max_length: 100,
        })),
        notes: [
          'Nur öffentliche Strassenbeleuchtung in der gewählten Gemeinde; keine Stromausfälle oder privaten Lampen.',
          'Privatpersonen: Vorname, Nachname, Kontakt-PLZ, Kontakt-Ort, Telefon und E-Mail sind erforderlich. Firmenmeldungen werden hier nicht unterstützt; Anrede und Firma bleiben leer.',
          'Strasse, PLZ und Ort der defekten Leuchte separat angeben. Hausnummer und bekannte Kandelabernummer sind freiwillig.',
          'Bei «Anderer Defekt» ist eine Beschreibung erforderlich; Civic verlangt für jeden Entwurf eine Beschreibung.',
          'Reine Textmeldung: Quellfotos dürfen beim Entwurf helfen, werden ausdrücklich von der Übermittlung ausgeschlossen.',
          'Vorbereitung nur in Civic. Keine Übermittlung, kein Empfangsnachweis und keine Statusabfrage verifiziert. Bei unklarem Ausgang niemals automatisch erneut senden.',
        ],
      } satisfies Requirements,
    ]),
  );
}
