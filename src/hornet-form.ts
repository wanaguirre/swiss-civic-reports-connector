import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

export const hornetFormUrl = 'https://www.asiatischehornisse.ch/';
export const hornetTermsUrl = 'https://www.asiatischehornisse.ch/bedingungen';
export const hornetAarauReferralUrl =
  'https://www.aarau.ch/leben/natur-und-umwelt/aarau-rangers.html/1886';
export const hornetAarauScope =
  'Suspected individual Asian-hornet sightings at the actual observation point in Aarau (BFS4001), referred by the municipality to info fauna’s national platform. This is an observation for expert validation, not a confirmed species diagnosis or municipal repair. Nest, hive, destroyed-nest, privileged/certified and emergency workflows are excluded from this preparation profile. Do not approach an insect or nest to obtain a photo.';
export const hornetCategories = [
  { service_code: 'Asiatische Hornisse gesichtet', service_name: 'Asiatische Hornisse gesichtet' },
];
// Factual byte fingerprints only: provider bundles and policy text are not copied
// into this package or its test fixtures. Every source is read, never executed.
const source = (
  path: string,
  sha256: string,
  type: PublicSourcePin['type'],
  maxBytes: number,
): PublicSourcePin => Object.freeze({ url: path, sha256, type, maxBytes });
export const hornetSources: readonly PublicSourcePin[] = Object.freeze([
  source(
    hornetFormUrl,
    '74be419c434a0a695c1620c9ab3a9bafa6dbf547b041951a527793490ba366f6',
    'html',
    20_000,
  ),
  source(
    'https://www.asiatischehornisse.ch/assets/index-BtsC5j42.js',
    'a506eda29b466f3cdcb8bed74025ea79663a0ca0d6f2d268e1fa941efb25aa69',
    'javascript',
    3_000_000,
  ),
  source(
    'https://www.asiatischehornisse.ch/assets/Announcement-DCfalsYa.js',
    'ddebcc9ad1b7e9f3def609145a120498087b469b3f3e133fa28044659eabb4de',
    'javascript',
    300_000,
  ),
  source(
    'https://www.asiatischehornisse.ch/assets/Term-Dg7NM7sE.js',
    'eda7e923d6df6734181a01e44757e7e2dc903a19457662ac4ed640a1d9871089',
    'javascript',
    20_000,
  ),
  source(
    'https://www.asiatischehornisse.ch/assets/static-t25pbGMx.js',
    '277148c916ef9a972a046ece5979427e9db348d76738aae1428ef8fe9b9666c0',
    'javascript',
    20_000,
  ),
  source(
    'https://www.asiatischehornisse.ch/assets/directus-BQYN-phs.js',
    'b2f22d8eba496763aec35ef3814c5cd46040fe676f76c18d2ce94f3fce9f38d7',
    'javascript',
    20_000,
  ),
  source(
    'https://frelonasiatique.ch/cms-api/terms?lang=de',
    'ad7a37b4c8351920ab443b011447f2df916864e2e9cdfd308c7af39b721d5634',
    'json',
    100_000,
  ),
  source(
    'https://frelonasiatique.ch/cms-api/terms?lang=fr',
    '7e8d7a99dd7b3613ca7d54cb5843cd8778771f37e33e63277968a0a1090f56be',
    'json',
    100_000,
  ),
]);
export async function loadHornetCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  await verifyPublicSourceManifest(request, hornetSources, retry, now);
  return hornetCategories.map((c) => ({ ...c }));
}
export function hornetRequirements(): Record<string, Requirements> {
  return {
    [hornetCategories[0].service_code]: {
      scope: hornetAarauScope,
      report_kind: 'species_observation',
      photo_required: true,
      max_photos: 1,
      max_photo_bytes: 5_000_000,
      email_required: true,
      phone_required: false,
      phone_max_length: 20,
      contact_fields: ['phone'],
      description_max_length: 1000,
      location_label_max_length: 250,
      bodies: ['info fauna – Asiatische Hornisse (Aarau)'],
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
          max_length: 100,
        })),
        {
          code: 'observation_date',
          description: 'Observation date (YYYY-MM-DD)',
          required: true,
          datatype: 'string',
          max_length: 10,
          format: 'past_iso_date',
        },
        {
          code: 'hornet_sighting_confirmed',
          description: 'Confirm an individual suspected hornet sighting in Aarau',
          required: true,
          datatype: 'string',
          values: ['Individual suspected hornet sighting in Aarau confirmed'],
        },
        {
          code: 'data_policy_consent',
          description: 'Provider privacy notice read and accepted',
          required: true,
          datatype: 'string',
          values: ['I have read and accept the provider privacy notice'],
        },
      ],
      notes: [
        'Nur einzelne mutmassliche Asiatische Hornissen in Aarau. Keine Nest-, Bienenstock- oder Notfallmeldungen. Abstand halten; für ein Foto nicht näher herangehen.',
        'Tatsächliches Datum und genauer Beobachtungsort erforderlich; Datum nicht schätzen. Private Namen und E-Mail erforderlich, Telefon freiwillig. Beschreibung höchstens 1000 Zeichen.',
        'Ein normalisiertes JPEG bis 5 MB. Diese Bildgrenze gilt lokal in Civic; Originalmetadaten werden entfernt.',
        'Die Datenschutzerklärung bewusst lesen und akzeptieren. Zuständige Fachpersonen können Kontaktdaten erhalten; Beobachtungsdaten können nach den Regeln des Anbieters weitergegeben werden. Für genaue Koordinaten gelten besondere Veröffentlichungsbedingungen; die französische Erklärung ist massgebend.',
        'Alles bleibt in Civic. Keine Übermittlung, externe Fertigstellung oder Statusabfrage. Eine Beobachtung ist keine bestätigte Artbestimmung. Bei unklarem Ausgang nicht automatisch erneut melden oder den Kanal wechseln.',
      ],
    },
  };
}
