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
          'Tatsächliche Lampenstrasse/Adresse und bestätigter genauer Lampenpunkt erforderlich; echte Lampennummer freiwillig, nie erfinden und führende Nullen erhalten. Privatadresse ist nicht der Störungsort.',
          'Private Anrede Herr/Frau, Vor-/Nachname und E-Mail sind erforderlich. Telefon und private Strasse/PLZ/Ort sind freiwillig; alle Kontaktdaten bleiben ausserhalb der KI. Keine Firma oder zusätzliche Einwilligung erfinden. PLZ wird lokal auf höchstens20 ASCII-Ziffern begrenzt; dies ist eine konservative Teilmenge des nativen Zahlenfeldes ohne veröffentlichte Längengrenze. Keine fremde Gemeinde-PLZ erzwingen.',
          'Genau eine native Fehlerart erforderlich. Nützliche Beschreibung und Textgrenzen sind konservative lokale Regeln, nicht veröffentlichte native Maximalwerte. E-Mail wird lokal als Adresse geprüft; native zusätzliche HTML-Musterprüfung für Übermittlung bleibt separat unbestätigt.',
          'Native optionale Einzeldatei bis6MiB wird hier nicht angehängt: ihre Auswahl würde bereits einen separaten multipart PUT Upload auslösen. MIME und Serverannahme sind unbestätigt. Kein Foto-Payload, Upload-Identifier oder nativer Zustand wird erzeugt oder wiederverwendet.',
          'Die allgemeine Richtlinie Januar2026 nennt Anfrage/Folgekontakt, bestehende Kundendaten, mögliche Qualitätsprüfung, Dienstleister/Partner/Behörden und Auslandbedingungen; keine feste Lampen-/Fotolöschfrist oder Veröffentlichungszusage. Native Schutz-/Fingerprint-/Cookiebot-/HubSpot-/Google-Datenflüsse und echte Annahme bleiben für die Übermittlung ungeklärt.',
          'Neun feste Quellen werden ausschliesslich mit GET gelesen, mindestens zwei Sekunden zwischen Starts. Die vollständige Seite bleibt gehasht; nur geprüfte rotierende Attributwerte mit gebundenen IDs werden für diesen Vergleich ersetzt. Alle anderen Bytes einschliesslich Inline-Konfiguration, Felder und Script-Inventar bleiben verbindlich. Datenschutz, Betreiberidentität und sechs ausgewählte vollständige Clients werden bytegenau geprüft.',
          'Keine Schutzberechnung, Ausführung nativer Clients, Initialisierung, JSON-Bootstrap, Cookies, Formdaten oder Übermittlung. Alles bleibt in Civic; keine externe Fertigstellung/Statusabfrage. Unklarer Ausgang erlaubt weder erneute Meldung noch Kanalwechsel.',
        ],
      },
    ]),
  );
}
