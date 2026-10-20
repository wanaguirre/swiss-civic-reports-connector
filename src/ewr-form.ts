import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const ewrFormUrl = 'https://ewr.ch/elektrizitaet/defekte-kandelaber-melden/';
export const ewrPrivacyUrl = 'https://ewr.ch/datenschutz/';
export const ewrMunicipalities = Object.freeze(
  Object.fromEntries(
    Object.entries({
      'ewr-romanshorn': {
        bfsId: 4436,
        municipality: 'Romanshorn',
        locality: 'Romanshorn',
        referral: 'https://ewr.ch/dienstleistungen/oeffentliche-beleuchtung/',
      },
      'ewr-salmsach': {
        bfsId: 4441,
        municipality: 'Salmsach',
        locality: 'Salmsach',
        referral: 'https://www.salmsach.ch/stromwasserversorgung',
      },
      'ewr-uttwil': {
        bfsId: 4451,
        municipality: 'Uttwil',
        locality: 'Uttwil',
        referral: 'https://www.uttwil.ch/public/upload/assets/554/Flyer%20Werke%20Uttwil.pdf?fp=6',
      },
    }).map(([k, v]) => [k, Object.freeze(v)]),
  ),
) as Readonly<
  Record<
    'ewr-romanshorn' | 'ewr-salmsach' | 'ewr-uttwil',
    Readonly<{ bfsId: number; municipality: string; locality: string; referral: string }>
  >
>;
export type EwrName = keyof typeof ewrMunicipalities;
export const isEwrMunicipality = (name: string): name is EwrName =>
  Object.hasOwn(ewrMunicipalities, name);
export const ewrCategories = [
  'Lampe defekt',
  'Lampe brennt unregelmässig',
  'Leuchte beschädigt (z.B. Glas defekt)',
  'Masttürchen fehlt',
  'Sonstiger Defekt',
].map((service_code) => ({ service_code, service_name: service_code }));
export function ewrScope(name: EwrName) {
  const c = ewrMunicipalities[name];
  return `Only one nonurgent actual EWR-maintained public streetlight in ${c.municipality} BFS${c.bfsId}, at the exact confirmed point, with genuine mandatory pole number and street. Municipal boundary or electricity supply alone does not prove asset responsibility. Exclude private lights, supply outages, collisions, fallen poles, urgent danger and other municipalities. Freeze exactly one native municipality from the destination.`;
}
// Complete unchanged captures, not normalized native state; clients read inertly only.
export const ewrSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://ewr.ch/elektrizitaet/defekte-kandelaber-melden/',
      sha256: 'e207617a23ba4f0dcfcd45b9daad159025ea407cf6f99c0cf0a11abc00ace214',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/dienstleistungen/oeffentliche-beleuchtung/',
      sha256: 'eb5972aab779669177ca06002623c2649996eace8e0d532b1c7393c60db04757',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/datenschutz/',
      sha256: 'e292eeb4ca6916a4bed34c2815a14fc07ec43db36cca134d510731092b513924',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/wp-content/uploads/2024/08/defekte-strassenbeleuchtung-kandelaber.pdf',
      sha256: '6f90f46bd5f6d1d45c423331b3f0a8148dc237dae54cf23486bec1060bb821a5',
      type: 'pdf',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.salmsach.ch/stromwasserversorgung',
      sha256: 'f680b299229081e370af148f694f3c0c23a0c1f24e959074c9c862a276a474a2',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.uttwil.ch/public/upload/assets/554/Flyer%20Werke%20Uttwil.pdf?fp=6',
      sha256: '23cd5e45050b9477952828c67e5abbcd90d634e007e15403e7288b86f2499bf6',
      type: 'pdf',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/wp-content/cache/autoptimize/js/autoptimize_single_b0fb3a2f1eeb5deb0cdf11935e7be584.js?ver=6.2.2',
      sha256: '2ce30d7191bbb10914bd18f45dfc4a4c6f8cec8d37b38e6d5b5669fcf31bdb5b',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/wp-content/cache/autoptimize/js/autoptimize_single_1247ddd4186ee93e069001288be1d300.js?ver=6.2.2',
      sha256: '2449bcdb76bb77ecd953f38a63ed4bc38906758048eb24581013b24f023bdc97',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://ewr.ch/wp-content/cache/autoptimize/js/autoptimize_single_88a6be9d65250bef59a48b7e4a7e8f68.js?ver=2.4.02',
      sha256: '2ad0a10fe297c13764f1094ccf2c36cfe98abd8f14f0e2c0ad88aec1e90827a7',
      type: 'javascript',
      maxBytes: 1000000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
