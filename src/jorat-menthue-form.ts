import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const joratMenthueWasteUrl = 'https://www.jorat-menthue.ch/dechets.php';
export const joratMenthueAuthorityUrl = 'https://www.jorat-menthue.ch/municipalite.php';
export const joratMenthueAdministrationUrl = 'https://www.jorat-menthue.ch/administration.php';
export const joratMenthueHomeUrl = 'https://www.jorat-menthue.ch/';
export const joratMenthueCategory = 'Molok communal inaccessible';
export const joratMenthueScope =
  'Local French facts worksheet for a nonurgent mechanical access failure of an actual communal underground Molok at the exact Jorat-Menthue BFS5804 point, only at the source-listed Montaubion-Chardonney former dairy opposite the college or Sottens village square towards Moudon. The waste page explicitly asks citizens to notify the administration or responsible municipal official when access to an underground container is temporarily impossible. This first profile uses the published administration greffe@jorat-menthue.ch as context, without preparing or sending email or calls. Requires a resident with legitimately issued access card and separate actual communal-asset/site/nonurgent confirmation; municipality boundary and a selected site alone do not prove ownership or location. Excludes Peney-le-Jorat, Villars-Mendraz and Villars-Tiercelin compactors; lost/invalid cards, credentials, billing, weighing, general waste complaints, private assets, accusations and immediate danger, trapped people/animals, fire, sharp waste or active obstruction. Do not operate, force or repair the container or leave waste beside it. Never collect card numbers, credentials, reporter contacts, photos or native consent. Site/fault choices are local worksheet rules, not native validation. Actual container identifiers and observation time only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Email sender metadata, identity/photo/privacy/retention/country/guest acceptance/receipt remain unknown. Physical disposal cards and Ecowaste accounts are not report login. No native client/state/payload/mail preparation/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback.';
