import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const chavannesMoudonRoadsUrl =
  'https://www.chavannes-sur-moudon.ch/routes-voirie-et-cimetiere/';
export const chavannesMoudonAuthorityUrl =
  'https://www.chavannes-sur-moudon.ch/autorites-communales/';
export const chavannesMoudonLegalUrl = 'https://www.chavannes-sur-moudon.ch/mentions-legales/';
export const chavannesMoudonCategory = 'Éclairage public communal';
export const chavannesMoudonRoadCategory = 'Chemins et signalisation communaux';
export const chavannesMoudonCategories = Object.freeze([
  Object.freeze({
    service_code: chavannesMoudonCategory,
    service_name: 'Éclairage communal – note téléphonique',
  }),
  Object.freeze({
    service_code: chavannesMoudonRoadCategory,
    service_name: 'Chemins et signalisation – note téléphonique',
  }),
]);
export const chavannesMoudonLightingConfirmation =
  'Nonurgent fault of actual Chavannes-sur-Moudon communal streetlight confirmed';
export const chavannesMoudonRoadConfirmation =
  'Nonurgent fault of actual Chavannes-sur-Moudon communal road or signage confirmed';
export const chavannesMoudonScope =
  'Local French telephone-note preparation for a nonurgent fault of an actual communal public streetlight or actual communal road/path/signage at its precise Chavannes-sur-Moudon point (BFS5665). The municipality explicitly invites these faults with location to its administration and publishes telephone0219056094 on the same page. Initial optional call note only, distinct asset confirmation per category. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, active traffic hazards or obstructions, fallen wires/sparks, outages, private assets, enforcement, neighbour disputes, water/drains/gas/pollution, graves/inhumation/cards/fees. Phone reporter requirements, anonymous acceptance, incident privacy/retention/country/receipt remain unknown. No reporter contacts/photos, native fields/consent/client/state/payload, sending, external completion or tracking. Generic Ninja Forms4 native contact, honeypot and client state never requested or inherited. Authority term is not explicitly2026–2031; no wider AISTBV/AECLC/RE geography or ownership inferred.';
// Factual URLs/digests only, independently authored logic/fixtures; no site copies.
export const chavannesMoudonSourcePins = Object.freeze(
  [
    {
      url: 'https://www.chavannes-sur-moudon.ch/robots.txt',
      sha256: '70cbee01fbe2f31df96a9cdb617d2db6e853dbb5b598c143eb3069b286e559f8',
      plain: true,
    },
    {
      url: 'https://www.chavannes-sur-moudon.ch/routes-voirie-et-cimetiere/',
      sha256: '124a072ef88cb5d4302c3b6615a4123462accee6b7d1ee8106ed8e6cff9fd296',
      plain: false,
    },
    {
      url: 'https://www.chavannes-sur-moudon.ch/autorites-communales/',
      sha256: '91e1f8aff0ec6e68df9516979de5cc25616b7e56cd6bd51e9a9a3bd77d769bb4',
      plain: false,
    },
    {
      url: 'https://www.chavannes-sur-moudon.ch/mentions-legales/',
      sha256: 'c1e8a50a4cd0bf7e2920eaeaa70a9f63f9607abc63771493ea84158b3b2188fb',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const sourceVerifier = createPinnedNoteVerifier(chavannesMoudonSourcePins);
export const inspectChavannesMoudonSource = sourceVerifier.inspect;
export const assertChavannesMoudonSourcesAvailable = sourceVerifier.assertAvailable;
export async function verifyChavannesMoudonSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await sourceVerifier.verify(request, retry, now, sleep);
  return chavannesMoudonCategories.map((c) => ({ ...c }));
}
export const loadChavannesMoudonCategories = verifyChavannesMoudonSources;
export function chavannesMoudonRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    chavannesMoudonCategories.map((c) => {
      const lighting = c.service_code === chavannesMoudonCategory;
      return [
        c.service_code,
        {
          scope: chavannesMoudonScope,
          photo_required: false,
          max_photos: 0,
          email_required: false,
          email_supported: false,
          name_required: false,
          phone_required: false,
          contact_fields: [],
          description_max_length: 4000,
          location_label_max_length: 250,
          bodies: ['Commune de Chavannes-sur-Moudon – administration'],
          extra_fields: [
            {
              code: 'public_asset_confirmed',
              description: lighting
                ? 'Confirm a nonurgent fault of an actual communal streetlight in Chavannes-sur-Moudon'
                : 'Confirm a nonurgent fault of an actual communal road or signage in Chavannes-sur-Moudon',
              required: true,
              datatype: 'string',
              values: [
                lighting ? chavannesMoudonLightingConfirmation : chavannesMoudonRoadConfirmation,
              ],
            },
          ],
          notes: [
            lighting
              ? 'Note téléphonique locale pour un défaut non urgent d’un véritable luminaire public communal au point précis à Chavannes-sur-Moudon. Confirmez la responsabilité communale.'
              : 'Note téléphonique locale pour un défaut non urgent d’un véritable chemin ou panneau communal au point précis à Chavannes-sur-Moudon. Confirmez la responsabilité communale.',
            'La commune invite à signaler ces défauts à son administration avec l’emplacement et publie le 021 905 60 94 sur la même page. Premier appel facultatif uniquement; aucun appel ou courriel envoyé. Aucun danger immédiat, risque ou obstacle actif pour la circulation, câble tombé, étincelle, coupure, équipement privé, police, litige de voisinage, eau, assainissement, gaz, pollution, tombe, inhumation, carte ou facture.',
            'Aucun nom, e-mail, téléphone ou photo collecté. Exigences téléphoniques, acceptation anonyme, confidentialité, conservation, pays de traitement et réception du signalement inconnus. Les coordonnées et l’accord de confidentialité du formulaire général ne sont pas des exigences téléphoniques. Formulaire Ninja Forms4, champ antispam, client et état jamais demandés ou exécutés. Aucun envoi, finalisation externe ou suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
          ],
        } satisfies Requirements,
      ];
    }),
  );
}
