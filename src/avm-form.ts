import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const avmProviderUrl = 'https://www.avm-eau.com/';
export const avmReferralUrl = 'https://www.vaux-sur-morges.ch/Services-communaux';
export const avmMunicipalPrivacyUrl =
  'https://www.vaux-sur-morges.ch/Politique-de-confidentialite2';
export const avmCategory = 'Eau potable communale AVM';
export const avmCategories = Object.freeze([
  Object.freeze({ service_code: avmCategory, service_name: 'Eau potable AVM – note téléphonique' }),
]);
export const avmMunicipalities = Object.freeze({
  'avm-chigny': Object.freeze({ bfsId: 5628, municipality: 'Chigny' }),
  'avm-clarmont': Object.freeze({ bfsId: 5629, municipality: 'Clarmont' }),
  'avm-echichens': Object.freeze({ bfsId: 5634, municipality: 'Echichens' }),
  'avm-vaux': Object.freeze({ bfsId: 5650, municipality: 'Vaux-sur-Morges' }),
  'avm-vufflens': Object.freeze({ bfsId: 5653, municipality: 'Vufflens-le-Château' }),
  'avm-hautemorges': Object.freeze({ bfsId: 5656, municipality: 'Hautemorges' }),
});
export type AvmMunicipality = keyof typeof avmMunicipalities;
export function isAvmMunicipality(name: string): name is AvmMunicipality {
  return Object.hasOwn(avmMunicipalities, name);
}
function avmIdentity(name: AvmMunicipality) {
  if (!isAvmMunicipality(name)) throw new Error('Unsupported AVM municipality.');
  return avmMunicipalities[name];
}
export function avmConfirmation(name: AvmMunicipality): string {
  return `Nonurgent fault of actual AVM communal drinking-water asset in ${avmIdentity(name).municipality} confirmed`;
}
export function avmScopeFor(name: AvmMunicipality): string {
  const p = avmIdentity(name);
  return `Local French telephone-note preparation for a nonurgent maintenance fault of an actual AVM communal drinking-water asset at its precise point in ${p.municipality} (BFS${p.bfsId}). AVM explicitly lists six served municipalities and a dedicated dépannage service; Vaux independently refers water dépannage/intervention to AVM. Confirm the exact municipality and actual AVM asset responsibility; boundary and resident confirmation alone do not prove ownership or service to every asset. Initial optional call note only. Excludes emergencies, active leaks, floods, contamination, health concerns, supply outages, private plumbing, connections, billing, hydrant use, general roads, lighting and wastewater. Published main contact0796380181 and substitute0799152487 are context, never automatic alternatives after uncertainty. Provider staff postal Yens is not served geography; historical Bussy-Chardonney is not an additional municipality. Telephone reporter requirements, anonymous acceptance, incident privacy/retention/country and receipt are unknown. No reporter contacts/photos, native fields/consent/client/state/payload, sending, external completion or tracking. Protected municipal routes are never requested.`;
}
// Factual pins only; no copied municipal/provider snapshots or client bundles.
export const avmSourcePins = Object.freeze(
  [
    {
      url: 'https://www.avm-eau.com/robots.txt',
      sha256: 'bf6101c32cd09a0796cf42598d621d2ed60416e0f996532c060a656894631cc6',
      plain: true,
    },
    {
      url: 'https://www.vaux-sur-morges.ch/robots.txt',
      sha256: '30effdc4f7ebb838447dc49a363cda4ba2ec905f07626fa008d83192885f4821',
      plain: true,
    },
    {
      url: 'https://www.vaux-sur-morges.ch/Services-communaux',
      sha256: '8055a0a48eada50839de7d96da27443e05093d9c758dd6dc96a6ad4a8020adbf',
      plain: false,
    },
    {
      url: 'https://www.vaux-sur-morges.ch/Politique-de-confidentialite2',
      sha256: '39cd0cafccd8b494eb87d5a7574cfa4272cdc274d225836b07d9a36b552c0b26',
      plain: false,
    },
    {
      url: 'https://www.vaux-sur-morges.ch/Vie-politique-et-reglements',
      sha256: '4ea4719762c00f55b1bf582abe5aaf12949c3cc896cda1ea2268b48c7a2595d4',
      plain: false,
    },
    {
      url: 'https://www.avm-eau.com/',
      sha256: '9e07e77c3ca0683646f41f937e1458adffcf2ea7143774023094045f0566b8e0',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
// One verifier for all six: one failed context stops every cached family peer.
const sourceVerifier = createPinnedNoteVerifier(avmSourcePins);
export const inspectAvmSource = sourceVerifier.inspect;
export const assertAvmSourcesAvailable = sourceVerifier.assertAvailable;
export async function verifyAvmSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await sourceVerifier.verify(request, retry, now, sleep);
  return avmCategories.map((c) => ({ ...c }));
}
export const loadAvmCategories = verifyAvmSources;
export function avmRequirements(name: AvmMunicipality): Record<string, Requirements> {
  const p = avmIdentity(name);
  return {
    [avmCategory]: {
      scope: avmScopeFor(name),
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: [`AVM – eau potable communale de ${p.municipality}`],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: `Confirm a nonurgent maintenance fault of an actual AVM communal drinking-water asset in ${p.municipality}`,
          required: true,
          datatype: 'string',
          values: [avmConfirmation(name)],
        },
      ],
      notes: [
        `Note téléphonique locale pour un défaut d’entretien non urgent d’un véritable équipement communal d’eau potable AVM au point précis à ${p.municipality}. Confirmez la responsabilité AVM. Aucune urgence, fuite active, inondation, contamination, question sanitaire, coupure d’eau, installation privée, raccordement, facture, utilisation de borne hydrante, voirie générale, éclairage ou assainissement.`,
        'AVM publie son service de dépannage: Olivier Vuffray au 079 638 01 81; remplaçant Thibault Gebhard au 079 915 24 87. Cette note prépare seulement un premier appel facultatif. Aucun appel ni courriel envoyé. Ces contacts ne constituent jamais un changement de canal ou une relance automatique après un résultat incertain. Yens est une adresse du personnel, pas une commune desservie dans cette liste.',
        'Les exigences de coordonnées au téléphone, l’acceptation anonyme, la confidentialité, le pays de traitement, la conservation et la réception propres au signalement restent inconnus. La politique du site de Vaux ne prouve pas les règles des appels AVM. Aucun nom, e-mail, téléphone ou photo collecté. Aucun formulaire, client, état, consentement ou champ antispam communal repris. Aucun envoi, finalisation externe ou suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
