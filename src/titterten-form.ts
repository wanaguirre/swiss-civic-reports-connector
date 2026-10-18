import type { Requirements } from './model.js';
import { inspectWeblicationForm } from './weblication-form.js';
export const tittertenFormUrl =
  'https://www.titterten.ch/de/behoerden-und-kommissionen/dienstleistungen/oeffentliche-beleuchtung.php';
export const tittertenReferralUrl =
  'https://www.titterten.ch/de/behoerden-und-kommissionen/dienstleistungen.php?navid=232857232857';
export const tittertenCategory = 'Strassenbeleuchtung';
export const tittertenScope =
  'Non-emergency defective municipal streetlights in Titterten (BFS2894), expressly invited by the municipal lighting form. Not private lights, power outages or general municipal complaints. Confirm the actual lamp location and describe which light is defective.';
export function inspectTittertenForm(html: string) {
  inspectWeblicationForm(
    html,
    'lastname',
    '3908c3de4aaea37fe4dfc5846427c2c023c4a4f2215c1dca882626073f0ee842',
  );
  return [{ service_code: tittertenCategory, service_name: tittertenCategory }];
}
export function tittertenRequirements(): Record<string, Requirements> {
  return {
    [tittertenCategory]: {
      scope: tittertenScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      contact_fields: ['phone'],
      description_max_length: 5000,
      location_label_max_length: 250,
      bodies: ['Titterten'],
      extra_fields: [
        {
          code: 'salutation',
          description: 'Salutation',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Herr', 'Frau'],
        },
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
          code: 'lighting_location',
          description:
            'Actual street and nearby house number or landmark identifying the defective public lamp',
          required: true,
          datatype: 'string',
          max_length: 250,
        },
      ],
      notes: [
        'Nur defekte öffentliche Strassenlampen in Titterten. Tatsächlichen Standort bestätigen; private Leuchten, Stromausfälle und andere Anliegen gehören nicht zu diesem Formular.',
        'Anrede selbst auswählen. Vorname, Nachname und Telefonnummer sind erforderlich. Die Quelle hat kein E-Mail- oder Postadressfeld; Civic übermittelt keine Konto-E-Mail.',
        'Das Formular fragt, welche Strassenlampe defekt ist. Civic verlangt eine nützliche Ortsangabe und Beschreibung; eine echte vorhandene Lampennummer kann im Text ergänzt werden. Keine Kennung erfinden.',
        'Keine Fotos möglich: Quellfotos ausdrücklich ausschliessen. Vorbereitung bleibt in Civic; Senden, externe Formularerledigung und Statusabfrage sind nicht verfügbar.',
        'Annahme und Empfang sind nicht verifiziert. Einen unklaren Ausgang niemals automatisch wiederholen, neu erstellen oder auf einem anderen Kanal senden.',
      ],
    },
  };
}