const changed = () => new Error('The EWR lighting source has changed. Preparation is paused.');
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertEwrSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export function paceEwrSourceReads(
  request: typeof fetch,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  let context = contexts.get(request);
  if (!context) {
    context = { tail: Promise.resolve(), next: 0, stopped: false };
    contexts.set(request, context);
  }
  const shared = context;
  return (input, init) => {
    const task = shared.tail.then(async () => {
      assertEwrSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertEwrSourcesAvailable(request);
      shared.next = now() + 10000;
      try {
        const response = await request(input, { ...init, signal: AbortSignal.timeout(20000) });
        if (!response.ok || response.redirected) shared.stopped = true;
        return response;
      } catch {
        shared.stopped = true;
        throw changed();
      }
    });
    shared.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}
export async function loadEwrCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  const paced = paceEwrSourceReads(request, now, sleep);
  assertEwrSourcesAvailable(request);
  try {
    // Fixed reviewed sources only; preserve the shared verifier's ten-source bound.
    for (let n = 0; n < ewrSources.length; n += 10)
      await verifyPublicSourceManifest(paced, ewrSources.slice(n, n + 10), retry, now);
  } catch {
    contexts.get(request)!.stopped = true;
    throw changed();
  }
  return ewrCategories.map((c) => ({ ...c }));
}
export function ewrRequirements(name: EwrName): Record<string, Requirements> {
  const c = ewrMunicipalities[name];
  return Object.fromEntries(
    ewrCategories.map(({ service_code }) => [
      service_code,
      {
        scope: ewrScope(name),
        photo_required: false,
        max_photos: 0,
        email_required: true,
        name_required: true,
        phone_required: true,
        contact_fields: ['name', 'phone'],
        phone_max_length: 400,
        email_max_length: 254,
        description_max_length: 2000,
        location_label_max_length: 400,
        bodies: [`EW Romanshorn – ${c.municipality} Strassenbeleuchtung`],
        extra_fields: [
          {
            code: 'lamp_number',
            description: 'Actual required pole number; preserve leading zeros, never invent',
            required: true,
            datatype: 'string',
            max_length: 400,
          },
          {
            code: 'lighting_street',
            description: 'Actual street of the affected lamp',
            required: true,
            datatype: 'string',
            max_length: 400,
          },
          {
            code: 'lighting_house_number',
            description: 'Nearby actual house number (optional)',
            required: false,
            datatype: 'string',
            max_length: 400,
          },
          {
            code: 'public_lamp_confirmed',
            description:
              'Confirm one actual EWR-maintained public lamp in the selected municipality',
            required: true,
            datatype: 'string',
            values: [`One EWR public lamp in ${c.municipality} confirmed`],
          },
          {
            code: 'privacy_acknowledgement',
            description: 'Consent to storage and processing under the EWR privacy policy',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['EWR storage and processing consent confirmed'],
          },
        ],
        notes: [
          `Nur eine tatsächliche öffentliche EWR-Lampe in ${c.municipality} am bestätigten Standort. Echte Kandelabernummer und Strasse erforderlich; Hausnummer freiwillig. Keine privaten Leuchten, Ausfälle, Kollisionen, umgefahrenen Masten oder akuten Gefahren.`,
          'Name, Telefon und E-Mail sind im Webformular technisch Pflichtfelder und bleiben ausserhalb der KI. Keine erfundene Meldeadresse. Keine Fotos. Eine Fehlerart und nützlicher Text sind strengere lokale Vorbereitungsregeln; native Checkboxen erlauben mehrere Gemeinden und Fehlerarten, lokal wird genau eine Gemeinde fest gebunden.',
          'Datenschutz vom 17. Oktober 2024: Kommunikation und Störungsbehebung, Dienstleister/Partner/Behörden und mögliche Auslandübermittlungen, hauptsächlich Schweiz/EWR mit Ausnahmen. Zweck-, gesetzliche und technische Aufbewahrung; Geschäftskommunikation kann bis zehn Jahre aufbewahrt werden, keine feste Lampenfrist zugesichert. Native Speicherung/Verarbeitung bedarf Einwilligung.',
          'Das alternative PDF Version 25. August 2024 hat keine E-Mail-Pflicht und nennt netz@ewr.ch sowie Ort/Datum; es ist ein eigener manueller Weg und kein automatischer Ersatz. Hier wird weder ein PDF erstellt noch ein Kanal gewechselt.',
          'Contact Form 7 und WP Armour nur als Quelltext geprüft. Keine Initialisierung, Schemaprüfung am Server, Fallen-, Nonce- oder Token-Wiederverwendung. Ein mail_sent-Status oder posted_data_hash beweist keinen dauerhaften kommunalen Eingang.',
          'Neun vollständige feste Quellen nur per GET mit mindestens zehn Sekunden Abstand; jede Abweichung oder fehlgeschlagene Prüfung stoppt den gemeinsamen Kontext vor weiteren oder gespeicherten Prüfungen. Keine Cookies, Weiterleitungen, Challenges, POSTs oder Uploads.',
          'Vorbereitung bleibt hier. Kein nativer Payload, Versand, externe Fertigstellung oder Tracking. Bei unklarem Ausgang niemals erneut melden oder den Versandkanal wechseln.',
        ],
      } as Requirements,
    ]),
  );
}
