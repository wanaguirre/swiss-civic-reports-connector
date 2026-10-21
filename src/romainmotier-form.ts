import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const romainmotierLightingUrl = 'https://romainmotier.ch/';
export const romainmotierAuthorityUrl = 'https://romainmotier.ch/ma-commune/officiel/';
export const romainmotierPrivacyUrl = 'https://romainmotier.ch/politique-de-confidentialite/';
export const romainmotierLegalUrl = 'https://romainmotier.ch/mentions-legales/';
export const romainmotierCategory = 'Éclairage public communal';
export const romainmotierCategories = Object.freeze([
  Object.freeze({
    service_code: romainmotierCategory,
    service_name: 'Éclairage public communal – fiche locale',
  }),
]);
export const romainmotierScope =
  'Local French facts worksheet for a nonurgent nonworking or intermittent fault of an actual communal public LED streetlight at its exact Romainmôtier-Envy BFS5761 point. The dated 2 September 2026 municipal notice invites LED lighting problems or adjustments by email to cedric.rey@romainmotier-envy.ch or telephone, asking for location, observed problem and reasons for an adjustment. This first local profile only covers nonworking/intermittent faults, not brightness or other adjustments. It does not prepare or send email or place calls. The notice names Cédric Rey; the directory assigns lighting to Michel Chabloz with Cédric Rey as substitute. Do not silently replace the explicit notice recipient or infer a current executive term. Boundary and resident confirmation alone do not prove ownership. Excludes immediate danger, wires/sparks/general outage/active traffic risk, private assets, enforcement/accusations, water/gas/roads/drains/waste. Street name and fault kind are local worksheet requirements, not native validation. Actual street/lamp numbers only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Email reporter contact/photo/privacy/retention/country/acceptance/receipt requirements are unknown. Sending email exposes sender metadata; anonymous acceptance is not guaranteed. General website/privacy, administrative identity and newsletter fields are not email incident requirements. No reporter contacts/photos/native consent/client/state/payload/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty; no office, substitute, website, phone or provider fallback.';
// Independently authored worksheet; factual URL/digests only, no municipal page copies.
export const romainmotierSourcePins = Object.freeze(
  [
    {
      url: 'https://romainmotier.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://romainmotier.ch/',
      sha256: 'f1f547a05d9a57241b922d76e345236143f59165c0b4895cab17274b1e59522e',
      plain: false,
    },
    {
      url: 'https://romainmotier.ch/ma-commune/officiel/',
      sha256: '094620053cc1c7d87962490d8ce85c4db03407ab80555a0f2d1b4796b6ec9627',
      plain: false,
    },
    {
      url: 'https://romainmotier.ch/politique-de-confidentialite/',
      sha256: '3e17ef8f893ef6507b1071e458aeea1f2db8f48c9e3321d4ff0cae15b0e1afbd',
      plain: false,
    },
    {
      url: 'https://romainmotier.ch/mentions-legales/',
      sha256: 'ae2336b2a542a9c35691a07d0a1ad9f9a35d945a939b9f2a323a5edbb29fae5b',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(romainmotierSourcePins);
export const inspectRomainmotierSource = verifier.inspect;
export const assertRomainmotierSourcesAvailable = verifier.assertAvailable;
export async function verifyRomainmotierSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return romainmotierCategories.map((c) => ({ ...c }));
}
export const loadRomainmotierCategories = verifyRomainmotierSources;
export function romainmotierRequirements(): Record<string, Requirements> {
  return {
    [romainmotierCategory]: {
      scope: romainmotierScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Romainmôtier-Envy – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual Romainmotier-Envy communal public LED streetlight',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent fault of actual Romainmotier-Envy communal public LED streetlight confirmed',
          ],
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
        'Fiche locale pour une panne non urgente d’un véritable luminaire public LED communal au point précis à Romainmôtier-Envy. Confirmez la responsabilité communale. Aucun danger, câble tombé, étincelle, panne générale, risque actif pour la circulation, bien privé ou accusation.',
        'L’avis communal du 2 septembre 2026 invite les annonces de problèmes LED par courriel à cedric.rey@romainmotier-envy.ch avec le lieu et le problème constaté. Cette première fiche couvre seulement une panne totale ou intermittente; les demandes de réglage et leurs motifs restent hors de ce profil. Aucun courriel préparé ou envoyé, aucun appel effectué. Cette fiche prépare uniquement les faits; elle ne constitue pas un formulaire officiel complet.',
        'Indiquez la rue et le type de panne observé. Inscrivez les numéros réels de rue et de lampe seulement si vous les connaissez; sinon, laissez-les vides. N’inventez aucun identifiant et ne remplacez pas une information manquante par zéro. Les règles de cette fiche sont locales; les exigences officielles restent inconnues.',
        'Aucun nom, e-mail, téléphone, photo ou consentement collecté. Contact, photos, confidentialité, conservation, pays de traitement, réception et anonymat par courriel restent inconnus. Un courriel expose les métadonnées de l’expéditeur. Les champs administratifs, du site et de la newsletter ne sont pas transposés à cette annonce. Aucune finalisation externe ni suivi. Ne jamais réessayer, recréer ou changer de canal automatiquement après un résultat incertain. Aucun remplacement automatique par le greffe, un autre élu, le site, le téléphone ou un prestataire.',
      ],
    },
  };
}
