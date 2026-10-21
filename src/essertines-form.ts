import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const essertinesRobotsUrl = 'https://essertines-sur-yverdon.ch/robots.txt';
export const essertinesFormUrl = 'https://essertines-sur-yverdon.ch/contact/';
export const essertinesMunicipalityUrl = 'https://essertines-sur-yverdon.ch/officiel/municipalite/';
export const essertinesCategory = 'Voirie';
export const essertinesCategories = Object.freeze([
  Object.freeze({ service_code: essertinesCategory, service_name: 'Voirie – entretien communal' }),
]);
export const essertinesScope =
  'Local text-only preparation of nonurgent technical or maintenance problems concerning confirmed municipal roads, paths, public space or public lighting at the actual point in Essertines-sur-Yverdon (BFS5520). The contact page explicitly refers technical problems and infrastructure maintenance to Voirie, a recipient of its general contact form; it does not enumerate fault categories. Exact municipal boundary and resident confirmation do not independently verify asset ownership. Excludes private assets, utility outages, gas or water emergencies, immediate danger and Essertines-sur-Rolle. Location and responsibility confirmation are local review fields, separate from optional reporter postal details. No photos, native payload, sending or tracking.';
const changed = () =>
  new Error(
    'The Essertines-sur-Yverdon voirie sources have changed or are unavailable. Preparation is paused.',
  );
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** Preserve every original character except the one precisely located opaque GF3
 * read-time state. Never decode, return, reuse or execute that state, the empty
 * trap, declared honeypot plugin or any of the page's 52 script elements. */
export function fingerprintEssertinesForm(html: string): string {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const nodes = all(parse(html, { sourceCodeLocationInfo: true }));
    const forms = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'form' && attr(n, 'id') === 'gform_3',
    );
    const states = nodes.filter(
      (n): n is Element => 'tagName' in n && n.tagName === 'input' && attr(n, 'name') === 'state_3',
    );
    if (
      forms.length !== 1 ||
      states.length !== 1 ||
      !all(forms[0]).includes(states[0]) ||
      attr(states[0], 'type') !== 'hidden' ||
      !/^[A-Za-z0-9+/]{770}==$/.test(attr(states[0], 'value') ?? '')
    )
      throw changed();
    const position = states[0].sourceCodeLocation?.attrs?.value;
    if (!position) throw changed();
    const raw = html.slice(position.startOffset, position.endOffset);
    const match = /^(value\s*=\s*)(["'])([A-Za-z0-9+/]{770}==)\2$/.exec(raw);
    if (!match) throw changed();
    const start = position.startOffset + match[1].length + 1;
    return hash(html.slice(0, start) + '<discarded-GF3-state>' + html.slice(start + 772));
  } catch {
    throw changed();
  }
}
export const essertinesSourcePins = Object.freeze([
  Object.freeze({
    url: essertinesRobotsUrl,
    sha256: '42fcd83daf8cf790c638287c51dda3c8c1b19371854d2ab237b35a19612d34f8',
    form: false,
    plain: true,
  }),
  Object.freeze({
    url: essertinesFormUrl,
    sha256: 'faf9c6abb83548616ff5d361bda47af310d2e34c701ae269d6327c089ac600f4',
    form: true,
    plain: false,
  }),
  Object.freeze({
    url: essertinesMunicipalityUrl,
    sha256: '605d100e3fb80a90f4d3013cea0b103dc16c40e219262097b98ca9c8d9506659',
    form: false,
    plain: false,
  }),
]);
export function inspectEssertinesForm(html: string) {
  if (fingerprintEssertinesForm(html) !== essertinesSourcePins[1].sha256) throw changed();
  return essertinesCategories.map((c) => ({ ...c }));
}
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertEssertinesSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export async function verifyEssertinesSources(
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
    for (const pin of essertinesSourcePins) {
      const task = shared.tail.then(async () => {
        assertEssertinesSourcesAvailable(request);
        const delay = Math.max(0, shared.next - now());
        if (delay) await sleep(delay);
        assertEssertinesSourcesAvailable(request);
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
          const digest = pin.form ? fingerprintEssertinesForm(html) : hash(html);
          if (digest !== pin.sha256) throw changed();
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
    return essertinesCategories.map((c) => ({ ...c }));
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export const loadEssertinesCategories = verifyEssertinesSources;
export function essertinesRequirements(): Record<string, Requirements> {
  const contact = (code: string, description: string, required = true, max_length = 100) => ({
    code,
    description,
    required,
    max_length,
    contact: true,
    datatype: 'string',
  });
  return {
    [essertinesCategory]: {
      scope: essertinesScope,
      photo_required: false,
      max_photos: 0,
      email_required: true,
      phone_required: true,
      phone_max_length: 50,
      email_max_length: 254,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Commune d’Essertines-sur-Yverdon – Voirie'],
      extra_fields: [
        contact('first_name', 'Private first name'),
        contact('last_name', 'Private surname'),
        contact(
          'reporter_street',
          'Your postal address (optional; not the issue location)',
          false,
          250,
        ),
        contact(
          'reporter_postcode_locality',
          'Your postcode and locality (optional; not the issue location)',
          false,
          250,
        ),
        {
          code: 'public_asset_confirmed',
          description:
            'Confirm the actual public asset is maintained by municipal voirie in Essertines-sur-Yverdon',
          required: true,
          datatype: 'string',
          values: ['Actual municipal public asset in Essertines-sur-Yverdon confirmed'],
        },
      ],
      notes: [
        'Préparation locale des problèmes non urgents concernant une infrastructure publique effectivement entretenue par la commune, au lieu confirmé dans Essertines-sur-Yverdon. Pas de biens privés, panne de réseau, danger immédiat ou urgence gaz/eau.',
        'Le formulaire général propose le destinataire Voirie : prénom, nom, e-mail, téléphone, service et message obligatoires. Adresse et NPA/localité du contact facultatifs, distincts du lieu du problème. Point précis, confirmation de responsabilité et limites de texte sont des règles locales.',
        'Aucune photo. Les contacts restent dans Civic, hors du traitement par IA. Aucune politique spécifique au signalement ni durée de conservation ou pays de traitement confirmés; aucune garantie de confidentialité municipale déduite du formulaire.',
        'Préparation uniquement : aucun envoi, formulaire externe prérempli ou suivi. Protection native, validation, destinataire effectif et accusé de réception non vérifiés. Aucun code, piège ou état natif exécuté ou réutilisé. Si le résultat est incertain, ne jamais réessayer, recréer ou changer de canal automatiquement.',
      ],
    },
  };
}
