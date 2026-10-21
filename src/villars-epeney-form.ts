import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const villarsEpeneyHomeUrl = 'https://www.villars-epeney.ch/';
export const villarsEpeneyAdministrationUrl =
  'https://www.villars-epeney.ch/autorites/administrration';
export const villarsEpeneyAuthorityUrl = 'https://www.villars-epeney.ch/autorites/municipalite';
export const villarsEpeneyRegulationsUrl = 'https://www.villars-epeney.ch/reglements';
export const villarsEpeneyWaterUrl = 'https://www.villars-epeney.ch/doc/regl_eau.pdf';
export const villarsEpeneyAnnexUrl = 'https://www.villars-epeney.ch/doc/regl_eaux_annexe.pdf';
export const villarsEpeneyCategory = 'Compteur d’eau communal';
export const villarsEpeneyScope =
  'Local French facts worksheet for a legitimate subscriber’s actual communal water meter with an already observed, independently nonurgent mechanical defect at its exact Villars-Epeney VD BFS5935 point. Published regulation articles14–15 describe the communal rented meter and ask the subscriber to notify the Municipality immediately of damage. These local facts do not perform that notification, establish legal compliance or extend any deadline. Exact point alone proves neither subscription, meter ownership nor a defect. Require a separate local subscriber/actual-meter/nonurgent-facts confirmation; it is not verified official requiredness or account validation. Record existing observed facts only, without cause, diagnosis, safety, urgency, legal, accuracy, tariff or billing conclusions. Exclude active leaks, supply interruption/pressure or health/contamination concerns, private pipes/valves or other assets, billing/accuracy disputes, connection/subscription changes and requests to inspect, test, handle, unseal, dismantle or repair equipment. No new observation, reading, testing, photograph, manipulation or repair advice. No reporter contacts, account/customer/meter serial identifiers, photos, clinical/native fields, consent, client state, payload, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unqualified; no anonymous or Swiss-only guarantee. The undated roster is not a confirmed2031 composition or individual meter-intake mandate. The separately published2025 tariff annex is distinct from the old embedded annex; this worksheet makes no charge, liability or legal-entry promise. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone, contractor or provider fallback. This is not a complete official form.';
