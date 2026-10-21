import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const cuarnyHomeUrl = 'https://www.cuarny.ch/accueil';
export const cuarnyWaterUrl = 'https://www.cuarny.ch/vie-pratique/eau-potable';
export const cuarnyAuthorityUrl = 'https://www.cuarny.ch/municipalite/autorites';
export const cuarnyAdministrationUrl = 'https://www.cuarny.ch/municipalite/administration';
export const cuarnyCategory = 'Qualité perçue de l’eau potable';
export const cuarnyScope =
  'Local French facts worksheet for an independently confirmed nonurgent factual observation about the perceived quality of actual Cuarny-supplied drinking water at its exact BFS5911 point. The official water page explicitly asks perceived-quality observations to municipal water official Jérémie Cartier; the explicit2026–2031 portfolio confirms that responsibility. The water comes exclusively from Sagenord since2022 and local sources are under rehabilitation; neither fact proves the observed cause, pipe ownership or completed works. Boundary alone cannot prove water origin, cause or safety. This worksheet records existing facts only; no diagnosis, clinical report, sampling/testing advice or cause, safety, drinkability or urgency conclusion. Excludes health/contamination/illness concerns, emergencies, outages, active leaks/flooding, private-plumbing repairs, billing, new connections, physical-asset fault attribution and other services. One local actual-supply/nonurgent-factual-observation confirmation is a worksheet rule, not an official form requirement. No reporter contacts/photos/clinical fields/native consent/client/state/payload/mail preparation/calls/sending/external completion/tracking. The published email is literal jeremie.cartier(at)cuarny.ch with a hash link, not decoded, repaired or launched. Official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unknown; no anonymous or Swiss-only guarantee. General contact, native clients and providers remain unread. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.';
export const cuarnyCategories = Object.freeze([
  Object.freeze({
    service_code: cuarnyCategory,
    service_name: 'Qualité perçue de l’eau potable – faits locaux',
  }),
]);
// Factual URL/digest pins only; no municipal pages, protected email decoding or clients.
export const cuarnySourcePins = Object.freeze(
  [
    {
      url: 'https://www.cuarny.ch/robots.txt',
      sha256: '3a125e84a637dc3f5442bb6949fa200056f37db4627b4c2a3addc55bbb89b703',
      plain: true,
    },
    {
      url: 'https://www.cuarny.ch/accueil',
      sha256: 'fd7b1da32344e7a28cc55c65dcd1c80c61b5744b5aa125ac6416e5460a291738',
      plain: false,
    },
    {
      url: 'https://www.cuarny.ch/vie-pratique/eau-potable',
      sha256: 'a0073e3ba3c2c28f0e736f3dc0792f99e03549d232106af9167d431adb3e2688',
      plain: false,
    },
    {
      url: 'https://www.cuarny.ch/municipalite/autorites',
      sha256: '428dc1c779a2d4651236ab3142fe1f5bf7d70c8dc4c142a84234ee7a155971f3',
      plain: false,
    },
    {
      url: 'https://www.cuarny.ch/municipalite/administration',
      sha256: '0217ef9a244d8b4fc9be63240679f34a49c2ff1baf05002dbc9e63a55fdcbf83',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(cuarnySourcePins);
export const inspectCuarnySource = verifier.inspect;
export const assertCuarnySourcesAvailable = verifier.assertAvailable;
export async function verifyCuarnySources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return cuarnyCategories.map((c) => ({ ...c }));
}
export const loadCuarnyCategories = verifyCuarnySources;
export function cuarnyRequirements(): Record<string, Requirements> {
  return {
    [cuarnyCategory]: {
      scope:
        'Local French facts worksheet for an independently confirmed nonurgent factual observation about the perceived quality of actual Cuarny-supplied drinking water at its exact BFS5911 point. The official water page explicitly asks perceived-quality observations to municipal water official Jérémie Cartier; the explicit2026–2031 portfolio confirms that responsibility. The water comes exclusively from Sagenord since2022 and local sources are under rehabilitation; neither fact proves the observed cause, pipe ownership or completed works. Boundary alone cannot prove water origin, cause or safety. This worksheet records existing facts only; no diagnosis, clinical report, sampling/testing advice or cause, safety, drinkability or urgency conclusion. Excludes health/contamination/illness concerns, emergencies, outages, active leaks/flooding, private-plumbing repairs, billing, new connections, physical-asset fault attribution and other services. One local actual-supply/nonurgent-factual-observation confirmation is a worksheet rule, not an official form requirement. No reporter contacts/photos/clinical fields/native consent/client/state/payload/mail preparation/calls/sending/external completion/tracking. The published email is literal jeremie.cartier(at)cuarny.ch with a hash link, not decoded, repaired or launched. Official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unknown; no anonymous or Swiss-only guarantee. General contact, native clients and providers remain unread. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Cuarny – faits sur la qualité perçue de l’eau potable'],
      extra_fields: [
        {
          code: 'quality_observation_confirmed',
          description:
            'Confirm actual Cuarny-supplied water and an independently nonurgent factual observation without diagnosis or safety conclusion',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent factual perceived-quality observation of actual Cuarny-supplied drinking water at exact point confirmed; no diagnosis, cause or safety conclusion',
          ],
        },
      ],
      notes: [
        'Fiche locale de faits pour une observation non urgente sur la qualité perçue de l’eau potable réellement fournie à Cuarny, au point précis confirmé. Confirmez séparément l’origine réelle de l’eau et le caractère factuel non urgent. La limite communale ne prouve ni l’origine de l’eau, ni une cause, ni sa sécurité. Aucun défaut ou droit de propriété d’un équipement public n’est déduit.',
        'La page communale invite à communiquer les observations sur la qualité perçue à Jérémie Cartier; son dicastère eau potable est confirmé pour2026–2031. L’eau provient exclusivement de Sagenord depuis2022; les sources communales sont en réhabilitation. La fiche reste locale: aucune préparation de courriel, aucun appel ou envoi. L’adresse publiée jeremie.cartier(at)cuarny.ch n’est ni décodée, ni corrigée, ni ouverte.',
        'Consignez uniquement les faits déjà observés. Aucun diagnostic, conseil de prélèvement ou de test, conclusion sur la cause, la sécurité, la potabilité ou l’urgence. Aucune information clinique demandée. Les inquiétudes sanitaires, contamination ou maladie, urgences, coupures, fuites actives/inondations, réparations de plomberie privée, factures, nouveaux raccordements et autres services sont exclus. La confirmation est une règle locale, pas une exigence officielle vérifiée.',
        'Aucune coordonnée, photo ou consentement collecté. Identité officielle, photos, confidentialité, conservation, pays, transmission, anonymat et réception restent inconnus. Aucun formulaire officiel complet, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par un bureau, élu, suppléant, téléphone ou prestataire.',
      ],
    },
  };
}
