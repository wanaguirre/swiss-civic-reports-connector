import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const moudonLightingUrl = 'https://www.moudon.ch/eclairage-public-annonce-de-panne';
export const moudonAuthorityUrl = 'https://www.moudon.ch/municipalite';
export const moudonServicesUrl =
  'https://www.moudon.ch/administration/administration-et-services-communaux/services-industriels';
export const moudonCategory = 'Éclairage public communal';
export const moudonCategories = Object.freeze([
  Object.freeze({
    service_code: moudonCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
export const moudonScope =
  'Local French facts worksheet for a nonurgent fault of an actual communal public streetlight at its exact Moudon BFS5678 point. Ordinary faults are directed to an online form; emergency telephone is not an ordinary fallback. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, wires/sparks/general outage/active traffic risk, private assets, enforcement/accusations, water/gas/roads/drains/waste. Destruction describes visible nonurgent maintenance facts only. Street name and fault kind are local worksheet requirements, not native validation. Actual street/lamp numbers only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Native contact/photo/privacy/guest acceptance/receipt requirements are unknown. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty.';
// Independently authored worksheet; factual URL/digests only, no municipal page copies.
export const moudonSourcePins = Object.freeze(
  [
    {
      url: 'https://www.moudon.ch/robots.txt',
      sha256: '17f7b0b22f4a02e7b9d4b252bf47b78870c738d7f35dcfdb043b02470e347603',
      plain: true,
    },
    {
      url: 'https://www.moudon.ch/municipalite',
      sha256: '12dc66c337ad4f3f8fa55ed11556af1ef56d4cc3a95a7611a72595f04959da05',
      plain: false,
    },
    {
      url: 'https://www.moudon.ch/eclairage-public-annonce-de-panne',
      sha256: '0de57eefcd8ec1b6f4a9426afdc0dd193bfad44be03556fd6a812d947b28be24',
      plain: false,
    },
    {
      url: 'https://www.moudon.ch/administration/administration-et-services-communaux/services-industriels',
      sha256: '9653fef45e113b7837dab35a6e715289dfea278c9909e5f511c1aaeb9f922c76',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(moudonSourcePins);
export const inspectMoudonSource = verifier.inspect;
export const assertMoudonSourcesAvailable = verifier.assertAvailable;
export async function verifyMoudonSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return moudonCategories.map((c) => ({ ...c }));
}
export const loadMoudonCategories = verifyMoudonSources;
export function moudonRequirements(): Record<string, Requirements> {
  return {
    [moudonCategory]: {
      scope: moudonScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Moudon – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: 'Confirm a nonurgent fault of an actual Moudon communal public streetlight',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Moudon communal public streetlight confirmed'],
        },
        {
          code: 'street_name',
          description: 'Local worksheet: actual street name',
          required: true,
          datatype: 'string',
          max_length: 150,
          translate: false,
        },
        {
          code: 'known_street_number',
          description:
            'Local worksheet: actual street number, only if known; otherwise leave empty',
          required: false,
          datatype: 'string',
          max_length: 30,
          translate: false,
        },
        {
          code: 'known_lamp_number',
          description: 'Local worksheet: actual lamp number, only if known; otherwise leave empty',
          required: false,
          datatype: 'string',
          max_length: 50,
          translate: false,
        },
        {
          code: 'fault_kind',
          description: 'Local worksheet: observed nonurgent lighting fault',
          required: true,
          datatype: 'string',
          values: [
            'Ne fonctionne pas',
            'Fonctionne par intermittence',
            'Détruit / vandalisé (constat matériel uniquement)',
            'Autre',
          ],
        },
      ],
      notes: [
        'Fiche locale pour une panne non urgente d’un véritable luminaire public communal au point précis à Moudon. Confirmez la responsabilité communale. Aucun danger, câble tombé, étincelle, panne générale, risque actif pour la circulation, bien privé ou accusation.',
        'La commune dirige les pannes ordinaires vers son formulaire en ligne. Cette fiche prépare uniquement les faits; elle ne constitue pas un formulaire officiel complet. Le téléphone d’urgence ne sert pas de solution de remplacement pour les pannes ordinaires. Aucun envoi, appel ou courriel effectué.',
        'Indiquez la rue et le type de panne observé. Inscrivez les numéros réels de rue et de lampe seulement si vous les connaissez; sinon, laissez-les vides. N’inventez aucun identifiant et ne remplacez pas une information manquante par zéro. Les règles de cette fiche sont locales; les exigences du formulaire officiel restent inconnues.',
        'Aucun nom, e-mail, téléphone, photo ou consentement collecté. Les exigences de contact, de photo et de confidentialité, l’accès sans connexion et la réception officiels restent inconnus. Aucune finalisation externe ni suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
