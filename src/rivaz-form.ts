import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';

export const rivazRobotsUrl = 'https://www.rivaz.ch/robots.txt';
export const rivazWaterUrl = 'https://www.rivaz.ch/qualite-de-l-eau-fr2925.html';
export const rivazMunicipalityUrl = 'https://www.rivaz.ch/municipalite-2026-2031-fr17.html';
export const rivazPrivacyUrl = 'https://www.rivaz.ch/mentions-legales-fr3160.html';
export const rivazCategory = 'Eau communale';
export const rivazCategories = Object.freeze([
  Object.freeze({
    service_code: rivazCategory,
    service_name: 'Eau communale – note téléphonique',
  }),
]);
export const rivazScope =
  'Local text-only telephone-note preparation for a nonurgent maintenance fault of a confirmed communal drinking-water asset at its actual point in Rivaz VD (BFS5609). The municipal water page explicitly provides a telephone contact for water problems or emergencies. This local preparation excludes emergencies, contamination or health concerns, supply interruption, active leaks or flooding, immediate danger, private plumbing, new connections and hydrant-use requests. Use urgent official help directly for urgent situations; this note is not an emergency channel. Source and reservoir locations in Puidoux/Chexbres and supplemental Lausanne water do not widen geographic or ownership scope. Exact boundary and resident confirmation do not independently establish ownership. Telephone reporter requirements and anonymous acceptance are unknown; no reporter contacts or photos collected. No payload, sending, external completion or tracking.';
const changed = () =>
  new Error('The Rivaz water sources have changed or are unavailable. Preparation is paused.');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const rivazSourcePins = Object.freeze([
  Object.freeze({
    url: rivazRobotsUrl,
    sha256: '3a5f918f473e3df0f657120d8ee936b3fba5d22889b47464d54c1da6aaceeb4a',
    plain: true,
  }),
  Object.freeze({
    url: rivazWaterUrl,
    sha256: '9bfc34df4bab15c41168c840e0ed547fb19665b08eb299e757bb06edc9d9add9',
    plain: false,
  }),
  Object.freeze({
    url: rivazMunicipalityUrl,
    sha256: '9a553e46fff7a6be2987b8c88190b8187dba92f63934948b8609ab108642355c',
    plain: false,
  }),
  Object.freeze({
    url: rivazPrivacyUrl,
    sha256: 'de919e4bb49a93676a376c5f3a22707b7ed0f0bb93eee0088bddcc880e7edffd',
    plain: false,
  }),
]);
/** Complete public policy/water-referral/authority/privacy bytes are significant.
 * Protected generic contact is not requested. No
 * incident form, hidden state or municipal contact requirements are invented. */
export function inspectRivazSource(url: string, body: string): void {
  const pin = rivazSourcePins.find((p) => p.url === url);
  if (!pin || Buffer.byteLength(body) > 1_000_000 || hash(body) !== pin.sha256) throw changed();
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertRivazSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyRivazSources(
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
    for (const pin of rivazSourcePins) {
      const task = shared.tail.then(async () => {
        assertRivazSourcesAvailable(request);
        const delay = Math.max(0, shared.next - now());
        if (delay) await sleep(delay);
        assertRivazSourcesAvailable(request);
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
          inspectRivazSource(pin.url, html);
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
    return rivazCategories.map((c) => ({ ...c }));
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export const loadRivazCategories = verifyRivazSources;
export function rivazRequirements(): Record<string, Requirements> {
  return {
    [rivazCategory]: {
      scope: rivazScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Rivaz – Municipal en charge des eaux'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual public asset maintained by communal drinking-water service in Rivaz',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent maintenance fault of actual Rivaz communal drinking-water asset confirmed',
          ],
        },
      ],
      notes: [
        'Note téléphonique locale pour un défaut d’entretien non urgent d’un équipement communal réel d’eau potable, au point précis à Rivaz. Aucune urgence, suspicion de contamination ou risque sanitaire, coupure d’eau, fuite active, inondation, danger immédiat, plomberie privée, nouveau branchement ou demande de borne hydrante. Pour une urgence, contactez directement les secours ou le service officiel approprié; cette note ne transmet rien.',
        'La page officielle invite à contacter le municipal des eaux pour un problème ou une urgence: Gérard Chappuis, 079 308 08 47; en son absence Christophe Chappuis, 078 863 54 11. Cette note reste limitée aux défauts non urgents. Les coordonnées exigées au téléphone et l’acceptation anonyme sont inconnues. Aucun nom, e-mail, téléphone ou photo collecté; aucune exigence du formulaire général reprise.',
        'La politique du 1er septembre 2023 prévoit le traitement des demandes et des exceptions de partage avec prestataires et selon la loi. Conservation, pays de traitement, exigences propres au signalement et accusé de réception non vérifiés. Aucun client, formulaire protégé, envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
