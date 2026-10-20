import { createPinnedNoteVerifier } from './pinned-note-sources.js';
import type { Requirements } from './model.js';

export const bussignyRobotsUrl = 'https://www.bussigny.ch/robots.txt';
export const bussignyLightingUrl =
  'https://www.bussigny.ch/vivre-a-bussigny/infrastructures/electricite';
export const bussignyMunicipalityUrl =
  'https://www.bussigny.ch/ma-commune/la-municipalite/composition';
export const bussignyPrivacyUrl =
  'https://www.romande-energie.ch/declaration-de-protection-des-donnees';
export const bussignyProviderUrl = 'https://www.romande-energie.ch/infos-pannes';
export const bussignyLegalUrl = 'https://www.bussigny.ch/mentions-legales';
export const bussignyCategory = 'Éclairage public RE';
export const bussignyCategories = Object.freeze([
  Object.freeze({
    service_code: bussignyCategory,
    service_name: 'Éclairage public RE – note téléphonique',
  }),
]);
export const bussignyScope =
  'Local text-only telephone-note preparation for a nonurgent fault of an actual public streetlight operated by Romande Energie at its exact point in Bussigny VD (BFS5624). The municipality transferred its lighting network to the provider in2020. Its preferred email route asks for mast number and address; the recipient remains cloaked and is not decoded. Independently, the provider publishes a lighting-only phone route. This note prepares an initial optional call, never an automatic alternative after an attempted report. Confirm actual provider responsibility; boundary and resident confirmation alone do not prove ownership. Excludes urgent danger, fallen live wires, sparks, network or domestic electricity outages, private lamps, new connections, billing, roads, water, drainage and pollution. Phone reporter requirements, anonymous acceptance and incident privacy/retention/receipt are unknown. No reporter contacts/photos, native fields/client/payload, sending, external completion or tracking.';
// Only factual URLs/digests are published. Source text, bundles and policy
// snapshots remain outside the package and its fixtures.
export const bussignySourcePins = Object.freeze(
  [
    {
      url: 'https://www.bussigny.ch/robots.txt',
      sha256: 'd8d9897de7919b68e4716d681fe290750e80eb27223a1b71e0acaffc308572fe',
      plain: true,
    },
    {
      url: 'https://www.romande-energie.ch/robots.txt',
      sha256: '2a787f20489a257692bad5f16ae5ceb28876cd38d8d9cde9c84a2d3835e30bab',
      plain: true,
    },
    {
      url: 'https://www.bussigny.ch/ma-commune/services-communaux/infrastructures',
      sha256: 'ee3c9c79a7021748518cfc2e667dc178563306f690eb77769523d9639b8e1f6e',
      plain: false,
    },
    {
      url: 'https://www.bussigny.ch/ma-commune/la-municipalite/composition',
      sha256: '24f8ef98b4e0446b852a072ec12c3925d7ad2a50c06b9b17ff49950e1668b88d',
      plain: false,
    },
    {
      url: 'https://www.bussigny.ch/vivre-a-bussigny/infrastructures/electricite',
      sha256: '2996181da4d121effa8d7cd18b6cdafaced81a919c8a4aa26cb0207ed31cad62',
      plain: false,
    },
    {
      url: 'https://www.bussigny.ch/mentions-legales',
      sha256: '1412bb915ed4a6088c683e2136019d92c83ba1c04f885816c2743604b36b99d6',
      plain: false,
    },
    {
      url: 'https://www.romande-energie.ch/infos-pannes',
      sha256: '8ff1a450f3f3189ff4db36063c6f87a09b346a39ab84e1b5b81d9001fe292b70',
      plain: false,
    },
    {
      url: 'https://www.romande-energie.ch/declaration-de-protection-des-donnees',
      sha256: '737b78814e727219835f27b9bdcb189d2f6ef6da57bc92b5adcc05d258ce2baf',
      plain: false,
    },
  ].map((pin) => Object.freeze(pin)),
);
const sourceVerifier = createPinnedNoteVerifier(bussignySourcePins);
export const inspectBussignySource = sourceVerifier.inspect;
export const assertBussignySourcesAvailable = sourceVerifier.assertAvailable;
export async function verifyBussignySources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await sourceVerifier.verify(request, retry, now, sleep);
  return bussignyCategories.map((c) => ({ ...c }));
}
export const loadBussignyCategories = verifyBussignySources;
export function bussignyRequirements(): Record<string, Requirements> {
  return {
    [bussignyCategory]: {
      scope: bussignyScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Romande Energie – éclairage public (Bussigny)'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual Romande Energie public streetlight in Bussigny',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Bussigny RE public streetlight confirmed'],
        },
      ],
      notes: [
        'Note téléphonique locale pour une panne non urgente d’un véritable luminaire public exploité par Romande Energie, au point précis à Bussigny. Confirmez la responsabilité du fournisseur. Aucun danger immédiat, câble tombé, étincelle, panne de réseau ou domestique, lampe privée, raccordement, facture, défaut de voirie, eau, assainissement ou pollution.',
        'La commune indique une voie par courriel demandant le numéro réel du mât et son adresse; le destinataire reste masqué. Le fournisseur publie séparément le 0800 26 00 00 pour l’éclairage public seul. Cette note prépare un premier appel facultatif, sans changement automatique de canal après une tentative. Mentionnez un numéro de mât visible si vous le connaissez; cette aide locale ne constitue pas une exigence téléphonique vérifiée. Aucun appel ou courriel envoyé.',
        'Les coordonnées exigées au téléphone et l’acceptation anonyme sont inconnues. Aucun nom, e-mail, téléphone ou photo collecté. La politique générale du fournisseur prévoit le traitement des demandes, des partages avec le groupe, des prestataires et des autorités, et de possibles traitements internationaux; les durées générales ne prouvent pas la conservation d’un signalement. Pays, confidentialité et réception propres à cet appel non vérifiés. Aucun envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
