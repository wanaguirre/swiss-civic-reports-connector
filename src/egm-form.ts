import type { Requirements } from './model.js';
import { verifyEgmSources } from './egm-source.js';
export { egmFormUrl, egmIdentityUrl, egmPrivacyUrl } from './egm-source.js';
export const egmScope =
  'Only nonurgent faults of actual EGM-maintained public streetlamps within Mülligen AG (BFS4107), at the confirmed precise lamp point. Municipal boundaries do not prove maintenance responsibility. Excludes private fixtures, supply outages, urgent hazards, neighbouring municipalities and unrelated public-space defects.';
export const egmCategories = [
  { service_code: 'Defekte Lampen', service_name: 'Defekte öffentliche Lampe' },
];
export async function loadEgmCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifyEgmSources(request, retry, now);
  return egmCategories.map((c) => ({ ...c }));
}
export function egmRequirements(): Record<string, Requirements> {
  return {
    'Defekte Lampen': {
      scope: egmScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['EGM Mülligen – öffentliche Beleuchtung'],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Surname'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          contact: true,
          datatype: 'string',
          max_length: 250,
        })),
        {
          code: 'company',
          description: 'Company (optional)',
          required: false,
          contact: true,
          datatype: 'string',
          max_length: 250,
        },
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm agreement with the official EGM privacy policy',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Official EGM privacy policy read and agreed'],
        },
        ...[
          ['lighting_street', 'Actual lamp street'],
          ['lighting_postcode', 'Actual lamp postal code'],
          ['lighting_locality', 'Actual lamp locality'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          datatype: 'string',
          max_length: 250,
        })),
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm this public lamp in Mülligen is maintained by EGM',
          required: true,
          datatype: 'string',
          values: ['Public lamp in Mülligen maintained by EGM confirmed'],
        },
      ],
      notes: [
        'Nur tatsächliche, nicht dringende Schäden an öffentlichen Lampen im Unterhalt der EGM innerhalb Mülligen AG. Genauen Lampenpunkt und Zuständigkeit bestätigen; Gemeindegrenzen allein belegen den Unterhalt nicht.',
        'Private Vor-/Nachnamen und E-Mail erforderlich, Firma freiwillig. Keine private Postadresse, Anrede oder Telefonnummer hinzufügen. Ort der defekten Lampe mit tatsächlicher Strasse, PLZ und Ort ist vom Wohnort getrennt. Keine Werte erfinden.',
        'Native E-Mail-Bestätigung ist vor späterem Versand noch abzugleichen. Eine nützliche Beschreibung und Textgrenzen sind lokale Regeln; das native Beschreibungsfeld hat kein angezeigtes Pflichtzeichen.',
        'Datenschutzerklärung lesen und Einverständnis bestätigen. Die allgemeine Formularpassage nennt private Post-/Telefondaten, die das konkrete Lampenformular nicht abfragt. Kontakt-/Formularzwecke, breitere Marketing-/Statistikzwecke mit Widerspruch, Dienstleister/Partner/Behörden und Auslandbedingungen; keine feste lampenspezifische Löschfrist oder Veröffentlichungszusage.',
        'Textvorbereitung ohne Anhänge. Native Seite nennt jpg/png/pdf bis 16 MB je Datei; Zählgrenze und native Annahme sind ungeprüft. Quellfotos ausdrücklich ausschliessen. Keine Uploads, CAPTCHA-/Clientausführung, Antwortberechnung oder Wiederverwendung nativen Zustands.',
        'Alles bleibt in Civic. Geänderte offizielle Quellen stoppen die Vorbereitung. Kein Senden, externe Erledigung oder Statusabruf. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
