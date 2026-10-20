import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const bassinsWaterUrl = 'https://www.bassins.ch/administration/service-des-eaux/';
export const bassinsAuthorityUrl =
  'https://www.bassins.ch/bassins-vie-politique/municipaux-dicasteres/';
export const bassinsPrivacyUrl = 'https://www.bassins.ch/autres/politique-de-confidentialite/';
export const bassinsCategory = 'Eau communale';
export const bassinsCategories = Object.freeze([
  Object.freeze({
    service_code: bassinsCategory,
    service_name: 'Eau communale – brouillon local de question',
  }),
]);
export const bassinsScope =
  'Local French maintenance-enquiry text draft about a nonurgent physical defect of an actual communal drinking-water asset at its exact Bassins point (BFS5703). The public water page explicitly invites distribution questions to commune@bassins.ch and may redirect the enquiry to Renevier SA. This primary enquiry route is not a telephone fallback or verified fault acceptance. Boundary and resident confirmation alone do not prove ownership. Excludes emergencies, immediate danger, contamination/health concerns, outages, active leaks/flooding, private plumbing, new connections/hydrant-use requests, roads/drains/lighting/gas/waste/billing. Contractor emergency phones are not routine alternatives. No reporter contacts/photos/native consent/client/state/payload/emails/calls/sending/mail-client launch/external completion/tracking. Email reporter requirements, anonymous acceptance, incident privacy/retention/country/receipt and forwarding handling unknown. Website account/message periods and EU hosting do not establish email-incident guarantees. Never automatically retry, recreate or change channel after uncertainty.';
// Independently authored local enquiry draft; factual URL/digests, no copied pages/client.
export const bassinsSourcePins = Object.freeze(
  [
    {
      url: 'https://www.bassins.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://www.bassins.ch/administration/service-des-eaux/',
      sha256: '443132420aed7925e08e3dd5fe2ef815c0fbf09a20257aad884de63eb50208e9',
      plain: false,
    },
    {
      url: 'https://www.bassins.ch/bassins-vie-politique/municipaux-dicasteres/',
      sha256: '8888b609d00e0a8ab118a276967e723dc713a47d17f705662b4e16c0826ff21a',
      plain: false,
    },
    {
      url: 'https://www.bassins.ch/autres/politique-de-confidentialite/',
      sha256: '584ae38e770684f7d80241694a3ce2a4d3c667b45a15a941037b191e133d5924',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(bassinsSourcePins);
export const inspectBassinsSource = verifier.inspect;
export const assertBassinsSourcesAvailable = verifier.assertAvailable;
export async function verifyBassinsSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return bassinsCategories.map((c) => ({ ...c }));
}
export const loadBassinsCategories = verifyBassinsSources;
export function bassinsRequirements(): Record<string, Requirements> {
  return {
    [bassinsCategory]: {
      scope: bassinsScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Bassins – question d’entretien de l’eau'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent maintenance enquiry about an actual Bassins communal drinking-water asset',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent maintenance enquiry about actual Bassins communal drinking-water asset confirmed',
          ],
        },
      ],
      notes: [
        'Brouillon local de question d’entretien concernant un défaut physique non urgent d’un véritable équipement communal d’eau potable au point précis à Bassins. Confirmez la responsabilité communale. Aucune urgence, danger immédiat, contamination ou risque sanitaire, coupure, fuite active/inondation, plomberie privée, nouveau branchement ou demande de borne hydrante. Aucun autre service ou litige de facture.',
        'La page de l’eau invite à adresser les questions de distribution à commune@bassins.ch; la commune peut les rediriger vers Renevier SA. Ce brouillon prépare uniquement les faits et reste ici; aucun courriel, appel, envoi ou lancement de messagerie. Les téléphones d’urgence du concessionnaire ne sont pas une solution de remplacement pour une question ordinaire.',
        'Aucune coordonnée personnelle, photo ou consentement collecté. Les exigences d’un courriel, l’acceptation anonyme, la confidentialité, la conservation, le pays de traitement, la réorientation et la réception restent inconnus. Les règles du site Internet ne garantissent pas celles des courriels. Aucune finalisation externe ni suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
