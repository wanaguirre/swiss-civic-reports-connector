import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const yvonandHomeUrl = 'https://yvonand.ch/';
export const yvonandAdministrationUrl =
  'https://yvonand.ch/yvonand-au-quotidien/administration-communale/';
export const yvonandNoticeUrl =
  'https://yvonand.ch/yvonand-au-quotidien/pilier-public/pilierpublic/listing/information-importante-frelon-asiatique';
export const yvonandLeafletUrl =
  'https://yvonand.ch/wp-content/sabai/File/files/338959d3491eeb14c4cd3e81e2fb6fad.pdf';
export const yvonandAuthorityUrl = 'https://yvonand.ch/vie-politique/mhj/';
export const yvonandCategory = 'Nid présumé de frelon asiatique';
export const yvonandScope =
  'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet NEST at its exact Yvonand VD BFS5939 point. The municipal notice asks for a platform announcement AND commune information by email OR phone, accompanied by one or more photos. These local facts fulfill neither official announcement and leave the required photos unfulfilled; this is not a complete official form or an alternative channel. No email/call preparation, sending, external completion or tracking. Existing already observed facts only; no new approach, inspection, photograph, filming, testing, handling, capture, trapping, bait or removal advice. No identification guarantee, diagnosis, safety, urgency, medical, legal, eligibility, removal, reimbursement or cost conclusion. The published municipal funding statement is context, not a payment or removal promise. Excludes individual-only sightings, other species, immediate or personal danger, medical/sting concerns and removal requests. Exact point alone proves neither observation, species, ownership, safety nor eligibility; require a separate local existing-factual/nonurgent-suspected-nest confirmation, not verified official requiredness. Internal species_observation imports no native platform case kind or fields. No reporter contacts, account/customer identifiers, photos, clinical/native fields, consent, client state or payload collected. Official identity/photo-transfer/privacy/retention/country/forwarding/guest or anonymous acceptance/receipt remain unqualified. Known platform restrictions remain binding. The current2031 executive does not establish an individual member intake mandate. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone, contractor or provider fallback.';
