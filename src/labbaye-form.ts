import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const labbayeLightingUrl =
  'https://www.labbaye.ch/vie-quotidienne/infrastructure/eclairage-public/';
export const labbayeAdministrationUrl =
  'https://www.labbaye.ch/votre-commune/les-services-de-ladministration/';
export const labbayePresentationUrl = 'https://www.labbaye.ch/votre-commune/presentation/';
export const labbayeHomeUrl = 'https://www.labbaye.ch/';
export const labbayeCategory = 'Éclairage public communal';
export const labbayeScope =
  'Local French facts worksheet for a nonurgent nonworking or intermittent fault of an actual communal public streetlight at its exact L’Abbaye BFS5871 point, in L’Abbaye, Le Pont or Les Bioux. The municipal lighting page explicitly states communal network ownership and asks residents to contact the communal office for lamp failures at 021 564 20 33 or info@labbaye.ch, giving village, street and the real candelabrum number if possible. These are source-requested location facts, not a complete native form or validation contract. This first profile prepares local facts only, never email or calls. Boundary and village choice alone do not prove ownership or the lamp location; separate actual communal-asset, village and nonurgent-fault confirmation is required. No LED technology assumption. Excludes brightness or policy adjustments, planned extinction, private assets, accusations, water/gas/waste/roads/drains, immediate danger, fallen wires, sparks, general outage and active traffic risk. The published executive page is labelled 2021–2026 alongside October2026 election notices; no verified current term or personal recipient inferred. Optional actual lamp numbers remain missing when unknown, never invented or replaced by zero. No reporter contacts/photos/native consent/client/state/payload/mail preparation/calls/email/sending/external completion/tracking. Email exposes sender metadata; identity/photo/privacy/retention/country/guest acceptance/receipt remain unknown, no anonymous or Swiss-only guarantee. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.';
export const labbayeCategories = Object.freeze([
  Object.freeze({
    service_code: labbayeCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
// Factual URL/digest manifest only; no municipal pages, native keys or clients.
export const labbayeSourcePins = Object.freeze(
  [
    {
      url: 'https://www.labbaye.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://www.labbaye.ch/',
      sha256: '6377550943d2176a9549c411d9f848288eb01f39ad4afd60b771b8d5adbdbe5d',
      plain: false,
    },
    {
      url: 'https://www.labbaye.ch/vie-quotidienne/infrastructure/eclairage-public/',
      sha256: '0f88b3b16320df1086127cfabcc715ae1e8da0213462922fc2473ad715594eea',
      plain: false,
    },
    {
      url: 'https://www.labbaye.ch/votre-commune/les-services-de-ladministration/',
      sha256: 'd365217b44783f3a87c4680cbaf5ee220bbf9eed2c36993f922828fbc451ab30',
      plain: false,
    },
    {
      url: 'https://www.labbaye.ch/votre-commune/presentation/',
      sha256: '7325af19c229ad97e5dc7955e8cf707e124503449b148ea74b2fbf7a6d9360b0',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(labbayeSourcePins);
export const inspectLabbayeSource = verifier.inspect;
export const assertLabbayeSourcesAvailable = verifier.assertAvailable;
export async function verifyLabbayeSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return labbayeCategories.map((c) => ({ ...c }));
}
export const loadLabbayeCategories = verifyLabbayeSources;
export function labbayeRequirements(): Record<string, Requirements> {
  return {
    [labbayeCategory]: {
      scope:
        'Local French facts worksheet for a nonurgent nonworking or intermittent fault of an actual communal public streetlight at its exact L’Abbaye BFS5871 point, in L’Abbaye, Le Pont or Les Bioux. The municipal lighting page explicitly states communal network ownership and asks residents to contact the communal office for lamp failures at 021 564 20 33 or info@labbaye.ch, giving village, street and the real candelabrum number if possible. These are source-requested location facts, not a complete native form or validation contract. This first profile prepares local facts only, never email or calls. Boundary and village choice alone do not prove ownership or the lamp location; separate actual communal-asset, village and nonurgent-fault confirmation is required. No LED technology assumption. Excludes brightness or policy adjustments, planned extinction, private assets, accusations, water/gas/waste/roads/drains, immediate danger, fallen wires, sparks, general outage and active traffic risk. The published executive page is labelled 2021–2026 alongside October2026 election notices; no verified current term or personal recipient inferred. Optional actual lamp numbers remain missing when unknown, never invented or replaced by zero. No reporter contacts/photos/native consent/client/state/payload/mail preparation/calls/email/sending/external completion/tracking. Email exposes sender metadata; identity/photo/privacy/retention/country/guest acceptance/receipt remain unknown, no anonymous or Swiss-only guarantee. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback. This is not a complete official form.',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de L’Abbaye – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm actual communal streetlight, real village, exact point and nonurgent fault',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent fault of actual L Abbaye communal public streetlight at confirmed village and exact point',
          ],
        },
        {
          code: 'village',
          description: 'Source-requested actual village, confirmed at the exact point',
          required: true,
          datatype: 'string',
          values: ['L’Abbaye', 'Le Pont', 'Les Bioux'],
        },
        {
          code: 'street_name',
          description: 'Source-requested actual street name',
          required: true,
          datatype: 'string',
          max_length: 150,
          translate: false,
        },
        {
          code: 'known_lamp_number',
          description:
            'Source requests actual candelabrum number if possible; leave empty when unknown',
          required: false,
          datatype: 'string',
          max_length: 50,
          translate: false,
        },
        {
          code: 'fault_kind',
          description: 'Local worksheet: observed nonurgent lighting fault',
          required: true,
          datatype: 'string',
          values: ['Ne fonctionne pas', 'Fonctionne par intermittence'],
        },
      ],
      notes: [
        'Fiche locale pour une panne non urgente d’un véritable luminaire public communal au point précis à L’Abbaye. Seuls les villages de L’Abbaye, du Pont et des Bioux sont couverts. Confirmez le village réel, la responsabilité communale et la panne non urgente. La limite communale et le choix du village ne prouvent pas la propriété ni la position du luminaire. Aucune technologie LED supposée.',
        'La page communale indique que le réseau appartient à la commune et demande, en cas de panne, de contacter directement le bureau communal au 021 564 20 33 ou à info@labbaye.ch. Elle demande le village, la rue et, si possible, le numéro du candélabre. Cette fiche prépare uniquement les faits; aucun courriel préparé ou envoyé et aucun appel. Ce n’est pas un formulaire officiel complet.',
        'Indiquez le village et la rue réels ainsi que la panne observée. Inscrivez le numéro réel du candélabre seulement si vous le connaissez; sinon, laissez vide, sans inventer ni mettre zéro. Les choix de panne et les limites de longueur sont des règles locales, pas une validation du formulaire officiel. Les demandes de réglage, extinctions planifiées, biens privés, accusations et autres services sont exclus. Aucun danger, câble tombé, étincelle, panne générale ou risque actif pour la circulation.',
        'Aucune coordonnée, photo ou consentement collecté. Identité, photos, confidentialité, conservation, pays, anonymat et réception par courriel restent inconnus. Un courriel expose les métadonnées de l’expéditeur. Le tableau politique publié est daté 2021–2026; aucun mandat actuel ni destinataire personnel n’est déduit. Aucune finalisation externe ni suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par un bureau, élu, suppléant, téléphone ou prestataire.',
      ],
    },
  };
}
