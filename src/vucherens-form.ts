import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const vucherensWaterUrl = 'https://vucherens.ch/administration/eau/';
export const vucherensVoirieUrl = 'https://vucherens.ch/administration/voirie/';
export const vucherensAuthorityUrl = 'https://vucherens.ch/politique/municipalite-2021-2026/';
export const vucherensCategory = 'Eau communale';
export const vucherensCategories = Object.freeze([
  Object.freeze({
    service_code: vucherensCategory,
    service_name: 'Eau communale – note téléphonique',
  }),
]);
export const vucherensScope =
  'Local French initial optional telephone-note preparation for a nonurgent physical maintenance fault of an actual communal drinking-water asset at its exact Vucherens point (BFS5692). The public water page explicitly invites network-problem contact to the communal on-duty employee0794464074; voirie employee role and authority since1July2026 agree. Boundary and resident confirmation alone do not prove ownership. Excludes emergencies, immediate danger, contamination/health concerns, supply interruption, active leaks/flooding, private plumbing, new connections/hydrant-use requests, roads/drains/lighting/gas/waste/billing. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Telephone reporter requirements, anonymous acceptance and incident privacy/retention/country/receipt unknown. Paid exceptional private services are not water-report fees. Never automatically retry, recreate or change channel after uncertainty.';
// Factual URLs/digests and own fixtures only; no municipal source copies/native contact.
export const vucherensSourcePins = Object.freeze(
  [
    {
      url: 'https://vucherens.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://vucherens.ch/administration/voirie/',
      sha256: 'b1922f33cbd55f7c4dd780eb3f01f9f7bdb27663389d8424cd43550a3f42d587',
      plain: false,
    },
    {
      url: 'https://vucherens.ch/administration/eau/',
      sha256: '3977a16030c50dace26d0aead52dfad32b1ab8ddfeac841cf5fd07b1eaa1299f',
      plain: false,
    },
    {
      url: 'https://vucherens.ch/politique/municipalite-2021-2026/',
      sha256: '784f23bde9d43d214f347dc0881af065bca1f3ebd011445ead45d1e85c2b16c6',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(vucherensSourcePins);
export const inspectVucherensSource = verifier.inspect;
export const assertVucherensSourcesAvailable = verifier.assertAvailable;
export async function verifyVucherensSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return vucherensCategories.map((c) => ({ ...c }));
}
export const loadVucherensCategories = verifyVucherensSources;
export function vucherensRequirements(): Record<string, Requirements> {
  return {
    [vucherensCategory]: {
      scope: vucherensScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Vucherens – eau potable'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent maintenance fault of an actual Vucherens communal drinking-water asset',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent maintenance fault of actual Vucherens communal drinking-water asset confirmed',
          ],
        },
      ],
      notes: [
        'Note téléphonique locale pour un défaut physique d’entretien non urgent d’un véritable équipement communal d’eau potable au point précis à Vucherens. Confirmez la responsabilité communale. Aucune urgence, danger immédiat, contamination ou risque sanitaire, coupure, fuite active/inondation, plomberie privée, nouveau branchement, demande de borne hydrante, route, égout, éclairage, gaz, déchets ou facture.',
        'La page de l’eau invite à signaler les problèmes du réseau à l’employé communal de piquet au 079 446 40 74. Cette note prépare seulement un premier appel facultatif; aucun appel, courriel ou envoi effectué. Elle ne sert pas aux urgences. Aucun nom, e-mail, téléphone ou photo collecté. Les exigences téléphoniques et l’acceptation anonyme restent inconnues.',
        'Confidentialité, conservation, pays de traitement et réception propres au signalement inconnus. Aucun consentement, champ ou formulaire municipal repris. Aucune finalisation externe ni suivi. Les tarifs de travaux privés exceptionnels ne sont pas des frais de signalement d’eau. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
