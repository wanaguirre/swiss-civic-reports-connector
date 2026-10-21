import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const founexLightingUrl = 'https://www.founex.ch/N730/faq.html';
export const founexAuthorityUrl = 'https://www.founex.ch/municipalite';
export const founexServicesUrl = 'https://www.founex.ch/services-communaux';
export const founexCategory = 'Éclairage public communal';
export const founexCategories = Object.freeze([
  Object.freeze({
    service_code: founexCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
export const founexScope =
  'Local French facts worksheet for a nonurgent fault of an actual communal public streetlight at its exact Founex BFS5717 point. The municipal FAQ explicitly invites lighting faults by email to travaux@founex.ch with the faulty-light location; no automated email transport is implemented; emergency telephone is not an ordinary fallback. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, wires/sparks/general outage/active traffic risk, private assets, enforcement/accusations, water/gas/roads/drains/waste. Only nonworking/intermittent faults in this local worksheet. Street name and fault kind are local worksheet requirements, not native validation. Actual street/lamp numbers only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Email reporter contact/photo/privacy/retention/country/acceptance/receipt requirements are unknown. Sending email exposes sender metadata; anonymous acceptance is not guaranteed. Protected maintenance web-form identity rules are not inherited into email. Protected maintenance form/client/challenge/state excluded from all reads and preparation. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty.';
// Independently authored worksheet; factual URL/digests only, no municipal page copies.
export const founexSourcePins = Object.freeze(
  [
    {
      url: 'https://www.founex.ch/robots.txt',
      sha256: '9eb72713b0369a06f56d3fec2f80a036bd48e5d08c1748d459b79c35418636bd',
      plain: true,
    },
    {
      url: 'https://www.founex.ch/N730/faq.html',
      sha256: '96a4b6e1ea2881020902be50d3547bec07347ce58bb0b26610c5850f4704fe7c',
      plain: false,
    },
    {
      url: 'https://www.founex.ch/municipalite',
      sha256: 'ca5e36f1fd56587e8dfeb72c7310ecadf4578a72f965c03eced245fa0df987d6',
      plain: false,
    },
    {
      url: 'https://www.founex.ch/services-communaux',
      sha256: '7b23480dc73ecabd57565d5e86f3e1ff8bb3691065eb05eecc86f6d388c6f0e5',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(founexSourcePins);
export const inspectFounexSource = verifier.inspect;
export const assertFounexSourcesAvailable = verifier.assertAvailable;
export async function verifyFounexSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return founexCategories.map((c) => ({ ...c }));
}
export const loadFounexCategories = verifyFounexSources;
export function founexRequirements(): Record<string, Requirements> {
  return {
    [founexCategory]: {
      scope: founexScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Founex – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: 'Confirm a nonurgent fault of an actual Founex communal public streetlight',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Founex communal public streetlight confirmed'],
        },
        {
          code: 'street_name',
          description: 'Local worksheet: actual street name',
          required: true,
          datatype: 'string',
          max_length: 150,
          translate: false,
        },
        {
          code: 'known_street_number',
          description:
            'Local worksheet: actual street number, only if known; otherwise leave empty',
          required: false,
          datatype: 'string',
          max_length: 30,
          translate: false,
        },
        {
          code: 'known_lamp_number',
          description: 'Local worksheet: actual lamp number, only if known; otherwise leave empty',
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
        'Fiche locale pour une panne non urgente d’un véritable luminaire public communal au point précis à Founex. Confirmez la responsabilité communale. Aucun danger, câble tombé, étincelle, panne générale, risque actif pour la circulation, bien privé ou accusation.',
        'La FAQ communale invite les annonces de panne d’éclairage par courriel à travaux@founex.ch en précisant le lieu du luminaire. Cette fiche ne prépare ni n’envoie de courriel. Seulement une panne totale ou intermittente. Cette fiche prépare uniquement les faits; elle ne constitue pas un formulaire officiel complet. Le téléphone d’urgence ne sert pas de solution de remplacement pour les pannes ordinaires. Aucun envoi, appel ou courriel effectué.',
        'Indiquez la rue et le type de panne observé. Inscrivez les numéros réels de rue et de lampe seulement si vous les connaissez; sinon, laissez-les vides. N’inventez aucun identifiant et ne remplacez pas une information manquante par zéro. Les règles de cette fiche sont locales; les exigences du formulaire officiel restent inconnues.',
        'Aucun nom, e-mail, téléphone, photo ou consentement collecté. Les exigences de contact et de photo par courriel, la confidentialité, la conservation, le pays de traitement et la réception restent inconnus. Un courriel expose les métadonnées de l’expéditeur; l’acceptation anonyme n’est pas garantie. Les coordonnées exigées par le formulaire web protégé ne sont pas transposées au courriel; le formulaire, le client, le défi et l’état natifs sont exclus. Aucune finalisation externe ni suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain.',
      ],
    },
  };
}
