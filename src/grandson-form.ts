import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';

export const grandsonRobotsUrl = 'https://www.grandson.ch/robots.txt';
export const grandsonWorksUrl =
  'https://www.grandson.ch/officiel/administration-communale/travaux-et-environnement/';
export const grandsonMunicipalityUrl = 'https://www.grandson.ch/officiel/municipalite/dicasteres/';
export const grandsonContactUrl = 'https://www.grandson.ch/infos-pratiques/contact/';
export const grandsonCategory = 'Voirie communale';
export const grandsonCategories = Object.freeze([
  Object.freeze({
    service_code: grandsonCategory,
    service_name: 'Voirie communale – note téléphonique',
  }),
]);
export const grandsonScope =
  'Local text-only telephone-note preparation for nonurgent disruptions or faults concerning confirmed municipal roads, public space or public lighting at their actual point within Grandson VD (BFS5561). The works service explicitly invites communal voirie fault reports by telephone and publishes its maintenance scope. Its adjacent email is contextual, not a verified sending channel. No native incident form or reporter requiredness is established; local preparation collects no reporter contacts or photos and makes no claim of anonymous municipal acceptance. Exact boundary and resident confirmation do not independently establish asset ownership. Excludes private assets, neighbouring municipalities, utility outages, gas/water emergencies and immediate danger. No payload, sending, external completion or tracking.';
const changed = () =>
  new Error('The Grandson voirie sources have changed or are unavailable. Preparation is paused.');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const grandsonSourcePins = Object.freeze([
  Object.freeze({
    url: grandsonRobotsUrl,
    sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
    plain: true,
  }),
  Object.freeze({
    url: grandsonWorksUrl,
    sha256: 'f4f5370074e246ac57e2e5b4f39c018a811572880327b747e64ed5d49a9c297d',
    plain: false,
  }),
  Object.freeze({
    url: grandsonMunicipalityUrl,
    sha256: 'ada7424ea6f6d442d0cd2d9c04bd5aa14d9d6f3fe935d84dad67633217eb7ca6',
    plain: false,
  }),
  Object.freeze({
    url: grandsonContactUrl,
    sha256: '3c8d787cf747061c5697d954d779b7cdbcfb260f4f93b14d875dbd49b5899810',
    plain: false,
  }),
]);
/** Complete public policy/referral/authority/directory bytes are significant.
 * Global reCAPTCHA declarations are retained, never fetched or executed. No
 * incident form, hidden state or municipal contact requirements are invented. */
export function inspectGrandsonSource(url: string, body: string): void {
  const pin = grandsonSourcePins.find((p) => p.url === url);
  if (!pin || Buffer.byteLength(body) > 1_000_000 || hash(body) !== pin.sha256) throw changed();
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertGrandsonSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyGrandsonSources(
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
    for (const pin of grandsonSourcePins) {
      const task = shared.tail.then(async () => {
        assertGrandsonSourcesAvailable(request);
        const delay = Math.max(0, shared.next - now());
        if (delay) await sleep(delay);
        assertGrandsonSourcesAvailable(request);
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
          inspectGrandsonSource(pin.url, html);
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
    return grandsonCategories.map((c) => ({ ...c }));
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export const loadGrandsonCategories = verifyGrandsonSources;
export function grandsonRequirements(): Record<string, Requirements> {
  return {
    [grandsonCategory]: {
      scope: grandsonScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune de Grandson – Service Travaux et environnement'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual public asset maintained by municipal voirie in Grandson',
          required: true,
          datatype: 'string',
          values: ['Nonurgent fault of actual municipal public asset in Grandson confirmed'],
        },
      ],
      notes: [
        'Note téléphonique locale pour un dysfonctionnement non urgent de la voirie, des espaces publics ou de l’éclairage effectivement entretenus par la commune, au point précis dans Grandson. Pas de biens privés, panne de réseau, danger immédiat ou urgence gaz/eau.',
        'Le service invite les annonces de dysfonctionnement par téléphone. Le numéro publié sert aux contacts et aux urgences; cette préparation reste réservée aux observations non urgentes. Aucune catégorie ou exigence de contact native inventée. Aucun nom, e-mail, téléphone ou photo collecté pour cette note; cela ne garantit pas une acceptation anonyme par la commune.',
        'La politique spécifique au signalement, la conservation, le pays de traitement et l’accusé de réception ne sont pas vérifiés. Aucun envoi par téléphone, e-mail ou formulaire, aucune finalisation externe ni suivi. Aucun client natif ou de protection exécuté. Si le résultat est incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
