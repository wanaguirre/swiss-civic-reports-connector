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
        'Nur nicht dringende Schäden an öffentlichen Lampen im Unterhalt der EGM in Mülligen AG. Genauen Lampenpunkt und Zuständigkeit bestätigen; Gemeindegrenzen allein belegen den Unterhalt nicht.',
        'Vorname, Nachname und E-Mail sind erforderlich, Firma freiwillig. Keine private Postadresse oder Telefonnummer hinzufügen. Strasse, PLZ und Ort beziehen sich auf die defekte Lampe.',
        'Offizielle Datenschutzerklärung lesen und Einverständnis bestätigen. Sie beschreibt Kontakt-/Formularzwecke, breitere Marketing-/Statistikzwecke mit Widerspruch, Weitergabe an Dienstleister/Partner/Behörden und Auslandbedingungen. Keine feste lampenspezifische Löschfrist oder Veröffentlichungszusage festgestellt.',
        'Fotos dürfen beim Formulieren helfen, werden hier aber nicht angehängt. Quellfotos ausdrücklich ausschliessen.',
        'Nur lokale Vorbereitung: Nichts wird gesendet. Externe Erledigung und Statusabfrage sind nicht verfügbar. Bei unklarem Ausgang niemals automatisch erneut melden, neu erstellen oder den Sendekanal wechseln.',
      ],
    },
  };
}
