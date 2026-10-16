import { parse, type DefaultTreeAdapterMap } from 'parse5';
const FORM = 'https://www.ebikon.ch/form/schaden-melden';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
export const ebikonCategories = [
  'Signalisation',
  'Sitzbank oder Abfalleimer',
  'Spielplatz oder Sportanlage',
  'Grünanlage oder Baum',
  'Gewässer',
  'WC-Anlagen',
  'Öffentliche Liegenschaft',
  'Anderer Schaden',
];
/** Inspect the public first step only. A valid CSRF token does not establish
 * permission to submit, second-step behavior, upload acceptance or a receipt. */
export function inspectEbikonForm(html: string) {
  const changed = () => new Error('Ebikon’s public form contract changed. Preparation is paused.');
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const page = all(parse(html)),
    forms = page.filter((n) => n.tagName === 'form' && attr(n, 'id') === 'main-form');
  if (forms.length !== 1) throw changed();
  const form = forms[0],
    nodes = all(form);
  if (
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    new URL(attr(form, 'action') ?? '', FORM).href !== FORM
  )
    throw changed();
  if (
    page.some((n) => attr(n, 'form') === 'main-form') ||
    nodes.some(
      (n) =>
        ['iframe', 'object'].includes(n.tagName) ||
        /captcha|turnstile|challenge/i.test(
          ['name', 'class', 'id', 'src'].map((k) => attr(n, k)).join(' '),
        ) ||
        (n.tagName === 'fieldset' && attr(n, 'disabled') !== undefined),
    )
  )
    throw changed();
  const controls = nodes.filter((n) =>
    ['input', 'textarea', 'select', 'button'].includes(n.tagName),
  );
  const definitions: [string, string, boolean, string?][] = [
    ['csrf_token', 'hidden', false],
    ['personalien_vorname', 'text', true],
    ['personalien_name', 'text', true],
    ['personalien_e_mail', 'email', true],
    ['personalien_telefon', 'text', false],
    ['was_mochten_sie_melden_auswahl_beschrieb', 'text', false],
    [
      'wo_befindet_sich_der_schaden_strasse_hausnummer_oder_genaue_beschreibung_des_ortes_',
      'text',
      true,
      '150',
    ],
    [
      'wo_befindet_sich_der_schaden_beschreiben_sie_den_schaden_moglichst_genau_',
      'text',
      true,
      '400',
    ],
    ['foto_hochladen_ein_foto_hilft_uns_den_schaden_zu_beurteilen_', 'file', false],
    ['duplicate_of', 'text', false],
  ];
  if (controls.length !== definitions.length + ebikonCategories.length + 1) throw changed();
  for (const [name, type, required, max] of definitions) {
    const found = controls.filter((n) => attr(n, 'name') === name);
    if (found.length !== 1) throw changed();
    const n = found[0];
    if (
      n.tagName !== 'input' ||
      attr(n, 'type') !== type ||
      (attr(n, 'aria-required') !== undefined) !== required ||
      attr(n, 'maxlength') !== max
    )
      throw changed();
    if (name === 'csrf_token' && !/^[a-zA-Z0-9_#.-]{20,500}$/.test(attr(n, 'value') ?? ''))
      throw changed();
    if (type === 'file' && attr(n, 'accept') !== 'image/heic,image/jpeg,image/png,image/gif')
      throw changed();
    if (name === 'duplicate_of' && (attr(n, 'value') !== '' || attr(n, 'class') !== 'lazy-wolves'))
      throw changed();
    if (
      name === 'was_mochten_sie_melden_auswahl_beschrieb' &&
      attr(n, 'data-depends-on') !== 'was_mochten_sie_melden_auswahl/Anderer Schaden'
    )
      throw changed();
  }
  for (const n of controls)
    if (
      ['disabled', 'readonly', 'form', 'formaction', 'multiple', 'required', 'checked'].some(
        (k) => attr(n, k) !== undefined,
      )
    )
      throw changed();
  const radios = controls.filter((n) => attr(n, 'name') === 'was_mochten_sie_melden_auswahl');
  if (
    radios.length !== 8 ||
    new Set(radios.map((n) => attr(n, 'value'))).size !== 8 ||
    radios.some(
      (n) =>
        attr(n, 'type') !== 'radio' ||
        attr(n, 'aria-required') === undefined ||
        !ebikonCategories.includes(attr(n, 'value') ?? ''),
    )
  )
    throw changed();
  const submit = controls.filter((n) => attr(n, 'type') === 'submit');
  if (
    submit.length !== 1 ||
    attr(submit[0], 'name') !== undefined ||
    attr(submit[0], 'value') !== 'Weiter'
  )
    throw changed();
  return ebikonCategories.map((service_name) => ({ service_code: service_name, service_name }));
}
