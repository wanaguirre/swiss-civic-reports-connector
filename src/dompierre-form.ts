import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const dompierreHomeUrl = 'https://dompierre-vd.ch/';
export const dompierreServicesUrl = 'https://dompierre-vd.ch/index.php/services-communaux/';
export const dompierreAuthorityUrl =
  'https://dompierre-vd.ch/index.php/vie-politique-et-reglements/';
export const dompierreCategory = 'Routes communales';
export const dompierreCategories = Object.freeze([
  Object.freeze({
    service_code: dompierreCategory,
    service_name: 'Routes communales – note téléphonique',
  }),
]);
export const dompierreScope =
  'Local French telephone-note preparation for a nonurgent physical maintenance fault of an actual communal road surface at its precise Dompierre VD point (BFS5671). The municipal voirie page explicitly invites communal road reports to Guillaume Diserens and publishes telephone0788739737; actual2026–2031 authority confirms his road responsibility. Initial optional call only. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, active traffic risks/obstructions/accidents, enforcement, cantonal or private roads/assets, lighting, water/drainage/gas, waste, trees and billing. Telephone reporter requirements, anonymous acceptance and incident privacy/retention/country/receipt remain unknown. No reporter contacts/photos, native fields/consent/client/state/payload, calls/email/sending, external completion or tracking. Planned lighting switch-off23–05 is not a fault intake; EauSud/AIR-PRO links add no road coverage. Finance phone display/href discrepancy is separate from the verified road contact.';
// Factual URL/digests and own fixtures only; no municipal source copies.
export const dompierreSourcePins = Object.freeze(
  [
    {
      url: 'https://dompierre-vd.ch/robots.txt',
      sha256: '1d988bcabf26585712b9efcbdf93b8fd100ae48a43195b6a4558b91b92626beb',
      plain: true,
    },
    {
      url: 'https://dompierre-vd.ch/',
      sha256: '2bdecf0d9e3f7152063e760e5b588003ec66e71836b897a94d8a46d88a392b2d',
      plain: false,
    },
    {
      url: 'https://dompierre-vd.ch/index.php/services-communaux/',
      sha256: '9f8ee0b5a7e5f430656d84502325a8207f11e68e7a4cf096d60f436c5dbb2662',
      plain: false,
    },
    {
      url: 'https://dompierre-vd.ch/index.php/vie-politique-et-reglements/',
      sha256: 'a0930659878175413fb4376736b070325b7efad1d283bf8e5cbddb248f2eb0e7',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const sourceVerifier = createPinnedNoteVerifier(dompierreSourcePins);
export const inspectDompierreSource = sourceVerifier.inspect;
export const assertDompierreSourcesAvailable = sourceVerifier.assertAvailable;
export async function verifyDompierreSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await sourceVerifier.verify(request, retry, now, sleep);
  return dompierreCategories.map((c) => ({ ...c }));
}
export const loadDompierreCategories = verifyDompierreSources;
export function dompierreRequirements(): Record<string, Requirements> {
  return {
    [dompierreCategory]: {
      scope: dompierreScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Dompierre VD – routes'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent physical maintenance fault of an actual communal road surface in Dompierre VD',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Dompierre VD communal road confirmed'],
        },
      ],
      notes: [
        'Note téléphonique locale pour un défaut d’entretien physique non urgent du revêtement d’une véritable route communale au point précis à Dompierre VD. Confirmez la responsabilité communale. Aucun danger, risque ou obstacle actif pour la circulation, accident, police, route cantonale ou privée, éclairage, eau/assainissement/gaz, déchets, arbres ou facture.',
        'La voirie invite à signaler les problèmes des routes communales à Guillaume Diserens au 078 873 97 37. Cette note prépare seulement un premier appel facultatif; aucun appel ni courriel envoyé. Aucun nom, e-mail, téléphone ou photo collecté. Les exigences téléphoniques et l’acceptation anonyme sont inconnues.',
        'Confidentialité, conservation, pays de traitement et réception propres au signalement inconnus. Aucune exigence des documents d’identité ou de la recherche du site reprise. Aucun formulaire, client, champ ou consentement municipal inventé. Aucun envoi, finalisation externe ou suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
