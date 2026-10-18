import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';
export const ewsennwaldFormUrl =
  'https://www.ewsennwald.ch/de/stromversorgung/strassenbeleuchtung/meldeformular-beleuchtung';
export const ewsennwaldMandateUrl =
  'https://www.ewsennwald.ch/de/stromversorgung/strassenbeleuchtung';
export const isEwsennwaldMunicipality = (name: string) =>
  name === 'ewsennwald-sennwald' || name === 'ewsennwald-altstaetten';
export const ewsennwaldVillages = (bfs: number) => {
  if (bfs === 3274) return ['Sennwald', 'Salez'];
  if (bfs === 3251) return ['Lienz', 'Plona'];
  throw new Error('Outside the reviewed EW Sennwald village scope.');
};
export const ewsennwaldScope = (bfs: number) =>
  `Non-emergency municipal public streetlight faults handled by EW Sennwald only in ${ewsennwaldVillages(bfs).join(' and ')} (BFS${bfs}). The provider explicitly names a municipal mandate for these villages. The resident must confirm the actual village and municipal public lamp. Other villages, private fixtures, power outages and other municipal defects are excluded. A municipal point and resident choice do not independently verify the village boundary or lamp ownership.`;
export const ewsennwaldCategories = [
  'Lampe leuchtet nicht',
  'Lampe leuchtet nur zeitweise',
  'Lampe ist zerstört',
  'Masttürchen fehlt',
  'Sonstiger Defekt',
].map((label) => ({ service_code: label, service_name: label }));
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const changed = () =>
  new Error('The EW Sennwald lighting form has changed. Preparation is paused.');
const signedPrefixes: Record<string, string> = {
  'tx_powermail_pi1[__referrer][arguments]': 'YTowOnt9',
  'tx_powermail_pi1[__referrer][@request]':
    '{"@extension":"Powermail","@controller":"Form","@action":"form"}',
  'tx_powermail_pi1[__trustedProperties]':
    '{"field":{"strasse":1,"mast_nr":1,"datum":1,"defekt":1,"bemerkungen":1,"name":1,"vorname":1,"adresse":1,"plzort":1,"e_mail":1,"telefon":1,"__hp":1},"mail":{"form":1}}',
};
const scripts: string[] = [
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/mail.js?1713192783',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/jquery/jquery-3.6.0.min.js?1713192852',
  '/typo3conf/ext/cs_seo/Resources/Public/JavaScript/cs_seo.ga.js?1713192780',
  '/typo3conf/ext/ws_slider/Resources/Public/JavaScript/Owl/owl.carousel.min.js?1713192882',
  '/typo3conf/ext/ws_slider/Resources/Public/JavaScript/Flexslider/jquery.flexslider.min.js?1713192881',
  '/typo3conf/ext/ws_slider/Resources/Public/JavaScript/TinySlider/tiny-slider.min.js?1713192882',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/bootstrap/popper.min.js?1713192851',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/bootstrap/bootstrap.min.js?1713192851',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/smartmenus/jquery.smartmenus.min.js?1713192853',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/smartmenus/jquery.smartmenus.bootstrap.min.js?1713192853',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/mmenu/mmenu.js?1713192853',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/jquery/jquery.matchHeight.min.js?1713192852',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/jquery/scrolltotop.min.js?1713192852',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/improvements/inter-element-anchors.min.js?1713192852',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/improvements/prevent-link.min.js?1713192852',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/main.js?1713192783',
  '/typo3conf/ext/cookieman/Resources/Public/Js/js.cookie.min.js?1713192776',
  '/typo3conf/ext/cookieman/Resources/Public/Js/cookieman.min.js?1713192776',
  '/typo3conf/ext/cookieman/Resources/Public/Themes/bootstrap4-modal/cookieman-theme.min.js?1713192833',
  '/typo3conf/ext/cookieman/Resources/Public/Js/cookieman-init.min.js?1713192776',
  '/typo3temp/assets/js/cfd16b174d7f7b046e20adbc2e0a1094.js?1713193024',
  '/typo3conf/ext/demotemplate/Resources/Public/JavaScript/glightbox/glightbox.min.js?1713192852',
  '/typo3conf/ext/powermail/Resources/Public/JavaScript/Powermail/Form.min.js?1726669271',
];
/** Pin the complete selected form, validation and protection semantics and exact published client references.
 * Signed read-time suffixes are shape checked, masked and discarded. No signature, honeypot, client or POST is simulated or executed. */
