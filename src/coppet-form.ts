import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const coppetLightingUrl = 'https://www.coppet.ch/guichetvirtuel';
export const coppetPrivacyUrl = 'https://www.coppet.ch/datenschutz';
export const coppetServicesUrl = 'https://www.coppet.ch/servicecommunaux/11442';
export const coppetCategory = 'Éclairage public communal';
export const coppetCategories = Object.freeze([
  Object.freeze({
    service_code: coppetCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
export const coppetScope =
  'Local French facts worksheet for a nonurgent fault of an actual communal public streetlight at its exact Coppet BFS5712 point. The municipality invites lighting defect reports through its online form and assigns public lighting to its heritage/road-maintenance service; emergency telephone is not an ordinary fallback. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, wires/sparks/general outage/active traffic risk, private assets, enforcement/accusations, water/gas/roads/drains/waste. Destruction describes visible nonurgent maintenance facts only. Street name and fault kind are local worksheet requirements, not native validation. Actual street/lamp numbers only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Selected incident wrapper has FriendlyCaptcha and deferred native fields. Native contact/photo/retention/country/guest acceptance/receipt requirements are unknown. Site statistics policy does not establish incident storage country or anonymous acceptance. Protected incident form/client/schema/puzzle/state excluded from all reads and preparation. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty.';
// Independently authored worksheet; factual URL/digests only, no municipal page copies.
export const coppetSourcePins = Object.freeze(
  [
    {
      url: 'https://www.coppet.ch/robots.txt',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      plain: true,
    },
    {
      url: 'https://www.coppet.ch/guichetvirtuel',
      sha256: '4f8aed7724c52d3331b73043c5087a0fbde224d20df258d02b23eab37bb02dd7',
      plain: false,
    },
    {
      url: 'https://www.coppet.ch/servicecommunaux/11442',
      sha256: 'ced394937de07283a095b1b68e63ed2195bf561f0bf28b2fbe68f55bf47d7195',
      plain: false,
    },
    {
      url: 'https://www.coppet.ch/datenschutz',
      sha256: '98cd943c63ce72e3ce6bba89cfd70c7d53ec4436af213ce55f60d051c8c4638b',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(coppetSourcePins);
export const inspectCoppetSource = verifier.inspect;
export const assertCoppetSourcesAvailable = verifier.assertAvailable;
export async function verifyCoppetSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return coppetCategories.map((c) => ({ ...c }));
}
export const loadCoppetCategories = verifyCoppetSources;
export function coppetRequirements(): Record<string, Requirements> {
  return {
    [coppetCategory]: {
      scope: coppetScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Coppet – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: 'Confirm a nonurgent fault of an actual Coppet communal public streetlight',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Coppet communal public streetlight confirmed'],
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
        'Fiche locale pour une panne non urgente d’un véritable luminaire public communal au point précis à Coppet. Confirmez la responsabilité communale. Aucun danger, câble tombé, étincelle, panne générale, risque actif pour la circulation, bien privé ou accusation.',
        'La commune invite les annonces de défauts d’éclairage via son formulaire en ligne; elle peut demander des informations complémentaires. La fiche reste incomplète; les champs du formulaire protégé n’ont pas été chargés. Cette fiche prépare uniquement les faits; elle ne constitue pas un formulaire officiel complet. Le téléphone d’urgence ne sert pas de solution de remplacement pour les pannes ordinaires. Aucun envoi, appel ou courriel effectué.',
        'Indiquez la rue et le type de panne observé. Inscrivez les numéros réels de rue et de lampe seulement si vous les connaissez; sinon, laissez-les vides. N’inventez aucun identifiant et ne remplacez pas une information manquante par zéro. Les règles de cette fiche sont locales; les exigences du formulaire officiel restent inconnues.',
        'Aucun nom, e-mail, téléphone, photo ou consentement collecté. Les exigences officielles de contact, de photo, de conservation, de pays de traitement, l’accès sans connexion et la réception restent inconnus. La politique des statistiques du site ne prouve pas le lieu de stockage des annonces. Le formulaire protégé, son client, son schéma, son défi et son état sont exclus. Aucune finalisation externe ni suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
