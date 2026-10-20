import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';
export const sieRobotsUrl = 'https://www.sie.ch/robots.txt';
export const sieReportUrl = 'https://www.sie.ch/a-votre-service/panne-de-luminaire-374';
export const sieFaqUrl = 'https://www.sie.ch/a-votre-service/faq-373';
export const sieMandateUrl = 'https://www.sie.ch/electricite/smart-lighting-1161';
export const siePrivacyUrl = 'https://www.sie.ch/charte-de-protection-des-donnees-sie/';
export const sieCategory = 'Luminaire communal SIE';
export const sieCategories = Object.freeze([
  Object.freeze({
    service_code: sieCategory,
    service_name: 'Éclairage communal SIE – note téléphonique',
  }),
]);
export const sieScope =
  'Local French telephone-note preparation for a nonurgent fault of an actual SIE-maintained municipal luminaire at its confirmed point in Crissier VD (BFS5583). SIE explicitly identifies its four municipal lighting networks and invites telephone fault observations; this profile is limited to Crissier. Provide a real lamp number of one to six digits when known, otherwise its actual location; never invent an identifier. The provider asks callers to leave contact details, but no exact native contact fields or working guest online form are qualified. This local note collects no reporter contacts or photos; add callback details yourself during a separately chosen call. This is not anonymous municipal acceptance. Boundary and resident confirmation do not independently prove ownership. Excludes private lamps, neighbouring municipalities, electricity outages, emergencies and immediate danger. No calls, email, native payload, sending, external completion or tracking.';
const changed = () =>
  new Error(
    'The SIE Crissier lighting sources have changed or are unavailable. Preparation is paused.',
  );
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const sieSourcePins = Object.freeze([
  Object.freeze({
    url: sieRobotsUrl,
    sha256: 'dc2f08337f914b83104b1cc09a2e273eec7d4003cc6fd7046411db9500c6056f',
    plain: true,
  }),
  Object.freeze({
    url: sieReportUrl,
    sha256: '6e4b274130ed9c219b6c391b89fa77e075e42f2045138b9c4082b5bfb2b10817',
    plain: false,
  }),
  Object.freeze({
    url: sieFaqUrl,
    sha256: 'a97502bbb2342fdbc008ee652b5747c2bfe503361179ee7fc8fb919e560fc134',
    plain: false,
  }),
  Object.freeze({
    url: sieMandateUrl,
    sha256: 'e913a79ccd0a48aee0910573cafb3f9a23350773b0de2e3ab0b2c9570db2dc0c',
    plain: false,
  }),
  Object.freeze({
    url: siePrivacyUrl,
    sha256: 'c6e0532b7148c4379799b954bb61a30b5113d635814268886987d39c794cbe50',
    plain: false,
  }),
]);
/** Full public bytes are significant, including contradictory phone/privacy statements. No native form/state/security clients or stopped Crissier host are requested. */
export function inspectSieSource(url: string, body: string): void {
  const pin = sieSourcePins.find((p) => p.url === url);
  if (!pin || Buffer.byteLength(body) > 1_000_000 || hash(body) !== pin.sha256) throw changed();
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertSieSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifySieSources(
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
    for (const pin of sieSourcePins) {
      const task = shared.tail.then(async () => {
        assertSieSourcesAvailable(request);
        const delay = Math.max(0, shared.next - now());
        if (delay) await sleep(delay);
        assertSieSourcesAvailable(request);
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
          inspectSieSource(pin.url, html);
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
    return sieCategories.map((c) => ({ ...c }));
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export const loadSieCategories = verifySieSources;
export function sieRequirements(): Record<string, Requirements> {
  return {
    [sieCategory]: {
      scope: sieScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      name_required: false,
      phone_required: false,
      contact_fields: [],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['SIE SA – Éclairage communal de Crissier'],
      extra_fields: [
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm a nonurgent fault of an actual SIE-maintained municipal luminaire in Crissier',
          required: true,
          datatype: 'string',
          values: [
            'Nonurgent fault of actual SIE-maintained municipal luminaire in Crissier confirmed',
          ],
        },
        {
          code: 'lamp_number',
          description: 'Real lamp number if known (one to six digits); never invent an identifier',
          required: false,
          datatype: 'string',
          max_length: 6,
          format: 'digit_identifier',
        },
      ],
      notes: [
        'Note téléphonique locale pour une panne non urgente d’un luminaire communal effectivement entretenu par SIE, au point précis à Crissier. Indiquer le numéro réel du luminaire (1 à 6 chiffres) s’il est connu, sinon son emplacement exact. Ni lampes privées, communes voisines, coupures de réseau, urgences ou danger immédiat. La limite communale et votre confirmation ne prouvent pas indépendamment la propriété.',
        'La page dédiée SIE et la commune indiquent le 021 631 51 11; la FAQ indique plutôt le 021 631 50 00. Cette différence reste non résolue. SIE demande de laisser vos coordonnées; cette note ne les recueille pas. Vous devrez les donner vous-même lors d’un éventuel appel choisi séparément. Aucun envoi ni acceptation anonyme vérifiée. La commune mentionne ep@sie.ch, sans contrat d’envoi ou d’accusé vérifié.',
        'La charte annonce un stockage suisse et aucune transmission à l’étranger, tout en citant des prestataires et une exception pour les autorités étrangères. Aucun délai fixe propre aux signalements, aucune photo ni réception vérifiée. Le délai de réparation annoncé de 15 jours ne constitue pas un accusé de réception. Aucun appel, e-mail, formulaire natif, envoi, finalisation externe ou suivi. Après un résultat incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
