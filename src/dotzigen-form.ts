import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const dotzigenFormUrl = 'https://www.dotzigen.ch/de/kontakt/';
export const dotzigenScope =
  'Non-emergency public-lighting defects in Dotzigen (BFS386). The municipal Werkhof explicitly directs defective lamps and other public-lighting problems to this municipal contact form, while naming Evolon as operator. Exclude private lights, power outages and unrelated concerns. Resident public-lamp confirmation does not independently verify ownership.';
export const dotzigenCategory = 'Defekte öffentliche Beleuchtung';
export function inspectDotzigenForm(html: string) {
  inspectWeblicationForm(
    html,
    'subject-3',
    '074176a5dd4dce02980b7195c1dbe6dd880ddc554cc002326b765716a418a55a',
    'session',
  );
  return [{ service_code: dotzigenCategory, service_name: dotzigenCategory }];
}
export function dotzigenRequirements(): Record<string, Requirements> {
  return {
    [dotzigenCategory]: {
      scope: dotzigenScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Dotzigen'],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
          ['contact_address', 'Your address'],
        ].map(([code, description]) => ({
          code,
          description,
          contact: true,
          required: true,
          datatype: 'string',
          max_length: 250,
        })),
        {
          code: 'salutation',
          description: 'Salutation required by the municipality',
          contact: true,
          required: true,
          datatype: 'string',
          values: ['Herr', 'Frau'],
        },
        {
          code: 'privacy_consent',
          description:
            'I have read and accept the municipal privacy policy: https://www.dotzigen.ch/de/datenschutz/',
          contact: true,
          required: true,
          datatype: 'string',
          values: ['Ja'],
        },
        {
          code: 'public_lamp_confirmed',
          description:
            'Confirm a public-lighting defect in Dotzigen, excluding private lights, outages and emergencies.',
          required: true,
          datatype: 'string',
          values: ['Public lighting confirmed'],
        },
      ],
      notes: [
        'Name, Vorname, Adresse, Telefon, E-Mail, Anrede, Mitteilung und ausdrückliche Datenschutz-Zustimmung erforderlich.',
        'Nur öffentliche Beleuchtung über den ausdrücklich verlinkten Gemeindekontakt; andere Anliegen nicht aus dem allgemeinen Formulartitel ableiten.',
        'Kein Fotofeld: Quellfotos ausdrücklich ausschliessen. Technisches Leerfeld nicht als Einwohnerangabe abfragen.',
        'Vorbereitung ohne Skriptausführung, serverseitige Validierung, POST oder Tracking; Zustellung bleibt ungeprüft.',
      ],
    },
  };
}
