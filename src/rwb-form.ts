import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const rwbFormUrl = 'https://www.regionalwerke.ch/kontakt-formular';
export const rwbPrivacyUrl = 'https://www.regionalwerke.ch/privat-geschaeftskunden/datenschutz';
export const rwbInvitationUrl = 'https://www.regionalwerke.ch/privat-geschaeftskunden';
export const rwbReferralUrl = 'https://www.ennetbaden.ch/verwaltung/werke/';
export const rwbCategory = 'Strom';
export const rwbScope =
  'Only nonurgent faults of actual RWB-maintained public streetlights within Ennetbaden (BFS4026). The provider explicitly refers lamp faults to its contact form. Strom is its broader native topic, narrowed locally to public lamps; downstream routing is unverified. Confirm the exact maintained public lamp and point: municipal boundaries do not prove ownership. Private fixtures, supply/gas/water outages, other assets, urgent hazards and neighbouring municipalities are excluded.';
// Complete byte pins, including the native signed state and protection references.
// Never normalize, extract, reuse or execute them; no provider prose/code in fixtures.
export const rwbSources: readonly PublicSourcePin[] = Object.freeze([
  Object.freeze({
    url: 'https://www.regionalwerke.ch/privat-geschaeftskunden',
    sha256: '92cbfcf6b17b81f039cab74fadeb8274b1fd1d5676861aefacf7fd6bf917d716',
    type: 'html',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.regionalwerke.ch/kontakt-formular',
    sha256: '48065b43a472d16d0da51071b4b9f0be792bd8925475d8432a300a0c5550de7a',
    type: 'html',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.regionalwerke.ch/privat-geschaeftskunden/datenschutz',
    sha256: '374e682740b8096efb472b6a8c2d0b93d4ef58452ab823b2b5155db7eac49c5c',
    type: 'html',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.regionalwerke.ch/typo3temp/assets/compressed/Form.min-7dfcbb09c0bfe306a2726c679048a908.js?1780292943',
    sha256: '7037693b8c703aa2362722f187fabc0b3dfe569f16129220f6e3770d29e2ac66',
    type: 'javascript',
    maxBytes: 250000,
  }),
]);
export const rwbCategories = [
  { service_code: rwbCategory, service_name: 'Defekte öffentliche Strassenbeleuchtung (Strom)' },
];
export async function loadRwbCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  await verifyPublicSourceManifest(request, rwbSources, retry, now);
  return rwbCategories.map((c) => ({ ...c }));
}
export function rwbRequirements(): Record<string, Requirements> {
  return {
    [rwbCategory]: {
      scope: rwbScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      phone_max_length: 50,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Regionalwerke AG Baden – Öffentliche Beleuchtung Ennetbaden'],
      extra_fields: [
        ...[
          ['first_name', 'First name', 100],
          ['last_name', 'Last name', 100],
          ['reporter_street', 'Your street', 250],
          ['reporter_house_number', 'Your house number', 100],
          ['contact_locality', 'Your locality', 100],
        ].map(([code, description, max_length]) => ({
          code: String(code),
          description: String(description),
          max_length: Number(max_length),
          required: true,
          datatype: 'string',
          contact: true,
        })),
        {
          code: 'contact_postcode',
          description: 'Your postcode',
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 5,
          format: 'postcode_1000_99999',
        },
        {
          code: 'salutation',
          description: 'Salutation',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Frau', 'Herr'],
        },
        {
          code: 'lighting_street',
          description: 'Actual public lamp street',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'lamp_number',
          description: 'Actual lamp number (optional)',
          required: false,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm the actual RWB-maintained public lamp in Ennetbaden',
          required: true,
          datatype: 'string',
          values: ['Public lamp in Ennetbaden maintained by RWB confirmed'],
        },
        {
          code: 'data_policy_consent',
          description: 'Provider privacy notice read and accepted',
          required: true,
          datatype: 'string',
          values: ['I have read and accept the provider privacy notice'],
        },
      ],
      notes: [
        'Nur tatsächliche öffentliche Strassenlampen im Unterhalt der RWB in Ennetbaden. Keine privaten Leuchten, Versorgungsunterbrüche, andere Anlagen oder dringenden Gefahren. Gemeindegrenzen beweisen nicht den Unterhalt.',
        'Strom ist die allgemeinere native Themenwahl. Diese lokale Vorbereitung ist auf öffentliche Lampen begrenzt; die interne Weiterleitung ist nicht verifiziert.',
        'Private Anrede, Vor-/Nachname, Strasse, Hausnummer, PLZ, Ort, E-Mail und Telefon sind erforderlich und bleiben ausserhalb der KI. Melderadresse ist nicht der Störungsort. Tatsächliche Lampenstrasse und genauer Punkt erforderlich; echte Lampennummer freiwillig, führende Nullen erhalten.',
        'Nützliche Beschreibung und lokale Textgrenzen sind konservative Ergänzungen. Das HTML verlangt die Mitteilung nicht, die Datenschutzerklärung nennt sie erforderlich. Die lokale PLZ-Darstellung ist strenger als das native Zahlenfeld ohne Bereichsgrenze. Keine Fotos.',
        'Die Datenschutzerklärung bewusst lesen und akzeptieren. Allgemeine Weitergabe an Dienstleister/Partner/Behörden und Auslandbedingungen gelten; keine feste Aufbewahrungsdauer für Lampenmeldungen oder Veröffentlichung belegt.',
        'Alles bleibt in Civic. Vier feste Quellen werden mit GET geprüft; vollständige Bytes ohne Normalisierung, Wiederverwendung signierter Werte, reCAPTCHA-/Client-Ausführung oder Übermittlung. Keine externe Fertigstellung/Statusabfrage. Bei unklarem Ausgang nicht erneut melden oder den Kanal wechseln.',
      ],
    },
  };
}
