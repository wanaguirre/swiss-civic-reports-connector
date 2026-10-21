import type { Requirements } from './model.js';
import { verifyEwwSources } from './eww-source.js';
export { ewwFormUrl, ewwPrivacyUrl, ewwIdentityUrl } from './eww-source.js';

export const ewwScope =
  'Only nonurgent faults of actual Energie Wettingen-maintained public streetlights within Wettingen (BFS4045), at the confirmed precise lamp point. Municipal boundaries do not prove maintained ownership. Excludes private fixtures, supply outages, other assets, immediate danger and neighbouring municipalities. Pflanzenbewuchs means vegetation obstructing this lamp, not general species reporting.';
export const ewwCategories = [
  'Lampe brennt nicht',
  'Lampe flackert',
  'Mast steht schief',
  'Glas ist defekt/fehlt',
  'Sicherungstüre fehlt/offen',
  'Pflanzenbewuchs',
  'Sonstiger Schaden',
].map((service_code) => ({ service_code, service_name: service_code }));
export async function loadEwwCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifyEwwSources(request, retry, now);
  return ewwCategories.map((c) => ({ ...c }));
}
export function ewwRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    ewwCategories.map(({ service_code }) => [
      service_code,
      {
        scope: ewwScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: false,
        phone_max_length: 50,
        contact_fields: ['phone'],
        description_max_length: 4000,
        location_label_max_length: 250,
        bodies: ['Energie Wettingen – Öffentliche Beleuchtung'],
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
            values: ['Herr', 'Frau'],
          },
          ...[
            ['reporter_street', 'Your street/address (optional)', 250],
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
            code: 'contact_postcode',
            description: 'Your numeric postcode (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 20,
            format: 'digit_identifier',
          },
          {
            code: 'lighting_street',
            description: 'Actual lamp street/address',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp number if known; preserve leading zeros',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'public_lamp_confirmed',
            description: 'Confirm the actual Energie Wettingen-maintained public lamp in Wettingen',
            required: true,
            datatype: 'string',
            values: ['Public lamp in Wettingen maintained by Energie Wettingen confirmed'],
          },
        ],
        notes: [
          'Nur nicht dringende Schäden an tatsächlichen öffentlichen Lampen im Unterhalt von Energie Wettingen in Wettingen. Gemeindegrenzen allein beweisen den Unterhalt nicht. Keine privaten Leuchten, Versorgungsunterbrüche, anderen Anlagen oder unmittelbaren Gefahren. Pflanzenbewuchs nur als Behinderung dieser Lampe.',
          'Tatsächliche Lampenstrasse/Adresse und bestätigter genauer Lampenpunkt erforderlich. Echte Lampennummer freiwillig; nie erfinden und führende Nullen erhalten. Privatadresse ist nicht der Störungsort.',
          'Private Anrede Herr/Frau, Vor-/Nachname und E-Mail erforderlich. Telefon und private Strasse/PLZ/Ort freiwillig; Kontaktdaten bleiben ausserhalb der KI. Keine Firma oder zusätzliche Einwilligung. PLZ lokal höchstens20 Ziffern; diese Grenze ist eine konservative lokale Regel. Native zusätzliche E-Mail-Prüfung für eine spätere Übermittlung bleibt unbestätigt.',
          'Eine der sieben Fehlerarten wählen. Nützliche Beschreibung und Textgrenzen sind lokale Regeln. Fotos können lokal beim Formulieren helfen, werden hier aber nicht an Energie Wettingen angehängt.',
          'Datenschutzhinweise lesen: Anfrage/Folgekontakt, mögliche bestehende Kundendaten und Qualitätsprüfung, Dienstleister/Partner/Behörden sowie Auslandbedingungen. Keine feste Löschfrist für Lampenmeldungen oder Fotos und keine Veröffentlichungszusage festgestellt. Datenschutz und Annahme der nativen Übermittlung sind noch nicht vollständig geklärt.',
          'Alles bleibt in Civic. Geänderte offizielle Quellen stoppen die Vorbereitung bis zur Prüfung. Nichts wird übermittelt; keine externe Fertigstellung oder Statusabfrage. Unklarer Ausgang erlaubt weder erneute Meldung noch Kanalwechsel.',
        ],
      },
    ]),
  );
}
