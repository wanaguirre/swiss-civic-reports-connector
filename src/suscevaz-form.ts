import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const suscevazHomeUrl = 'https://www.suscevaz.ch/';
export const suscevazAuthorityUrl = 'https://www.suscevaz.ch/la-municipalite-fr318.html';
export const suscevazAdministrationUrl = 'https://www.suscevaz.ch/greffe-fr71.html';
export const suscevazNoticeUrl =
  'https://www.suscevaz.ch/files/1776701620-affiche-pilier-frelon-asiatique-3038.pdf';
export const suscevazCategory = 'Observation présumée de frelon asiatique';
export const suscevazScope =
  'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet individual or nest observation at its exact current Suscévaz VD BFS5930 point. The actual municipal PDF asks for announcements to the platform AND commune. These local facts fulfill neither announcement, do not replace either and never automate duplication or channel change. The known platform restriction remains binding. Suspicion and uncertainty only: no identification guarantee, diagnosis, safety, urgency, legal or removal conclusion, or approach, capture, trapping, bait or removal advice. Excludes immediate or personal danger, medical/sting concerns, removal requests, bees/other species and other services. Exact point alone proves neither observation nor identity or safety. One local factual/nonurgent confirmation is not verified official requiredness. Internal species_observation imports no Aarau/native case kind or fields. No reporter contacts/photos/clinical/native fields/consent, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest/receipt remain unqualified. General office correspondence is not a verified hornet transport. The announced2027 merger retires this profile at2026-12-31T23:00:00Z, before cached preparation. No merged identity or future election result inferred. Never automatically retry,recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.';
export const suscevazCategories = Object.freeze([
  Object.freeze({
    service_code: suscevazCategory,
    service_name: 'Observation présumée de frelon asiatique – faits locaux',
  }),
]);
export const suscevazSourcePins = Object.freeze(
  [
    {
      url: 'https://www.suscevaz.ch/robots.txt',
      sha256: 'baa6fe461552982f9e1f9550b1feba27837a7fc4db883dabaf3d4102318a2cda',
      plain: true,
    },
    {
      url: 'https://www.suscevaz.ch/',
      sha256: '7344253694e5ff8bdace6b82dafa5bb3fb34d74a312a73c6831625728b3cb0f2',
      plain: false,
    },
    {
      url: 'https://www.suscevaz.ch/la-municipalite-fr318.html',
      sha256: '2e5ea0ac9168fd79c325ffbdbc57ffe50fec47e74febfb58deafdca85d53709b',
      plain: false,
    },
    {
      url: 'https://www.suscevaz.ch/greffe-fr71.html',
      sha256: 'eb3fc4006386eb7c02c249977ee919845c4e74ba23045d6a1b01cb23cfa3e56b',
      plain: false,
    },
    {
      url: 'https://www.suscevaz.ch/files/1776701620-affiche-pilier-frelon-asiatique-3038.pdf',
      sha256: '2b8c3d73ea8aa416905891c880cc1ff8a7003d130dcf6fb8d7df6d4423f2f476',
      plain: false,
      pdf: true as const,
    },
  ].map((p) => Object.freeze(p)),
);
export const suscevazRetiresAt = Date.parse('2026-12-31T23:00:00Z');
const verifier = createPinnedNoteVerifier(suscevazSourcePins);
const retired = new WeakSet<typeof fetch>();
function assertWindow(request: typeof fetch, now: () => number) {
  const time = now();
  if (retired.has(request) || !Number.isFinite(time) || time >= suscevazRetiresAt) {
    retired.add(request);
    throw new Error(
      'Suscévaz preparation is retired at the announced merger. Preparation is paused.',
    );
  }
}
export const inspectSuscevazSource = verifier.inspect;
export function assertSuscevazSourcesAvailable(
  request: typeof fetch,
  now: () => number = Date.now,
) {
  assertWindow(request, now);
  verifier.assertAvailable(request);
}
export async function verifySuscevazSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  assertSuscevazSourcesAvailable(request, now);
  const clock = () => {
    assertWindow(request, now);
    return now();
  };
  await verifier.verify(request, retry, clock, sleep);
  assertSuscevazSourcesAvailable(request, now);
  return suscevazCategories.map((c) => ({ ...c }));
}
export const loadSuscevazCategories = verifySuscevazSources;
export function suscevazRequirements(): Record<string, Requirements> {
  return {
    [suscevazCategory]: {
      scope:
        'Local French facts worksheet for an existing independently nonurgent suspected Asian-hornet individual or nest observation at its exact current Suscévaz VD BFS5930 point. The actual municipal PDF asks for announcements to the platform AND commune. These local facts fulfill neither announcement, do not replace either and never automate duplication or channel change. The known platform restriction remains binding. Suspicion and uncertainty only: no identification guarantee, diagnosis, safety, urgency, legal or removal conclusion, or approach, capture, trapping, bait or removal advice. Excludes immediate or personal danger, medical/sting concerns, removal requests, bees/other species and other services. Exact point alone proves neither observation nor identity or safety. One local factual/nonurgent confirmation is not verified official requiredness. Internal species_observation imports no Aarau/native case kind or fields. No reporter contacts/photos/clinical/native fields/consent, mail/call preparation, sending, external completion or tracking. Official identity/photo/privacy/retention/country/forwarding/guest/receipt remain unqualified. General office correspondence is not a verified hornet transport. The announced2027 merger retires this profile at2026-12-31T23:00:00Z, before cached preparation. No merged identity or future election result inferred. Never automatically retry,recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.',
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
      bodies: ['Commune de Suscévaz – observation présumée de frelon asiatique, faits locaux'],
      extra_fields: [
        {
          code: 'hornet_observation_confirmed',
          description:
            'Confirm an existing nonurgent suspected Asian-hornet observation at the exact Suscevaz point; local facts fulfill neither announcement',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent factual suspected Asian-hornet observation at exact Suscevaz point confirmed; local facts fulfill neither platform nor commune announcement',
          ],
        },
      ],
      notes: [
        'Faits locaux pour une observation présumée de frelon asiatique, individu ou nid, déjà effectuée et indépendamment non urgente au point précis confirmé dans Suscévaz. Décrivez les faits et vos incertitudes. La confirmation est une règle locale, pas une exigence officielle vérifiée.',
        'L’avis communal demande une annonce sur la plateforme ET à la commune. Cette fiche ne réalise aucune des deux annonces et ne remplace aucun canal. Aucun contrat ni champ natif Aarau importé. La restriction connue de la plateforme reste applicable; aucun contournement ni duplication automatique.',
        'Aucune identification garantie, conclusion de sécurité, d’urgence, juridique ou d’enlèvement; aucun conseil d’approche, capture, piégeage, appâtage ou enlèvement. Danger immédiat/personnel, inquiétudes médicales ou piqûres, demandes d’enlèvement, abeilles/autres espèces et autres services exclus. Aucune coordonnée, photo, donnée clinique, champ natif ou consentement collecté. Identité, confidentialité, conservation, pays, transmission, anonymat et réception officiels restent inconnus.',
        'Ces faits restent ici. Aucun courriel préparé, appel, envoi, finalisation externe ou suivi. L’adresse générale du bureau ne qualifie pas un envoi de frelon. La fusion annoncée au1janvier2027 arrête cette préparation dès2026-12-31T23:00:00Z, y compris les résultats en cache. Ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par bureau, élu, suppléant, téléphone ou prestataire.',
      ],
    },
  };
}
