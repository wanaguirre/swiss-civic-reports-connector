import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const begninsLightingUrl = 'https://www.begnins.ch/energiereseaux/6544';
export const begninsAuthorityUrl = 'https://www.begnins.ch/municipalite/35536';
export const begninsServicesUrl = 'https://www.begnins.ch/departements/5098';
export const begninsCategory = 'Éclairage public communal';
export const begninsCategories = Object.freeze([
  Object.freeze({
    service_code: begninsCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
export const begninsScope =
  'Local French facts worksheet for a nonurgent fault of an actual communal public streetlight at its exact Begnins BFS5704 point. Ordinary lighting faults are explicitly directed to the SEIC online form; emergency telephone is not an ordinary fallback. Municipal repair mandate is required, not guaranteed. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, wires/sparks/general outage/active traffic risk, private assets, enforcement/accusations, water/gas/roads/drains/waste. Street name and fault kind are local worksheet requirements, not native validation. Actual street/lamp numbers only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Captured protected provider form requires description, city, street and number, title, surname, first name and email; mast number is optional. This local worksheet intentionally collects no reporter contacts or title. Native photo/privacy/retention/country/guest acceptance/receipt requirements remain unknown. Protected provider form and its client/state are excluded from all reads and preparation. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty.';
// Independently authored worksheet; factual URL/digests only, no municipal page copies.
export const begninsSourcePins = Object.freeze(
  [
    {
      url: 'https://www.begnins.ch/robots.txt',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      plain: true,
    },
    {
      url: 'https://www.begnins.ch/energiereseaux/6544',
      sha256: 'f5f7cd8cf616b31231a733248d894b0c3a9044fe79b08869ddfdeea34b6023b0',
      plain: false,
    },
    {
      url: 'https://www.begnins.ch/municipalite/35536',
      sha256: '6660971b84039191ceae181e14c6fff413994980d9f7164d87bdd954e270a804',
      plain: false,
    },
    {
      url: 'https://www.begnins.ch/departements/5098',
      sha256: '4b134308bf4f0351d8f8ee682fb8cd5240c8bcfe9153cfbddf4ad67035035dc5',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(begninsSourcePins);
export const inspectBegninsSource = verifier.inspect;
export const assertBegninsSourcesAvailable = verifier.assertAvailable;
export async function verifyBegninsSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return begninsCategories.map((c) => ({ ...c }));
}
export const loadBegninsCategories = verifyBegninsSources;
export function begninsRequirements(): Record<string, Requirements> {
  return {
    [begninsCategory]: {
      scope: begninsScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Begnins – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: 'Confirm a nonurgent fault of an actual Begnins communal public streetlight',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Begnins communal public streetlight confirmed'],
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
          values: ['Ne fonctionne pas', 'Fonctionne par intermittence'],
        },
      ],
      notes: [
        'Fiche locale pour une panne non urgente d’un véritable luminaire public communal au point précis à Begnins. Confirmez la responsabilité communale. Aucun danger, câble tombé, étincelle, panne générale, risque actif pour la circulation, bien privé ou accusation.',
        'La commune dirige les pannes ordinaires vers le formulaire de SEIC; la réparation exige un mandat communal, sans garantie de réparation. Cette fiche prépare uniquement les faits; elle ne constitue pas un formulaire officiel complet. Le téléphone d’urgence ne sert pas de solution de remplacement pour les pannes ordinaires. Aucun envoi, appel ou courriel effectué.',
        'Indiquez la rue et le type de panne observé. Inscrivez les numéros réels de rue et de lampe seulement si vous les connaissez; sinon, laissez-les vides. N’inventez aucun identifiant et ne remplacez pas une information manquante par zéro. Les règles de cette fiche sont locales; le formulaire officiel exige aussi le numéro de rue et des coordonnées, que cette fiche ne recueille pas; elle reste donc incomplète.',
        'Aucun nom, e-mail, téléphone, photo ou consentement collecté. Le formulaire protégé exige civilité, nom, prénom et e-mail; cette fiche ne les recueille pas. Les exigences de photo, de confidentialité, de conservation, de pays de traitement, l’accès sans connexion et la réception officiels restent inconnus. Aucune finalisation externe ni suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