export const joratMenthueCategories = Object.freeze([
  Object.freeze({
    service_code: joratMenthueCategory,
    service_name: 'Molok communal inaccessible – fiche locale',
  }),
]);
// Independent factual manifest, never municipal HTML, native keys or clients.
export const joratMenthueSourcePins = Object.freeze(
  [
    {
      url: 'https://www.jorat-menthue.ch/robots.txt',
      sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
      plain: true,
    },
    {
      url: 'https://www.jorat-menthue.ch/',
      sha256: '14703b5f78339e4fdbbd045ed94cb88e42f4b396c942e2673ac2ec04cb6ccd24',
      plain: false,
    },
    {
      url: 'https://www.jorat-menthue.ch/dechets.php',
      sha256: '2631c618b459c836725d2907e9c51c1d0f20bfcb6ddbde51745b75fba666dd95',
      plain: false,
    },
    {
      url: 'https://www.jorat-menthue.ch/administration.php',
      sha256: 'a03bbee714f102c8689220be02ad47ee1d47ef8169005763c7212dee7501f4dd',
      plain: false,
    },
    {
      url: 'https://www.jorat-menthue.ch/municipalite.php',
      sha256: '892cdc124ede36409a3e2386659ffae901373179c20780e29add2f3360600837',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const verifier = createPinnedNoteVerifier(joratMenthueSourcePins);
export const inspectJoratMenthueSource = verifier.inspect;
export const assertJoratMenthueSourcesAvailable = verifier.assertAvailable;
export async function verifyJoratMenthueSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await verifier.verify(request, retry, now, sleep);
  return joratMenthueCategories.map((c) => ({ ...c }));
}
export const loadJoratMenthueCategories = verifyJoratMenthueSources;
export function joratMenthueRequirements(): Record<string, Requirements> {
  return {
    [joratMenthueCategory]: {
      scope:
        'Local French facts worksheet for a nonurgent mechanical access failure of an actual communal underground Molok at the exact Jorat-Menthue BFS5804 point, only at the source-listed Montaubion-Chardonney former dairy opposite the college or Sottens village square towards Moudon. The waste page explicitly asks citizens to notify the administration or responsible municipal official when access to an underground container is temporarily impossible. This first profile uses the published administration greffe@jorat-menthue.ch as context, without preparing or sending email or calls. Requires a resident with legitimately issued access card and separate actual communal-asset/site/nonurgent confirmation; municipality boundary and a selected site alone do not prove ownership or location. Excludes Peney-le-Jorat, Villars-Mendraz and Villars-Tiercelin compactors; lost/invalid cards, credentials, billing, weighing, general waste complaints, private assets, accusations and immediate danger, trapped people/animals, fire, sharp waste or active obstruction. Do not operate, force or repair the container or leave waste beside it. Never collect card numbers, credentials, reporter contacts, photos or native consent. Site/fault choices are local worksheet rules, not native validation. Actual container identifiers and observation time only if known; unknown identifiers remain missing, never invented or replaced by zero. This is not a complete official form. Email sender metadata, identity/photo/privacy/retention/country/guest acceptance/receipt remain unknown. Physical disposal cards and Ecowaste accounts are not report login. No native client/state/payload/mail preparation/calls/email/sending/external completion/tracking. Never automatically retry, recreate or change channel after uncertainty; no office, member, substitute, phone or provider fallback.',
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Jorat-Menthue – administration'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm resident with legitimately issued access card, actual source-listed communal underground Molok and nonurgent mechanical failure',
          required: true,
          datatype: 'string',
          values: [
            'Resident with legitimately issued card confirms actual source-listed communal underground Molok and nonurgent mechanical access failure',
          ],
        },
        {
          code: 'molok_site',
          description:
            'Local worksheet: confirm the actual source-listed Molok site at this exact point',
          required: true,
          datatype: 'string',
          values: [
            'Montaubion-Chardonney – ancienne laiterie en face du collège',
            'Sottens – place du Village, direction Moudon',
          ],
        },
        {
          code: 'fault_kind',
          description: 'Local worksheet: observed nonurgent mechanical access failure',
          required: true,
          datatype: 'string',
          values: ['Couvercle ne s’ouvre pas', 'Ouverture mécaniquement bloquée'],
        },
        {
          code: 'known_container_number',
          description:
            'Actual container number only if known, never a personal card number; otherwise leave empty',
          required: false,
          datatype: 'string',
          max_length: 50,
          translate: false,
        },
        {
          code: 'known_observation_time',
          description: 'Actual observation time only if known; otherwise leave empty',
          required: false,
          datatype: 'string',
          max_length: 100,
          translate: false,
        },
      ],
      notes: [
        'Fiche locale pour un accès mécanique impossible, sans urgence, à un véritable Molok enterré communal au point précis à Jorat-Menthue. Seuls les sites de Montaubion-Chardonney (ancienne laiterie en face du collège) et Sottens (place du Village, direction Moudon) sont couverts. Confirmez être résident avec une carte d’accès légitimement délivrée et confirmer le site communal réel. La limite communale et le choix du site ne prouvent pas sa propriété ni sa position.',
        'La page communale des déchets demande d’informer l’administration ou le municipal responsable si l’accès au conteneur enterré est momentanément impossible. Cette fiche prépare seulement les faits; le greffe publié est greffe@jorat-menthue.ch. Aucun courriel préparé ou envoyé, aucun appel. Ce n’est pas un formulaire officiel complet.',
        'Les bennes compactantes des autres villages, les cartes perdues ou invalides, la facturation, la pesée et les autres plaintes restent hors de ce profil. Aucun danger, personne ou animal coincé, feu, déchet tranchant, obstruction active, bien privé ou accusation. Ne manipulez, forcez ou réparez pas le conteneur et ne déposez pas de déchets à côté.',
        'Aucune coordonnée, photo, numéro de carte, identifiant de compte ou consentement collecté. Indiquez un numéro réel de conteneur et l’heure seulement si connus; sinon, laissez vide, sans inventer ni mettre zéro. Les règles sont locales; les exigences officielles, la confidentialité, la conservation, le pays, l’anonymat et la réception par courriel restent inconnus. Le courriel expose les métadonnées de l’expéditeur. Aucun client, envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement; aucun remplacement par le greffe, un élu, un suppléant, le téléphone ou un prestataire.',
      ],
    },
  };
}