export function inspectEwsennwaldForm(html: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html));
    const forms = nodes.filter(
      (n): n is Element =>
        'tagName' in n &&
        n.tagName === 'form' &&
        attr(n, 'class')?.split(/\s+/).includes('powermail_form_4') === true,
    );
    if (forms.length !== 1) throw changed();
    const selected = all(forms[0]);
    if (/captcha|turnstile|challenge/i.test(html)) throw changed();
    for (const [name, prefix] of Object.entries(signedPrefixes)) {
      const fields = selected.filter(
        (n): n is Element => 'tagName' in n && n.tagName === 'input' && attr(n, 'name') === name,
      );
      const value = fields.length === 1 ? (attr(fields[0], 'value') ?? '') : '';
      if (
        fields.length !== 1 ||
        attr(fields[0], 'type') !== 'hidden' ||
        value.slice(0, -40) !== prefix ||
        !/^[a-f0-9]{40}$/.test(value.slice(-40))
      )
        throw changed();
    }
    const semantic = selected
      .map((n) =>
        'tagName' in n
          ? [
              n.tagName,
              n.attrs
                .map((a) => [
                  a.name,
                  a.name === 'value' && signedPrefixes[attr(n, 'name') ?? '']
                    ? signedPrefixes[attr(n, 'name') ?? ''] + '<read-time-signature>'
                    : a.value,
                ])
                .sort(([a], [b]) => a.localeCompare(b)),
            ]
          : 'value' in n
            ? n.value.replace(/\s+/g, ' ').trim()
            : null,
      )
      .filter((x) => x !== '' && x !== null);
    if (
      createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !==
      'b2102ee13ad9f759e43a181b8c3636a98fcd88d10560a8cbf2595d711c7d1be9'
    )
      throw changed();
    const clientNodes = nodes.filter((n): n is Element => 'tagName' in n && n.tagName === 'script');
    if (
      clientNodes.some((n) => !attr(n, 'src')) ||
      JSON.stringify(clientNodes.map((n) => attr(n, 'src'))) !== JSON.stringify(scripts)
    )
      throw changed();
    return ewsennwaldCategories.map((c) => ({ ...c }));
  } catch {
    throw changed();
  }
}
export function ewsennwaldRequirements(bfs: number): Record<string, Requirements> {
  const villages = ewsennwaldVillages(bfs);
  return Object.fromEntries(
    ewsennwaldCategories.map((c) => [
      c.service_code,
      {
        scope: ewsennwaldScope(bfs),
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: false,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['EW Sennwald'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['contact_address', 'Your postal street address; not the lamp location'],
            [
              'contact_postcode_locality',
              'Your postal postcode and locality; not the lamp location',
            ],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 250,
          })),
          {
            code: 'lighting_street',
            description: 'Street of the defective public lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lighting_village',
            description: `Confirm the actual lamp village: ${villages.join(' or ')}`,
            required: true,
            datatype: 'string',
            values: villages,
          },
          {
            code: 'lamp_number',
            description: 'Actual mast number if known; never invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'noticed_date',
            description: 'When you noticed the fault, if known; enter the actual date yourself',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm a municipal public lamp in the selected village maintained by EW Sennwald',
            required: true,
            datatype: 'string',
            values: ['Municipal public lamp in selected EW Sennwald village confirmed'],
          },
        ],
        notes: [
          `Nur öffentliche Strassenlampen in ${villages.join(' oder ')}. EW Sennwald unterhält diese Beleuchtung im Auftrag der politischen Gemeinden Sennwald und Altstätten. Andere Dörfer, private Leuchten und Stromausfälle sind ausgeschlossen.`,
          'Vorname, Nachname, eigene Postadresse mit PLZ/Ort und E-Mail sind erforderlich. Telefon ist freiwillig. Der Standort der Lampe bleibt von Ihrer Kontaktadresse getrennt.',
          'Tatsächlichen Lampenstandort und das zutreffende Dorf bestätigen. Wenn bekannt, die echte Mastnummer und das Datum der Beobachtung selbst angeben; nichts erfinden.',
          'Keine Fotoanhänge. Quellfotos müssen ausdrücklich vom Bericht ausgeschlossen werden.',
          'Nur Vorbereitung. Senden, externe Erledigung und Statusabfrage sind nicht verfügbar. Bei unklarem Ausgang niemals automatisch erneut melden oder einen anderen Sendekanal verwenden.',
        ],
      } as Requirements,
    ]),
  );
}
