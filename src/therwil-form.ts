import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const therwilFormUrl =
  'https://www.therwil.ch/de/verwaltung/formulare/stoerungsmeldungstrassenbeleuchtung.php';
export const therwilReferralUrl =
  'https://www.therwil.ch/de/verwaltung/dienstleistungen/detail/detail.php?i=109';
export const therwilScope =
  'Non-emergency municipal streetlamp faults in Therwil (BFS2775), referred to the municipal Werkhof by the exact lighting service. Not private lights, power outages or general municipal complaints. A real street and lamp-plaque number are required.';
export const therwilCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Andere (im Feld Mitteilungen ergänzen)',
] as const;
export function inspectTherwilForm(html: string) {
  inspectWeblicationForm(
    html,
    'element_444603510',
    'a3f3cbf09de2e53adaf40cc123394ed9700b099365a35ae6b3bac5c66a090b86',
    'session',
  );
  return therwilCategories.map((name) => ({ service_code: name, service_name: name }));
}
export function therwilRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    therwilCategories.map((category) => [
      category,
      {
        scope: therwilScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Therwil'],
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
            description: 'Surname',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lighting_street',
            description: 'Street of the defective lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_number',
            description:
              'Actual numeric lamp number from its plaque; retain leading zeros and never invent one',
            required: true,
            datatype: 'string',
            max_length: 100,
            format: 'digit_identifier',
          },
          ...(category === therwilCategories[2]
            ? [
                {
                  code: 'other_defect_details',
                  description: 'Explain the other lighting defect in the Mitteilung section',
                  required: true,
                  datatype: 'text',
                  max_length: 500,
                  translate: true,
                },
              ]
            : []),
        ],
        notes: [
          'Vorname, Nachname, Telefon, E-Mail, betroffene Strasse und echte Lampennummer erforderlich; Kontaktwerte bleiben von der KI getrennt.',
          'Die Quelle verwendet ein Zahlenfeld für die Lampennummer. Civic akzeptiert konservativ nur Ziffern und erhält führende Nullen; keine Nummer erfinden oder aus Koordinaten ableiten.',
          'Bei Andere muss die Störung im Mitteilungsfeld erläutert werden. Kein Foto- oder Uploadfeld: Quellfotos ausdrücklich ausschliessen.',
          'Die Formularseite nennt den folgenden Freitag; die Dienstseite nennt wöchentlich, in den Sommerferien zweiwöchentlich. Keine feste Erledigungsfrist oder Empfangsbestätigung ableiten.',
          'Nur lokale Vorbereitung. Kein POST, keine Formularbefüllung, kein Versand oder Tracking. Bei unklarem Ausgang niemals automatisch erneut senden oder den Kanal wechseln.',
        ],
      } satisfies Requirements,
    ]),
  );
}
