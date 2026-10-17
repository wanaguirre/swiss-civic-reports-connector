import { inspectWeblicationForm } from './weblication-form.js';
import type { Requirements } from './model.js';
export const wohlenBeFormUrl =
  'https://www.wohlen-be.ch/de/verwaltung/formulare/Defekte-Strassenbeleuchtung-melden.php';
export const wohlenBeTermsUrl = 'https://www.wohlen-be.ch/de/datenschutz/';
export const wohlenBeScope =
  'Non-emergency street-light defects on municipal roads in Wohlen bei Bern (BFS360). Cantonal-road lighting belongs to Bern canton. Explicit resident confirmation of municipal-road responsibility is required; unknown, cantonal and private assets are excluded. This confirmation is not independent road-ownership verification.';
export const wohlenBeCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Leuchte zerstört',
  'Kandelabertürchen fehlt',
  'Andere Defekte',
].map((x) => [x, x] as const);
export function inspectWohlenBeForm(html: string) {
  inspectWeblicationForm(
    html,
    'ort',
    'ef91917db11f220a97ee95bb59805abea7080fc1cb93ca6d8e8abdd88426ed9d',
  );
  return wohlenBeCategories.map(([service_code, service_name]) => ({ service_code, service_name }));
}
export function wohlenBeRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    wohlenBeCategories.map(([code]) => [
      code,
      {
        scope: wohlenBeScope,
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: false,
        contact_fields: [],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Wohlen bei Bern'],
        extra_fields: [
          ...[
            ['first_name', 'First name', true],
            ['last_name', 'Last name', true],
            ['contact_street', 'Your street and house number', true],
            ['contact_postcode_locality', 'Your postcode and locality', true],
            ['lighting_locality', 'Affected lamp locality', false],
          ].map(([code, description, contact]) => ({
            code: code as string,
            description: description as string,
            contact: contact as boolean,
            required: true,
            datatype: 'string',
            max_length: 250,
          })),
          ...[
            ['lighting_street', 'Affected street'],
            ['lamp_number', 'Actual lamp number if known; never invent one'],
            ['observed_time', 'Time when the fault was noticed'],
          ].map(([code, description]) => ({
            code,
            description,
            required: false,
            datatype: 'string',
            max_length: 250,
          })),
          {
            code: 'municipal_road_confirmed',
            description:
              'Confirm this lamp serves a municipal road in Wohlen BE. If ownership is unknown, cantonal or private, do not prepare here.',
            required: true,
            datatype: 'string',
            values: ['Municipal road confirmed'],
            max_length: 100,
          },
          {
            code: 'privacy_consent',
            description: 'I agree to the use of my details under the municipality privacy policy.',
            required: true,
            datatype: 'string',
            values: ['Ja'],
            contact: true,
            max_length: 10,
          },
        ],
        notes: [
          'Nur Gemeindestrassen in Wohlen BE. Kantonsstrassen, Privatstrassen und unbekannte Zuständigkeit ausschliessen. Die Bestätigung ersetzt keine unabhängige Eigentumsprüfung.',
          'Vorname, Nachname, Kontaktadresse, E-Mail, Ort der Lampe und ausdrückliche Datenschutz-Zustimmung erforderlich. Telefon und tatsächliche Lampennummer optional.',
          'Ein Fehlergrund pro Entwurf. Das technische Leerfeld wird nicht als Einwohnerangabe abgefragt.',
          'Foto-Upload ist im Original optional, seine Grenzen sind nicht geprüft. Civic bereitet nur Text vor; Quellfotos ausdrücklich ausschliessen.',
          'Kein Senden, Upload, Tokenabruf, serverseitige Validierung oder Statusabruf.',
        ],
      } satisfies Requirements,
    ]),
  );
}
