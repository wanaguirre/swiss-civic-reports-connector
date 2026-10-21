import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const reinachBlFormUrl =
  'https://www.reinach-bl.ch/de/verwaltung/formulare/10-stoerungsmeldungen.php';
export const reinachBlScope =
  'Non-emergency municipal public-space defects in Reinach BL (BFS2773): defective streetlamps, illegally discarded waste, overflowing bins, dirty barbecue sites, damaged planting beds/sign stands, graffiti and playground/sports-facility damage. Exclude private assets, power outages and emergencies. The three classes correspond to published form sections, not invented municipal category identifiers.';
export const reinachBlCategories = [
  'Defekte Strassenlampe',
  'Abfallmeldung',
  'Weitere Meldungen',
] as const;
/** Pin the complete selected contract, masking only its generated action and session token. */
export function inspectReinachBlForm(html: string) {
  inspectWeblicationForm(
    html,
    'element_111804956',
    'b8d007e6b8afb8ddf90a7f352dc7958f6c35c0cb91ca6784832749bf2a62d1d8',
  );
  return reinachBlCategories.map((name) => ({ service_code: name, service_name: name }));
}
export function reinachBlRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    reinachBlCategories.map((category) => [
      category,
      {
        scope:
          category === reinachBlCategories[0]
            ? 'Defective municipal public streetlamps in Reinach BL, not private lighting or power outages.'
            : category === reinachBlCategories[1]
              ? 'Illegally discarded waste, loose rubbish bags, overflowing bins and dirty public barbecue sites in Reinach BL.'
              : 'Other municipal Werkhof defects in Reinach BL, including damaged planting beds/sign stands, graffiti and damage on public playgrounds/sports facilities; not general private complaints.',
        photo_required: false,
        max_photos: 0,
        email_required: false,
        phone_required: false,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Reinach (BL)'],
        extra_fields: [
          {
            code: 'last_name',
            description: 'Surname required by the municipality',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'first_name',
            description: 'First name (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          ...(category === reinachBlCategories[0]
            ? [
                {
                  code: 'lamp_number',
                  description: 'Actual lamp number, if present; do not invent one',
                  required: false,
                  datatype: 'string',
                  max_length: 100,
                },
                {
                  code: 'nearby_house_number',
                  description: 'Nearest house number (optional)',
                  required: false,
                  datatype: 'string',
                  max_length: 100,
                },
              ]
            : []),
        ],
        notes: [
          'Nachname erforderlich; Vorname, Telefon und E-Mail für Rückfragen freiwillig. Kontaktwerte bleiben von der KI getrennt.',
          'Civic verlangt eine bestätigte Ortsangabe und Beschreibung für genau einen der drei veröffentlichten Formularbereiche. Keine amtlichen Kategorienummern erfinden.',
          'Das aktuelle ausgewählte Formular hat kein Foto- oder Uploadfeld. Quellfotos ausdrücklich von der Übermittlung ausschliessen.',
          'Die Gemeinde nennt für Lampen ungefähr zwei Wochen Reparaturzeit; dies ist kein Empfangsnachweis.',
          'Nur lokale Vorbereitung. Keine Formularbefüllung, kein POST, kein Versand oder Tracking. Bei unklarem Ausgang niemals automatisch wiederholen oder den Kanal wechseln.',
        ],
      } satisfies Requirements,
    ]),
  );
}
