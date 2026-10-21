import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const orzensHomeUrl = 'https://orzens.ch/';
export const orzensAuthorityUrl = 'https://orzens.ch/municipalite/';
export const orzensAdministrationUrl = 'https://orzens.ch/greffe-municipal/';
export const orzensPrivacyUrl = 'https://orzens.ch/politique-confidentialite/';
export const orzensCategory = 'Observation présumée de frelon asiatique';
export const orzensScope =
  'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet individual or nest observation at its exact Orzens VD BFS5925 point. The specific municipal hornet notice invites announcements or questions to Frédéric Burkhard; the actual2026–2031 authority page confirms his current membership. His construction portfolio is not itself a hornet mandate. Record existing observed facts and uncertainty only, without species-identification guarantee, diagnosis, safety or urgency conclusion, or approach, capture, trap, bait or removal advice. Boundary alone proves neither an observation nor identification or safety. Excludes immediate or personal danger, medical/sting concerns, removal requests, bees/other species and other services. One local factual-suspected-observation/nonurgent confirmation is a worksheet rule, not a verified official field. Existing internal species_observation kind is not an Aarau/native case kind. No reporter contacts/photos/clinical or native fields/consent/client/state/payload/mail preparation/calls/sending/external completion/tracking. Published whitespace-bearing mailto is not repaired or launched. General info-email policy describes one-year retention and Infomaniak Swiss hosting in its own context, not this individual hornet recipient; official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unqualified. No anonymous or Swiss-only guarantee. Generic contact and providers/platforms remain unread. Specific local invitation is independent, never a workaround or automatic channel change after an uncertain platform report. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.';
export const orzensCategories = Object.freeze([
  Object.freeze({
    service_code: orzensCategory,
    service_name: 'Observation présumée de frelon asiatique – faits locaux',
  }),
]);
// Factual URL/digest pins only; no municipal pages, native state or client copies.
export const orzensSourcePins = Object.freeze(
  [
    {
      url: 'https://orzens.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://orzens.ch/',
      sha256: '7e1c08652a8f2b8d8cccd567352e7e725b1bc565d4988e36d8cfadb39a009fef',
      plain: false,
    },
    {
      url: 'https://orzens.ch/municipalite/',
      sha256: '7ef21d97463c813e32c30d726c35d3db75f69faf77258578ffad6c61a278fd56',
      plain: false,
    },
    {
      url: 'https://orzens.ch/greffe-municipal/',
      sha256: 'cdc8d7e784a193820bb1323bdf176fd34e403530bba77cdb1a8fdbf1e3549d40',
      plain: false,
    },
    {
      url: 'https://orzens.ch/politique-confidentialite/',
      sha256: '80e65ec53f4191f0cba9c967487ae0d671d8cc47b4f7289b84776901cbfd9160',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(orzensSourcePins);
export const inspectOrzensSource = verifier.inspect;
export const assertOrzensSourcesAvailable = verifier.assertAvailable;
export async function verifyOrzensSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return orzensCategories.map((c) => ({ ...c }));
}
export const loadOrzensCategories = verifyOrzensSources;
export function orzensRequirements(): Record<string, Requirements> {
  return {
    [orzensCategory]: {
      scope:
        'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet individual or nest observation at its exact Orzens VD BFS5925 point. The specific municipal hornet notice invites announcements or questions to Frédéric Burkhard; the actual2026–2031 authority page confirms his current membership. His construction portfolio is not itself a hornet mandate. Record existing observed facts and uncertainty only, without species-identification guarantee, diagnosis, safety or urgency conclusion, or approach, capture, trap, bait or removal advice. Boundary alone proves neither an observation nor identification or safety. Excludes immediate or personal danger, medical/sting concerns, removal requests, bees/other species and other services. One local factual-suspected-observation/nonurgent confirmation is a worksheet rule, not a verified official field. Existing internal species_observation kind is not an Aarau/native case kind. No reporter contacts/photos/clinical or native fields/consent/client/state/payload/mail preparation/calls/sending/external completion/tracking. Published whitespace-bearing mailto is not repaired or launched. General info-email policy describes one-year retention and Infomaniak Swiss hosting in its own context, not this individual hornet recipient; official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unqualified. No anonymous or Swiss-only guarantee. Generic contact and providers/platforms remain unread. Specific local invitation is independent, never a workaround or automatic channel change after an uncertain platform report. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.',
      report_kind: 'species_observation',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune d’Orzens – observation présumée de frelon asiatique, faits locaux'],
      extra_fields: [
        {
          code: 'hornet_observation_confirmed',
          description:
            'Confirm an existing nonurgent factual suspected Asian-hornet observation at the exact Orzens point, without an identification or safety conclusion',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent factual suspected Asian-hornet observation at exact Orzens point confirmed; no identification or safety conclusion',
          ],
        },
      ],
      notes: [
        'Fiche locale de faits pour une observation présumée de frelon asiatique, individu ou nid, déjà effectuée et indépendamment non urgente, au point précis confirmé dans Orzens. Décrivez les faits et vos incertitudes. La limite communale ne prouve ni l’observation, ni l’identification, ni la sécurité. La confirmation est une règle locale, pas une exigence officielle vérifiée.',
        'L’avis communal invite à adresser les annonces ou questions à Frédéric Burkhard, dont la qualité de municipal est confirmée pour2026–2031. Aucun diagnostic ou garantie d’identification, aucune conclusion sur la sécurité ou l’urgence, aucun conseil d’approche, de capture, de piégeage, d’appâtage ou d’enlèvement. Danger immédiat/personnel, inquiétudes médicales ou piqûres, demandes d’enlèvement, abeilles/autres espèces et autres services sont exclus.',
        'Aucune coordonnée, photo, donnée clinique, champ natif ou consentement collecté. Les conditions officielles d’identité, de photo, de confidentialité, de conservation, de pays, de transmission, d’anonymat et de réception de cette annonce restent inconnues. La politique générale décrit un an pour les contacts à info@orzens.ch et un hébergement suisse; elle ne qualifie pas le traitement par le destinataire individuel.',
        'Ces faits restent ici. Aucun courriel préparé, appel, envoi, formulaire officiel complet, finalisation externe ou suivi. Le lien mailto avec espace n’est ni corrigé ni ouvert. Aucun contrat ni champ Aarau importé. Cette invitation locale n’est pas un contournement d’un résultat incertain sur une plateforme. Ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par un bureau, élu, suppléant, téléphone ou prestataire.',
      ],
    },
  };
}
