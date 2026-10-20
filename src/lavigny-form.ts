import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';

export const lavignyRobotsUrl = 'https://lavigny.ch/robots.txt';
export const lavignyWasteUrl = 'https://lavigny.ch/voirie-et-dechets/';
export const lavignyMunicipalityUrl = 'https://lavigny.ch/municipalite/';
export const lavignyPrivacyUrl = 'https://lavigny.ch/politique-de-confidentialite/';
export const lavignyCategory = 'Moloks communaux';
export const lavignyCategories = Object.freeze([
  Object.freeze({
    service_code: lavignyCategory,
    service_name: 'Moloks communaux – note téléphonique',
  }),
]);
export const lavignyScope =
  'Local text-only telephone-note preparation for a nonurgent malfunction of an actual communal Molok waste container at its precise location in Lavigny VD (BFS5637). The official waste page explicitly asks residents to report Molok breakdowns to the administration or the councillor responsible for waste. Confirm the actual affected communal container and municipal responsibility; boundary and resident confirmation alone do not establish ownership. Excludes emergencies or immediate danger, fires, hazardous waste, waste left outside a container, litter/illegal dumping, private bins, access-card or fee disputes, waste identification and general roads/water/gas/electricity faults. Telephone reporter requirements and anonymous acceptance are unknown. No reporter contacts or photos collected, native form/client/payload, sending, external completion or tracking.';
const changed = () =>
  new Error('The Lavigny Molok sources have changed or are unavailable. Preparation is paused.');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const lavignySourcePins = Object.freeze([
  Object.freeze({
    url: lavignyRobotsUrl,
    sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
    plain: true,
  }),
  Object.freeze({
    url: lavignyWasteUrl,
    sha256: 'c7db7e17e7db117c463cb824b65eeeaf13281844de3d36b0cf6bbead0a456e18',
    plain: false,
  }),
  Object.freeze({
    url: lavignyMunicipalityUrl,
    sha256: 'c64d590bae436742fb95bc31db132c413d0af8a93e127e53de107c5d1bdb8277',
    plain: false,
  }),
  Object.freeze({
    url: lavignyPrivacyUrl,
    sha256: '21b1f83420862ad8dc5f0c41061f016876218f372a7213c62e85f932cbdad690',
    plain: false,
  }),
]);
/** Complete public policy/Molok-referral/authority/privacy bytes are significant.
 * Newsletter antispam state is retained but never executed. No
 * incident form, hidden state or municipal contact requirements are invented. */
export function inspectLavignySource(url: string, body: string): void {
  const pin = lavignySourcePins.find((p) => p.url === url);
  if (!pin || Buffer.byteLength(body) > 1_000_000 || hash(body) !== pin.sha256) throw changed();
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertLavignySourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyLavignySources(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let context = contexts.get(request);
  if (!context) {
    context = { tail: Promise.resolve(), next: 0, stopped: false };
    contexts.set(request, context);
  }
  const shared = context;
  try {
    for (const pin of lavignySourcePins) {
      const task = shared.tail.then(async () => {
        assertLavignySourcesAvailable(request);
        const delay = Math.max(0, shared.next - now());
        if (delay) await sleep(delay);
        assertLavignySourcesAvailable(request);
        shared.next = now() + 10_000;
        try {
          const response = await request(pin.url, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
            headers: {
              Accept: pin.plain ? 'text/plain' : 'text/html',
              'User-Agent': 'Civic source verification (read-only; no client execution)',
            },
          });
          if (
            !response.ok ||
            response.redirected ||
            (response.url && response.url !== pin.url) ||
            !(pin.plain ? /^text\/plain(?:;|$)/i : /^text\/html(?:;|$)/i).test(
              response.headers.get('content-type') ?? '',
            ) ||
            !response.body
          ) {
            const header = response.headers.get('retry-after') ?? '';
            const wait = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - now();
            if (Number.isFinite(wait) && wait > 0) retry(wait);
            await response.body?.cancel();
            throw changed();
          }
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.byteLength;
              if (size > 1_000_000) throw changed();
              chunks.push(part.value);
            }
          } finally {
            await reader.cancel().catch(() => {});
          }
          const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            Buffer.concat(chunks),
          );
          inspectLavignySource(pin.url, html);
        } catch {
          shared.stopped = true;
          throw changed();
        }
      });
      shared.tail = task.then(
        () => undefined,
        () => undefined,
      );
      await task;
    }
    return lavignyCategories.map((c) => ({ ...c }));
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export const loadLavignyCategories = verifyLavignySources;
export function lavignyRequirements(): Record<string, Requirements> {
  return {
    [lavignyCategory]: {
      scope: lavignyScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Lavigny – Administration / déchets'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description: 'Confirm a nonurgent malfunction of an actual communal Molok in Lavigny',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual Lavigny communal Molok confirmed'],
        },
      ],
      notes: [
        'Note téléphonique locale pour une panne non urgente d’un véritable Molok communal au point précis à Lavigny. Confirmez le conteneur et la responsabilité communale. Aucune urgence, danger immédiat, incendie, déchet dangereux, dépôt hors du conteneur, littering, décharge sauvage, poubelle privée, litige de carte/taxe ou autre défaut de voirie/réseau.',
        'La page officielle demande de signaler une panne à l’administration communale ou à la Municipale des déchets, Cathy Zanola Rossier. Administration:0218086962; Cathy:0794091634. Les coordonnées exigées au téléphone et l’acceptation anonyme sont inconnues. Aucun nom, e-mail, téléphone ou photo collecté. Une carte d’accès pour jeter les déchets n’est pas une exigence de connexion pour cette note.',
        'La politique du13octobre2023 prévoit le traitement des demandes, des prestataires suisses et des exceptions de partage légal/transfert international; elle contient des URL/adresses mal formées. Conservation, pays de traitement et réception propres au signalement non vérifiés. Aucun formulaire, client, envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
