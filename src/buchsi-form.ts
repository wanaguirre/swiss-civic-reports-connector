import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const buchsiFormUrl =
  'https://www.energiebuchsi.ch/de/wGlobal/content/elements/formulare/strassenbeleuchtung.php';
export const buchsiScope =
  'Non-emergency public street-light defects in Münchenbuchsee (BFS546), referred by the municipality to Energie Münchenbuchsee AG. Exclude private lights, power outages, water faults and other municipal defects. Resident confirmation does not independently establish asset ownership.';
export const buchsiCategory = 'Defekte Strassenleuchte';
export function inspectBuchsiForm(html: string) {
  inspectWeblicationForm(
    html,
    'subject-b',
    'e490d5e4112f91c1946520a076fb17d6db1a6740b70cff406e780865f812e3a0',
  );
  return [{ service_code: buchsiCategory, service_name: buchsiCategory }];
}
export function buchsiRequirements(): Record<string, Requirements> {
  return {
    [buchsiCategory]: {
      scope: buchsiScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: false,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Münchenbuchsee'],
      extra_fields: [
        ...[
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
          ['contact_street', 'Your street'],
          ['contact_house_number', 'Your house number'],
          ['contact_postcode', 'Your postcode'],
          ['contact_town', 'Your town'],
        ].map(([code, description]) => ({
          code,
          description,
          contact: true,
          required: true,
          datatype: 'string',
          max_length: 250,
        })),
        ...[
          ['lamp_number', 'Actual street-light number; do not invent one'],
          ['lighting_street', 'Street of the affected lamp'],
          ['lighting_house_number', 'House number beside the affected lamp; do not invent one'],
        ].map(([code, description]) => ({
          code,
          description,
          required: true,
          datatype: 'string',
          max_length: 250,
        })),
        {
          code: 'lighting_details',
          description: 'Additional lamp location details (optional)',
          required: false,
          datatype: 'string',
          max_length: 1000,
        },
        {
          code: 'public_lamp_confirmed',
          description:
            'Confirm public street lighting in Münchenbuchsee; exclude private lights, outages and emergencies.',
          required: true,
          datatype: 'string',
          values: ['Public streetlamp confirmed'],
        },
      ],
      notes: [
        'First/last name, reporter street/house number/postcode/town and email required. Phone optional: no required validator or visual star despite generic aria label.',
        'Lamp number, lamp street, adjacent house number and defect description required; additional location details optional. Keep reporter address separate from lamp location.',
        'No photo field: explicitly exclude source photos. Technical empty field is not a resident field. No salutation control exists despite the displayed Anrede text.',
        'Preparation only: no scripts, validation requests, POST or tracking. Initial page contains a success message already; it is not evidence of acceptance. Sending and reconciliation remain unverified.',
      ],
    },
  };
}