export const yvonandCategories = Object.freeze([
  Object.freeze({
    service_code: yvonandCategory,
    service_name: 'Nid présumé de frelon asiatique – faits locaux',
  }),
]);
export const yvonandSourcePins = Object.freeze(
  [
    {
      url: 'https://yvonand.ch/robots.txt',
      sha256: 'b66ba26fd435ac77970b108db5aa0e47bfc5a38f7dfbaaa874b457c0a2d20606',
      plain: true,
    },
    {
      url: 'https://yvonand.ch/',
      sha256: '0aefdc5dca09f28e725252dedcca396ca80a5545d1fb172a90c8d1d24d6080b4',
      plain: false,
    },
    {
      url: 'https://yvonand.ch/yvonand-au-quotidien/administration-communale/',
      sha256: '2d1ef196e13300cc4871b34723ea73e592994c44824144c4e70d306a3e5ab28a',
      plain: false,
    },
    {
      url: 'https://yvonand.ch/yvonand-au-quotidien/pilier-public/pilierpublic/listing/information-importante-frelon-asiatique',
      sha256: '56cbff66712d477f552c927a30d40f45230a75e264e3d673586c35726ff11231',
      plain: false,
    },
    {
      url: 'https://yvonand.ch/wp-content/sabai/File/files/338959d3491eeb14c4cd3e81e2fb6fad.pdf',
      sha256: '0e3ada73243d7a28ee1275a38015dd146fad85f9fe4cfdfddaa86d68b862e27b',
      plain: false,
      pdf: true as const,
    },
    {
      url: 'https://yvonand.ch/vie-politique/mhj/',
      sha256: 'e5c4f464f9f71867896839b2c6bd2786cb2ef14ad7e4490509154cacbfe57bda',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(yvonandSourcePins);
export const inspectYvonandSource = verifier.inspect;
export const assertYvonandSourcesAvailable = verifier.assertAvailable;
export async function verifyYvonandSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return yvonandCategories.map((c) => ({ ...c }));
}
export const loadYvonandCategories = verifyYvonandSources;
export function yvonandRequirements(): Record<string, Requirements> {
  return {
    [yvonandCategory]: {
      scope:
        'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet NEST at its exact Yvonand VD BFS5939 point. The municipal notice asks for a platform announcement AND commune information by email OR phone, accompanied by one or more photos. These local facts fulfill neither official announcement and leave the required photos unfulfilled; this is not a complete official form or an alternative channel. No email/call preparation, sending, external completion or tracking. Existing already observed facts only; no new approach, inspection, photograph, filming, testing, handling, capture, trapping, bait or removal advice. No identification guarantee, diagnosis, safety, urgency, medical, legal, eligibility, removal, reimbursement or cost conclusion. The published municipal funding statement is context, not a payment or removal promise. Excludes individual-only sightings, other species, immediate or personal danger, medical/sting concerns and removal requests. Exact point alone proves neither observation, species, ownership, safety nor eligibility; require a separate local existing-factual/nonurgent-suspected-nest confirmation, not verified official requiredness. Internal species_observation imports no native platform case kind or fields. No reporter contacts, account/customer identifiers, photos, clinical/native fields, consent, client state or payload collected. Official identity/photo-transfer/privacy/retention/country/forwarding/guest or anonymous acceptance/receipt remain unqualified. Known platform restrictions remain binding. The current2031 executive does not establish an individual member intake mandate. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone, contractor or provider fallback.',
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
      bodies: ['Commune d’Yvonand – nid présumé de frelon asiatique, faits locaux'],
      extra_fields: [
        {
          code: 'hornet_nest_confirmed',
          description:
            'Confirm an existing independently nonurgent suspected nest at the exact Yvonand point; both announcements and required photos remain unfulfilled',
          required: true,
          datatype: 'string',
          values: [
            'Existing independently nonurgent suspected nest at exact Yvonand point confirmed; identification remains uncertain and both official announcements incomplete',
          ],
        },
      ],
      notes: [
        'Faits locaux pour un nid présumé de frelon asiatique déjà observé et indépendamment non urgent au point précis confirmé dans Yvonand. Décrivez uniquement les faits existants et vos incertitudes. La confirmation est une règle locale, pas un champ officiel vérifié. Les observations d’un individu seul sont exclues de cette fiche communale sur les nids.',
        'L’avis municipal demande une annonce sur la plateforme ET une information à la commune par courriel OU téléphone, avec une ou plusieurs photos. Cette fiche locale ne réalise aucune des deux annonces et laisse aussi l’exigence de photos NON REMPLIE. Elle ne remplace aucun canal et n’est pas un formulaire officiel complet. Aucune photo collectée; aucune nouvelle approche, inspection, photographie, vidéo, mesure ou manipulation demandée.',
        'Aucune identification garantie ni conclusion sur la sécurité, l’urgence, la santé, le droit, l’admissibilité, l’enlèvement, le remboursement ou le coût. La prise en charge publiée par la commune ne devient pas une promesse de paiement ou d’intervention. Danger immédiat/personnel, inquiétudes médicales ou piqûres, autres espèces et demandes d’enlèvement exclus. Aucun conseil de capture, piégeage, appâtage ou enlèvement.',
        'Aucune coordonnée, référence de compte/client, photo, donnée clinique, champ natif ou consentement collecté. Identité officielle, transfert des photos, confidentialité, conservation, pays, transmission, anonymat et réception restent inconnus. Aucun champ natif de plateforme importé et aucune restriction contournée. Les faits restent ici: aucun courriel préparé, appel, envoi, finalisation externe ou suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par bureau, élu, suppléant, téléphone, entrepreneur ou prestataire.',
      ],
    },
  };
}
