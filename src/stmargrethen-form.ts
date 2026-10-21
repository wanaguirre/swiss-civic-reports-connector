import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const stmargrethenFormUrl =
  'https://www.stmargrethen.ch/special/stoerungsmeldung-strassenbeleuchtung.html/368/l/de';
export const stmargrethenReferralUrl =
  'https://www.stmargrethen.ch/politik-verwaltung/verwaltung/online-schalter.html/296';
export const stmargrethenCategory = 'Strassenbeleuchtung';
export const stmargrethenScope =
  'Non-emergency faults of municipal public streetlights in St. Margrethen. Confirm the actual public lamp location and responsibility. Not private lights, electricity outages or other municipal defects.';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () =>
  new Error('The St. Margrethen lighting form has changed. Preparation is paused.');
/** Pin the entire selected builder, including its client validation. Technical interaction fields are read, checked and discarded, never simulated or submitted. */
export function inspectStmargrethenForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000 || /captcha|turnstile|challenge/i.test(html))
      throw changed();
    const forms = all(parse(html)).filter(
      (n): n is Element =>
        'tagName' in n &&
        n.tagName === 'form' &&
        all(n).some(
          (x) => 'tagName' in x && attr(x, 'name') === 'formId' && attr(x, 'value') === '161',
        ),
    );
    if (forms.length !== 1) throw changed();
    const form = forms[0],
      builder = form.parentNode;
    if (
      !builder ||
      !('tagName' in builder) ||
      builder.tagName !== 'div' ||
      attr(builder, 'class') !== 'form-builder js-form-builder'
    )
      throw changed();
    const nodes = all(builder),
      inputs = all(form).filter((n): n is Element => 'tagName' in n && n.tagName === 'input');
    const dynamic: Element[] = [];
    for (const cls of ['cffp_mm', 'cffp_kp']) {
      const matches = inputs.filter((n) => attr(n, 'class') === cls);
      if (
        matches.length !== 1 ||
        attr(matches[0], 'type') !== 'hidden' ||
        attr(matches[0], 'value') !== ''
      )
        throw changed();
      dynamic.push(matches[0]);
    }
    const stamps = inputs.filter(
      (n) =>
        attr(n, 'type') === 'hidden' &&
        /^formfield\d{10}$/.test(attr(n, 'name') ?? '') &&
        attr(n, 'class') === undefined,
    );
    const honeypots = inputs.filter((n) => attr(n, 'id') === 'cffp_ef');
    if (
      stamps.length !== 1 ||
      !/^\d{13}$/.test(attr(stamps[0], 'value') ?? '') ||
      honeypots.length !== 1 ||
      attr(honeypots[0], 'type') !== 'text' ||
      attr(honeypots[0], 'value') !== ''
    )
      throw changed();
    dynamic.push(stamps[0], honeypots[0]);
    if (
      new Set(dynamic.map((n) => attr(n, 'name'))).size !== 4 ||
      dynamic.some((n) => !/^formfield\d{10}$/.test(attr(n, 'name') ?? ''))
    )
      throw changed();
    for (const [name, size] of [
      ['token', 64],
      ['submitionKey', 24],
    ] as const) {
      const fields = inputs.filter((n) => attr(n, 'name') === name);
      if (
        fields.length !== 1 ||
        attr(fields[0], 'type') !== 'hidden' ||
        !new RegExp(`^[A-Fa-f0-9]{${size}}$`).test(attr(fields[0], 'value') ?? '')
      )
        throw changed();
    }
    const semantic = nodes
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                a.name === 'name' && dynamic.includes(n)
                  ? `formfield${dynamic.indexOf(n)}`
                  : a.name === 'value' && n === stamps[0]
                    ? '<technical-time>'
                    : a.name === 'value' &&
                        n.tagName === 'input' &&
                        ['token', 'submitionKey'].includes(attr(n, 'name') ?? '')
                      ? '<technical-value>'
                      : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in n) return n.value.replace(/\s+/g, ' ').trim();
        return null;
      })
      .filter((x) => x !== '' && x !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      '5755143d6af8b21384389c3121db85cc260e08572fc5d0ed5757539d1946468b'
    )
      throw changed();
    return [{ service_code: stmargrethenCategory, service_name: stmargrethenCategory }];
  } catch {
    throw changed();
  }
}
export function stmargrethenRequirements(): Record<string, Requirements> {
  return {
    [stmargrethenCategory]: {
      scope: stmargrethenScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['St. Margrethen'],
      extra_fields: [
        {
          code: 'first_name',
          description: 'First name',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'last_name',
          description: 'Last name',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'lighting_street',
          description: 'Street of the defective public lamp',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'lighting_house_number',
          description: 'Nearby house number (optional)',
          required: false,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'lighting_location',
          description: 'Description identifying the actual lamp location',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
      ],
      notes: [
        'Nur defekte öffentliche Strassenlampen in St. Margrethen. Tatsächlichen Standort und kommunale Zuständigkeit bestätigen.',
        'Vorname, Name, Telefon, Strasse und Beschreibung des Lampenstandorts sind erforderlich. Eine nahe Hausnummer ist freiwillig. Kein E-Mail-Feld und keine Reporteradresse; Konto-E-Mail bleibt ausgeschlossen.',
        'Keine Lampennummer erfinden. Civic verlangt zusätzlich eine nützliche Fehlerbeschreibung.',
        'Reine Textvorbereitung: Quellfotos ausdrücklich ausschliessen. Senden, externe Erledigung und Statusabfrage bleiben nicht verfügbar.',
        'Annahme und Empfang sind nicht verifiziert. Bei unklarem Ausgang niemals automatisch erneut senden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
