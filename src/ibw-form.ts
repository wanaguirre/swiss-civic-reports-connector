import type { Requirements } from './model.js';
import { verifyIbwSources } from './ibw-source.js';
export { ibwFormUrl, ibwPrivacyUrl, ibwIdentityUrl } from './ibw-source.js';
export const ibwScope =
  'Only nonurgent faults of actual ibw-maintained public streetlights in Wohlen AG (BFS4082), at the confirmed precise lamp point. Boundaries alone do not prove ownership. Excludes Wohlen BE, Büttikon, other service-area municipalities, private fixtures, supply outages and immediate danger. Scheduled night-time switch-off is not itself a defect; confirm the actual fault.';
// The native form has no category selector. This is one local preparation code.
export const ibwCategories = [
  { service_code: 'Defekte Strassenbeleuchtung', service_name: 'Defekte Strassenbeleuchtung' },
];
export async function loadIbwCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifyIbwSources(request, retry, now);
  return ibwCategories.map((c) => ({ ...c }));
}
export function ibwRequirements(): Record<string, Requirements> {
  return {
    'Defekte Strassenbeleuchtung': {
      scope: ibwScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      email_max_length: 50,
      phone_required: false,
      phone_max_length: 50,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['ibw – Öffentliche Beleuchtung Wohlen AG'],
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
          max_length: 50,
        })),
        {
          code: 'salutation',
          description: 'Salutation (optional)',
          required: false,
          contact: true,
          datatype: 'string',
          values: ['Frau', 'Herr'],
        },
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm you have read and understood the official ibw privacy policy',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Official ibw privacy policy read and understood'],
        },
        {
          code: 'lighting_street',
          description: 'Actual lamp street or square',
          required: true,
          datatype: 'string',
          max_length: 50,
        },
        {
          code: 'lamp_number',
          description: 'Actual lamp number; preserve leading zeros',
          required: true,
          datatype: 'string',
          max_length: 50,
          format: 'digit_identifier',
        },
        {
          code: 'lamp_house_number',
          description: 'Actual nearby house number (optional)',
          required: false,
          datatype: 'string',
          max_length: 50,
        },
        {
          code: 'multiple_lamps',
          description: 'Several lamps on the same actual street are affected (optional)',
          required: false,
          datatype: 'string',
          values: ['Several lamps on the same street are affected'],
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm the actual ibw-maintained public lamp in Wohlen AG',
          required: true,
          datatype: 'string',
          values: ['Public lamp in Wohlen AG maintained by ibw confirmed'],
        },
      ],
      notes: [
        'Nur tatsächliche, nicht dringende Schäden an öffentlichen Lampen im Unterhalt der ibw in Wohlen AG. Keine Ausdehnung auf Wohlen BE, Büttikon oder andere Versorgungsgebiete. Gemeindegrenzen allein belegen den Unterhalt nicht. Planmässige nächtliche Abschaltung ist für sich kein Defekt.',
        'Genauen Lampenpunkt, tatsächliche Strasse oder Platz und echte Kandelabernummer bestätigen. Nummer nie erfinden; führende Nullen erhalten. Lokal nur bis 50 Ziffern als konservative Teilmenge der nativen Zahlenprüfung. Hausnummer und mehrere betroffene Lampen derselben Strasse freiwillig.',
        'Private Vor-/Nachnamen und E-Mail erforderlich, jeweils höchstens 50 Zeichen. Anrede und Telefon freiwillig; keine Firma oder Privatadresse ergänzen. Kontaktdaten bleiben ausserhalb der KI. Native zusätzliche E-Mail-/Telefonprüfung ist vor einer späteren Übermittlung noch abzugleichen.',
        'Offizielle Datenschutzerklärung lesen und Verständnis bestätigen. Die allgemeine Kontaktpassage nennt Privatadresse/PLZ; das tatsächliche Lampenformular enthält diese Felder nicht. Formularzweck, mögliche Marketing-/Statistiknutzung mit Widerspruchsrecht, Dienstleister/Gruppe/Behörden und Auslandbedingungen; keine feste lampenspezifische Löschfrist oder Veröffentlichungszusage festgestellt.',
        'Nützliche Beschreibung und Textgrenzen sind lokale Regeln. Fotos können beim lokalen Formulieren helfen, werden hier aber nicht angehängt. Der native Spamfilter bleibt unangetastet; keine Berechnung, Antwortübernahme oder Ausführung.',
        'Alles bleibt in Civic. Geänderte offizielle Quellen stoppen die Vorbereitung bis zur Prüfung. Keine Übermittlung, externe Fertigstellung oder Statusabfrage. Unklarer Ausgang erlaubt weder erneute Meldung noch Kanalwechsel.',
      ],
    },
  };
}