export const villarsEpeneyCategories = Object.freeze([
  Object.freeze({
    service_code: villarsEpeneyCategory,
    service_name: 'Compteur d’eau communal – faits locaux',
  }),
]);
export const villarsEpeneySourcePins = Object.freeze(
  [
    {
      url: 'https://www.villars-epeney.ch/robots.txt',
      sha256: 'f1a6b5e3f6e69a71c53516c4bce70e2414429d23dab6814239500999eb80907e',
      plain: true,
    },
    {
      url: 'https://www.villars-epeney.ch/',
      sha256: '0b37cd5ccfbd9024d7236654cc911aa1137946bdbc285db05cf0e1b2a46d7a14',
      plain: false,
    },
    {
      url: 'https://www.villars-epeney.ch/autorites/administrration',
      sha256: 'fba32464386372c34699c06d37c3bc75bc8339c1717c9147ec93efdfa6bb37f3',
      plain: false,
    },
    {
      url: 'https://www.villars-epeney.ch/autorites/municipalite',
      sha256: 'eeb08e098ed3aa52eb9ddec32b3467a435d3af9a0a73aa1a79fb51d5f7942666',
      plain: false,
    },
    {
      url: 'https://www.villars-epeney.ch/reglements',
      sha256: 'f8146a1a2a1a83f2e63c49f15ce3df6653dbf9ccd209bad0c0910eb730cf1216',
      plain: false,
    },
    {
      url: 'https://www.villars-epeney.ch/doc/regl_eau.pdf',
      sha256: 'ba7b5e31f2cb4ad093992ce99b424bc1aa76af586eab03aeb4938a7d2041d355',
      plain: false,
      pdf: true as const,
    },
    {
      url: 'https://www.villars-epeney.ch/doc/regl_eaux_annexe.pdf',
      sha256: 'aeaedd9691cb4bca005f12208d4c3c089838774463f5f0ad4e8b522d19bd8e4b',
      plain: false,
      pdf: true as const,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(villarsEpeneySourcePins);
export const inspectVillarsEpeneySource = verifier.inspect;
export const assertVillarsEpeneySourcesAvailable = verifier.assertAvailable;
export async function verifyVillarsEpeneySources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return villarsEpeneyCategories.map((c) => ({ ...c }));
}
export const loadVillarsEpeneyCategories = verifyVillarsEpeneySources;
export function villarsEpeneyRequirements(): Record<string, Requirements> {
  return {
    [villarsEpeneyCategory]: {
      scope:
        'Local French facts worksheet for a legitimate subscriber’s actual communal water meter with an already observed, independently nonurgent mechanical defect at its exact Villars-Epeney VD BFS5935 point. Published regulation articles14–15 describe the communal rented meter and ask the subscriber to notify the Municipality immediately of damage. These local facts do not perform that notification, establish legal compliance or extend any deadline. Exact point alone proves neither subscription, meter ownership nor a defect. Require a separate local subscriber/actual-meter/nonurgent-facts confirmation; it is not verified official requiredness or account validation. Record existing observed facts only, without cause, diagnosis, safety, urgency, legal, accuracy, tariff or billing conclusions. Exclude active leaks, supply interruption/pressure or health/contamination concerns, private pipes/valves or other assets, billing/accuracy disputes, connection/subscription changes and requests to inspect, test, handle, unseal, dismantle or repair equipment. No new observation, reading, testing, photograph, manipulation or repair advice. No reporter contacts, account/customer/meter serial identifiers, photos, clinical/native fields, consent, client state, payload, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest acceptance/receipt remain unqualified; no anonymous or Swiss-only guarantee. The undated roster is not a confirmed2031 composition or individual meter-intake mandate. The separately published2025 tariff annex is distinct from the old embedded annex; this worksheet makes no charge, liability or legal-entry promise. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone, contractor or provider fallback. This is not a complete official form.',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Villars-Epeney – compteur communal, faits locaux'],
      extra_fields: [
        {
          code: 'meter_fault_confirmed',
          description:
            'Confirm legitimate subscriber, actual communal water meter and existing independently nonurgent mechanical defect at the exact Villars-Epeney point; no leak, outage, testing or diagnosis',
          required: true,
          datatype: 'string',
          values: [
            'Legitimate subscriber confirms actual Villars-Epeney communal water meter and existing independently nonurgent mechanical fault at exact point; no leak, outage, testing or diagnosis',
          ],
        },
      ],
      notes: [
        'Fiche locale de faits pour un abonné légitime et son véritable compteur d’eau communal, présentant un défaut mécanique déjà observé et indépendamment non urgent au point précis confirmé dans Villars-Epeney. La confirmation est une règle locale, pas un champ officiel vérifié ni une validation du compte.',
        'Le règlement publié décrit le compteur communal et demande à l’abonné d’aviser immédiatement la Municipalité en cas d’avarie. Cette fiche ne réalise pas cette notification, ne constate aucune conformité juridique et ne prolonge aucun délai. Décrivez uniquement les faits déjà observés, sans conclusion sur la cause, la sécurité, l’urgence, la précision, la responsabilité ou la facturation.',
        'Fuites, interruption ou problème de pression, inquiétudes de santé ou contamination, conduites/vannes privées, autres équipements, contestation de facturation/précision et changements de raccordement/abonnement exclus. Aucune inspection, lecture, mesure, photo, manipulation, ouverture, démontage ou réparation demandée; aucun conseil en ce sens. Aucune coordonnée, référence de compte/client, numéro de série, photo, donnée clinique, champ natif ou consentement collecté. Conditions officielles d’identité, confidentialité, conservation, pays, transmission, anonymat et réception inconnues.',
        'Ces faits restent ici; ce n’est pas un formulaire officiel complet. Aucun courriel préparé, appel, envoi, finalisation externe ou suivi. La liste des élus est non datée; aucun rôle individuel de réception n’est déduit. L’annexe tarifaire2025 est distincte de l’ancienne annexe intégrée; aucune promesse de prix, indemnisation ou portée juridique. Ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par bureau, élu, suppléant, téléphone, entrepreneur ou prestataire.',
      ],
    },
  };
}
