import type { Requirements } from './model.js';
import { createPinnedNoteVerifier } from './pinned-note-sources.js';
export const saintSulpiceRobotsUrl = 'https://www.st-sulpice.ch/robots.txt';
export const saintSulpiceLightingUrl =
  'https://www.st-sulpice.ch/prestations-a-la-population/eclairage-public';
export const saintSulpiceVoirieUrl =
  'https://www.st-sulpice.ch/officiel/services-communaux/service-de-voirie';
export const saintSulpiceWorksUrl =
  'https://www.st-sulpice.ch/officiel/services-communaux/service-des-travaux';
export const saintSulpiceMunicipalityUrl =
  'https://www.st-sulpice.ch/officiel/municipalite-1/composition-legislature-2021-2026';
export const saintSulpiceCategory = 'Éclairage public communal';
export const saintSulpiceCategories = Object.freeze([
  Object.freeze({
    service_code: saintSulpiceCategory,
    service_name: 'Éclairage public communal – note téléphonique',
  }),
]);
export const saintSulpiceScope =
  'Local text-only telephone-note preparation for a nonurgent malfunction of an actual communal public streetlight at its precise point in Saint-Sulpice VD (BFS5648). The municipality explicitly invites lighting fault reports through its published telephone route0216943350 or literal greffe(at)st-sulpice.ch; this note prepares an initial optional call only. Current2026–2031 authority and communal lighting maintenance are documented despite the legacy2021–2026 authority URL. Confirm actual communal responsibility; boundary and resident confirmation alone do not prove ownership. Excludes urgent danger, fallen wires, sparks, network or domestic outages, private lamps, connections, billing, roads, water, drainage, gas and pollution. Phone reporter requirements, anonymous acceptance and incident privacy/retention/country/receipt are unknown. No reporter contacts/photos, invented municipal fields/consent, native client/state/payload, sending, external completion or tracking. The protected generic contact form is never requested.';
// Only factual URLs/digests; no municipal snapshots, form state or client copies.
export const saintSulpiceSourcePins = Object.freeze(
  [
    {
      url: 'https://www.st-sulpice.ch/robots.txt',
      sha256: '3a125e84a637dc3f5442bb6949fa200056f37db4627b4c2a3addc55bbb89b703',
      plain: true,
    },
    {
      url: 'https://www.st-sulpice.ch/officiel/services-communaux/service-des-travaux',
      sha256: '3c39ba7171d89ad4150fc9288bc70542c2f5a78db51cb3fd57e46f769ea61ce4',
      plain: false,
    },
    {
      url: 'https://www.st-sulpice.ch/officiel/services-communaux/service-de-voirie',
      sha256: '00b621b5cbf6a9e9777859b7980040b36e53da2c867ac7f35712e0afc48b528e',
      plain: false,
    },
    {
      url: 'https://www.st-sulpice.ch/officiel/municipalite-1/composition-legislature-2021-2026',
      sha256: 'ecd14cdb74ee8386d4f271351a77534d52068fa4fa046e1695d6197add69219d',
      plain: false,
    },
    {
      url: 'https://www.st-sulpice.ch/prestations-a-la-population/eclairage-public',
      sha256: '79d60ca016ab22e52ecf34ccef0a8b18a14228fbb9e404e54a3f880f9db8a281',
      plain: false,
    },
  ].map((p) => Object.freeze(p)),
);
const sourceVerifier = createPinnedNoteVerifier(saintSulpiceSourcePins);
export const inspectSaintSulpiceSource = sourceVerifier.inspect;
export const assertSaintSulpiceSourcesAvailable = sourceVerifier.assertAvailable;
export async function verifySaintSulpiceSources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  await sourceVerifier.verify(request, retry, now, sleep);
  return saintSulpiceCategories.map((c) => ({ ...c }));
}
export const loadSaintSulpiceCategories = verifySaintSulpiceSources;
export function saintSulpiceRequirements(): Record<string, Requirements> {
  return {
    [saintSulpiceCategory]: {
      scope: saintSulpiceScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Saint-Sulpice – éclairage public'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual communal streetlight in Saint-Sulpice',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Saint-Sulpice communal streetlight confirmed'],
        },
      ],
      notes: [
        'Note téléphonique locale pour une panne non urgente d’un véritable luminaire public communal au point précis à Saint-Sulpice VD. Confirmez la responsabilité communale. Aucun danger immédiat, câble tombé, étincelle, panne de réseau ou domestique, lampe privée, raccordement, facture, défaut de voirie, eau, assainissement, gaz ou pollution.',
        'La commune invite à signaler les défauts d’éclairage public par un simple appel au 021 694 33 50 ou à l’adresse publiée littéralement greffe(at)st-sulpice.ch. Cette note prépare seulement un premier appel facultatif; aucun appel ni courriel envoyé. Les exigences de coordonnées au téléphone et l’acceptation anonyme sont inconnues. Aucun nom, e-mail, téléphone ou photo collecté; aucune exigence du formulaire général reprise.',
        'La confidentialité, le pays de traitement, la conservation et la réception propres au signalement téléphonique restent inconnus. Le formulaire général protégé, ses champs antispam, ses clients et son état ne sont jamais demandés ou exécutés par cet adaptateur. Aucun envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
