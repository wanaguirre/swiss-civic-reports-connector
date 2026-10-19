import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const ewnFormUrl = 'https://www.ewn-neuenhof.ch/kundencenter/strassenleuchte-defekt/';
export const ewnPrivacyUrl = 'https://www.ewn-neuenhof.ch/datenschutz/';
export const ewnReferralUrl = 'https://www.neuenhof.ch/';
export const ewnScope =
  'Only nonurgent faults of actual EWN-maintained public streetlights within Neuenhof (BFS4034), at the confirmed lamp point. A municipality boundary does not prove lamp ownership. Give the actual street and real candelabrum number OR precise location; never invent a number. Private fixtures, supply/water outages, other assets, immediate danger and neighbouring municipalities are excluded.';
// Factual complete byte pins only. Never extract/reuse signed native state,
// execute first-party scripts or load/solve hCaptcha. No provider code in fixtures.
export const ewnSources: readonly PublicSourcePin[] = Object.freeze([
  Object.freeze({
    url: 'https://www.ewn-neuenhof.ch/kundencenter/strassenleuchte-defekt/',
    sha256: '3574afaaa8e8f37d207c2fbbc74555444cb1419e9401943af2fe71b10fe36ce8',
    type: 'html',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.ewn-neuenhof.ch/datenschutz/',
    sha256: 'b8fad6652deb76bbfa8c1a913aba3ae49e8928edcc6433b6de5a21bc2f0ad509',
    type: 'html',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.ewn-neuenhof.ch/typo3temp/assets/compressed/merged-9d466695ae11ae262db999890161550c-min.js?1791241500',
    sha256: 'c63ac0438ba6b95ec913dcc620e6e76b9041bc23dc957cd020c9b991a8d74680',
    type: 'javascript',
    maxBytes: 500000,
  }),
  Object.freeze({
    url: 'https://www.ewn-neuenhof.ch/typo3temp/assets/compressed/merged-a855f8e7e4f0e2d2dc65d3a35546cbad-min.js?1791241500',
    sha256: '630e8b4e97abc0ed54212b7654a955ecab1e782447c927a11ad5fa3c8e6a146a',
    type: 'javascript',
    maxBytes: 1000000,
  }),
  Object.freeze({
    url: 'https://www.ewn-neuenhof.ch/typo3temp/assets/compressed/7f6f4007061a3385249e7e32f51dfafe-9e6a1d49a3f68a36e2613d6ce0d31efe-min.js?1791241500',
    sha256: '1735f8895d7c85b1e121014e305bf5aeafc392e203c6a60039bc46ac3133745f',
    type: 'javascript',
    maxBytes: 10000,
  }),
]);
// Preserve the provider's first checkbox value typo; labels may be translated.
export const ewnCategories = [
  { service_code: 'euchte brennt nicht', service_name: 'Leuchte brennt nicht' },
  ...[
    'Leuchte brennt unregelmässig',
    'Kandelaber zerstört',
    'Kandelabertürchen fehlt',
    'Andere Defekte',
  ].map((service_code) => ({ service_code, service_name: service_code })),
];
export async function loadEwnCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  await verifyPublicSourceManifest(request, ewnSources, retry, now);
  return ewnCategories.map((c) => ({ ...c }));
}
export function ewnRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    ewnCategories.map(({ service_code }) => [
      service_code,
      {
        scope: ewnScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        phone_max_length: 50,
        contact_fields: ['phone'],
        description_max_length: 4000,
        location_label_max_length: 250,
        bodies: ['Elektrizität Wasser Neuenhof (ewn) – Strassenbeleuchtung'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          })),
          {
            code: 'salutation',
            description: 'Salutation',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['Frau', 'Herr'],
          },
          ...[
            ['contact_company', 'Your company (optional)', 100],
            ['reporter_street', 'Your street (optional)', 250],
            ['contact_postcode', 'Your postcode (optional)', 20],
            ['contact_locality', 'Your locality (optional)', 100],
          ].map(([code, description, max_length]) => ({
            code: String(code),
            description: String(description),
            max_length: Number(max_length),
            required: false,
            contact: true,
            datatype: 'string',
          })),
          {
            code: 'lighting_street',
            description: 'Actual public lamp street',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_identity_or_location',
            description: 'Actual lamp number OR precise location',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'public_lamp_confirmed',
            description: 'Confirm the actual EWN-maintained public lamp in Neuenhof',
            required: true,
            datatype: 'string',
            values: ['Public lamp in Neuenhof maintained by EWN confirmed'],
          },
        ],
        notes: [
          'Nur nicht dringende Schäden an tatsächlichen öffentlichen Lampen im Unterhalt der ewn in Neuenhof. Keine privaten Leuchten, Versorgungsunterbrüche, anderen Anlagen oder unmittelbaren Gefahren. Gemeindegrenzen beweisen nicht den Unterhalt.',
          'Tatsächliche Lampenstrasse und echte Kandelabernummer ODER genaue Ortsangabe erforderlich. Nummer nie erfinden; führende Nullen erhalten. Privatadresse ist nicht der Störungsort.',
          'Private Anrede, Vor-/Nachname, Telefon und E-Mail sind erforderlich. Firma und postalische Strasse/PLZ/Ort sind freiwillig und bleiben ebenfalls ausserhalb der KI. Kein separates Hausnummernfeld. PLZ ist nativer Freitext; lokale Längengrenzen sind konservativ.',
          'Eine der fünf veröffentlichten Fehlerarten wählen; genau eine Auswahl und nützliche Beschreibung sind lokale konservative Regeln. Das native Kontrollkästchenfeld und Bemerkung sind im HTML freiwillig. Keine Fotos, kein erfundenes zusätzliches Einwilligungsfeld.',
          'Anbieterhinweise lesen: zweckgebundene Speicherung grundsätzlich höchstens zehn Jahre, Dienstleister/Vertreter/gesetzliche Empfänger sowie Auslandbedingungen. Der ausgewählte hCaptcha-Dienst stimmt nicht mit der Google-reCaptcha-Angabe in der Richtlinie überein; diese Lücke bleibt für eine spätere Übermittlung offen.',
          'Alles bleibt in Civic. Fünf feste Quellen werden mit GET geprüft; vollständige Bytes einschliesslich technischer Werte, ohne Normalisierung/Wiederverwendung, hCaptcha-/Client-Ausführung oder Übermittlung. Keine externe Fertigstellung/Statusabfrage. Bei unklarem Ausgang nicht erneut melden oder den Kanal wechseln.',
        ],
      },
    ]),
  );
}
