import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const ostermundigenForms = {
  lighting: {
    category: 'Defekte Strassenbeleuchtung',
    selector: 'element_333719556',
    url: 'https://www.ostermundigen.ch/de/verwaltung/formulare/meldung-defekte-strassenbeleuchtung.php',
    hash: '0ad6785719d066231145e7ac6cb0c489355aea0d1a75c68f8d2a05d6ef583836',
  },
  road: {
    category: 'Strassenschaden (Schlagloch)',
    selector: 'Position',
    url: 'https://www.ostermundigen.ch/de/verwaltung/formulare/strassenschaden-mitteilen.php',
    hash: 'cc6feb24028c1c4b5c51f1d518ab230090462dd18f4377b6647a914aa82bad84',
  },
} as const;
export const ostermundigenScope =
  'Non-emergency single public-lamp defects and potholes in Ostermundigen (BFS363), using separate municipal forms. Exclude private/cantonal assets and unknown responsibility. Multiple failed lamps, traffic-accident and vandal damage use the official BKW fault-service route. Resident scope confirmation is not independent asset-ownership verification.';
export function inspectOstermundigenForm(kind: keyof typeof ostermundigenForms, html: string) {
  const form = ostermundigenForms[kind];
  inspectWeblicationForm(html, form.selector, form.hash);
  return [{ service_code: form.category, service_name: form.category }];
}
export function ostermundigenRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    Object.entries(ostermundigenForms).map(([kind, form]) => [
      form.category,
      {
        scope: ostermundigenScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Ostermundigen'],
        extra_fields: [
          ...[
            ['first_name', 'First name', true],
            ['last_name', 'Last name', true],
            ['contact_street', 'Your street and house number', true],
            ['contact_locality', 'Your locality', true],
            ['issue_street', 'Affected street', false],
            ['issue_house_number', 'Nearby house number', false],
            [
              kind === 'lighting' ? 'lamp_number' : 'road_position',
              kind === 'lighting'
                ? 'Actual lamp number; never invent one'
                : 'Pothole position (middle/edge)',
              false,
            ],
          ].map(([code, description, contact]) => ({
            code: code as string,
            description: description as string,
            contact: contact as boolean,
            required: true,
            datatype: 'string',
            max_length: 250,
          })),
          {
            code: 'contact_postcode',
            description: 'Your postcode (4–5 digits)',
            contact: true,
            required: true,
            datatype: 'string',
            max_length: 5,
            format: 'postcode_4_5_digits',
          },
          {
            code: 'observed_date',
            description: 'Date observed (digits, dots or commas only)',
            required: true,
            datatype: 'string',
            max_length: 50,
            format: 'numeric_date',
          },
          {
            code: 'salutation',
            description: 'Salutation required by the municipal form',
            contact: true,
            required: true,
            datatype: 'string',
            values: ['Frau', 'Herr'],
          },
          {
            code: 'scope_confirmed',
            description:
              'Confirm a municipal public asset, excluding private/cantonal/unknown responsibility and urgent or BKW-referred lighting incidents.',
            required: true,
            datatype: 'string',
            values: ['Municipal non-emergency asset confirmed'],
          },
          {
            code: 'terms_privacy_consent',
            description:
              'I have read and accept both the privacy policy and terms: https://www.ostermundigen.ch/de/datenschutz/ and https://www.ostermundigen.ch/de/datenschutz/nutzungsbedingungen.php',
            contact: true,
            required: true,
            datatype: 'string',
            values: ['Ja'],
          },
        ],
        notes: [
          'Separate lighting and pothole forms; actual lamp number is required only for lighting. Never invent missing details.',
          'Private contact phone, salutation, name, address, email and explicit privacy/terms consent required. Business phone and remarks optional on the original form; Civic uses the private phone and description.',
          'No photo control: explicitly exclude source photos. Technical empty field is not a resident requirement.',
          'Preparation only; no server validation, POST, uploads, receipt or tracking verified.',
        ],
      } satisfies Requirements,
    ]),
  );
}
