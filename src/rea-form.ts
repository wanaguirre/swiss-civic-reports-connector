import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const reaFormUrl = 'https://rea.swiss/formular/meldung-stoerung-oeffentliche-beleuchtung/';
export const reaPrivacyUrl =
  'https://rea.swiss/wp-content/uploads/20260601-Datenschutzerklaerung-REA.pdf';
export const reaMunicipalities = Object.freeze({
  'rea-hefenhofen': Object.freeze({
    bfsId: 4416,
    municipality: 'Hefenhofen',
    locality: 'Hefenhofen',
    referral: 'https://www.hefenhofen.ch/verwaltung/versorgungswerke/elektra-auenhofen',
  }),
  'rea-amriswil': Object.freeze({
    bfsId: 4461,
    municipality: 'Amriswil',
    locality: 'Amriswil',
    referral: 'https://www.amriswil.ch/',
  }),
});
export type ReaName = keyof typeof reaMunicipalities;
export const isReaMunicipality = (name: string): name is ReaName =>
  Object.hasOwn(reaMunicipalities, name);
export const reaCategories = [
  'Leuchtmittel defekt',
  'Leuchtmittel leuchtet unregelmässig',
  'Kandelaber beschädigt',
  'Masstürchen fehlt',
  'Störende Blendwirkung',
].map((service_code) => ({ service_code, service_name: service_code }));
export function reaScope(name: ReaName) {
  const c = reaMunicipalities[name];
  return `Only nonurgent faults of one actual REA-maintained public lamp in the native locality ${c.locality}, within ${c.municipality} BFS${c.bfsId}, at its confirmed precise point. A municipal boundary or electricity supply does not prove lamp responsibility. Other native localities, unconfirmed assigned areas, private fixtures, supply outages, multiple lamps, urgent danger and other municipalities are excluded. Native locality is frozen from the destination, never freely reassigned.`;
}
// Entire identical native-page captures, responsibility/referral/privacy sources,
// and the six reviewed clients relevant to form behavior. No normalization of
// tokens, duplicate native names/IDs or anti-spam state, no client execution.
export const reaSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://rea.swiss/formular/meldung-stoerung-oeffentliche-beleuchtung/',
      sha256: '75d6b6b4e279ee2c6d253754fa26b77cde195c55053e13b9e98222c8750e337c',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/uploads/20260601-Datenschutzerklaerung-REA.pdf',
      sha256: '4f775656d4c7cf0d64be190018531bc0ef44c845072a7f47cb37863974160573',
      type: 'pdf',
      maxBytes: 3000000,
    },
    {
      url: 'https://rea.swiss/leistung/stromversorgung/',
      sha256: '16412c3f812298a7026cc9622e5a90b50960f2066cebe1f8812a957971270c04',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.hefenhofen.ch/verwaltung/versorgungswerke/elektra-auenhofen',
      sha256: 'f6cd73b73ea6b6e787ca0dab23d9ef99b0190da4c53adad6ac4a1b584c9cfd7b',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.amriswil.ch/',
      sha256: '678fb833acba61defec9f87bd4789b40e9eb2cd1ff891596d20b9d97ca60e512',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/cache/min/1/wp-content/plugins/honeypot/includes/js/wpa.js?ver=1792408465',
      sha256: '1c35bd262a78e24cb899d3d9d0148c6ffaf9fbe1487669d44227654700ec63f2',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/plugins/elementor/assets/js/frontend-modules.min.js?ver=4.3.5',
      sha256: '2636846470306c226883fb4ede46a96d71a54454d6c8b1bd9e26e6baf72db965',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/plugins/elementor/assets/js/frontend.min.js?ver=4.3.5',
      sha256: 'bbfe6403b4ddba29284c72d20f000154d04588d60850fc39a6fd65861c6d83e6',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/plugins/dynamic-content-for-elementor/assets/js/settings.min.js?ver=3.4.18',
      sha256: 'b5d6f0565d54b51919a40cf26907cb534cc430871d5f745276074f8e0123dc24',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/plugins/elementor-pro/assets/js/frontend.min.js?ver=4.3.1',
      sha256: 'b06af0760e731c62a1477d4666887e12fd7f1fe782aa7e51b5851fc47f363d08',
      type: 'javascript',
      maxBytes: 1000000,
    },
    {
      url: 'https://rea.swiss/wp-content/plugins/elementor-pro/assets/js/elements-handlers.min.js?ver=4.3.1',
      sha256: '689efb7b6ddd81ea0912de02e44853347850ba3fe8d8a25692edba3e1d0d3d93',
      type: 'javascript',
      maxBytes: 1000000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
const changed = () => new Error('The REA lighting source has changed. Preparation is paused.');
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertReaSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
export function paceReaSourceReads(
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
      assertReaSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertReaSourcesAvailable(request);
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
export async function loadReaCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  const paced = paceReaSourceReads(request, now, sleep);
  assertReaSourcesAvailable(request);
  try {
    // Fixed reviewed sources only; preserve the shared verifier's ten-source bound.
    for (let n = 0; n < reaSources.length; n += 10)
      await verifyPublicSourceManifest(paced, reaSources.slice(n, n + 10), retry, now);
  } catch {
    contexts.get(request)!.stopped = true;
    throw changed();
  }
  return reaCategories.map((c) => ({ ...c }));
}
export function reaRequirements(name: ReaName): Record<string, Requirements> {
  const c = reaMunicipalities[name];
  return Object.fromEntries(
    reaCategories.map(({ service_code }) => [
      service_code,
      {
        scope: reaScope(name),
        photo_required: false,
        max_photos: 0,
        email_required: false,
        name_required: false,
        phone_required: false,
        contact_fields: ['name', 'phone'],
        phone_max_length: 100,
        email_max_length: 254,
        description_max_length: 4000,
        location_label_max_length: 250,
        bodies: [`Regio Energie Amriswil – ${c.municipality} Strassenbeleuchtung`],
        extra_fields: [
          {
            code: 'lighting_location',
            description: 'Actual address as close as possible to the lamp',
            required: true,
            datatype: 'string',
            max_length: 250,
          },
          {
            code: 'lamp_number',
            description: 'Actual lamp number if known; preserve leading zeros',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'contact_postcode',
            description: 'Your postcode (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 20,
          },
          {
            code: 'public_lamp_confirmed',
            description: 'Confirm one actual REA-maintained public lamp in the selected locality',
            required: true,
            datatype: 'string',
            values: [`One REA public lamp in locality ${c.locality} confirmed`],
          },
          {
            code: 'privacy_acknowledgement',
            description: 'Confirm REA privacy policy read',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['REA privacy policy read and understood'],
          },
        ],
        notes: [
          `Nur eine tatsächliche öffentliche REA-Lampe in der Ortsauswahl ${c.locality}, Gemeinde ${c.municipality}, am bestätigten genauen Standort. Zugewiesenen Unterhalt prüfen; keine anderen Ortsteile, privaten Leuchten, Versorgungsunterbrüche oder akuten Gefahren.`,
          'Tatsächliche Adresse möglichst nahe beim Kandelaber erforderlich. Echte Lampennummer freiwillig, führende Nullen erhalten. Fehlerart, eine Lampe, Textgrenzen, Objektbestätigung und Datenschutzhinweis sind lokale Vorbereitungsregeln; nativ sind Schadenart und Anzahl freiwillig.',
          'Name, Postleitzahl, Telefon und E-Mail freiwillig und ausserhalb der KI. Keine erfundene Meldeadresse oder Einwilligung. Keine Fotos, keine native Statusbenachrichtigung oder externe Statusabfrage.',
          'Die Datenschutzerklärung vom 1. Juni 2026 nennt Anfragebearbeitung, Dienstleister/Partner/Behörden und Auslandübermittlungen unter Bedingungen. Zweckgebundene sowie gesetzliche Aufbewahrung, keine feste Frist für Lampenmeldungen; keine garantierte Übertragungssicherheit.',
          'Das native Formular verwendet denselben Namen und dieselbe ID für Lampennummer und Meldername. Civic hält beide Werte getrennt und erzeugt keinen nativen Payload. WP Armour und Elementor-Zustände werden weder ausgeführt, normalisiert noch wiederverwendet. Die HTML-Bestätigung beweist keinen Eingang.',
          'Elf vollständige feste Quellen werden nur mit GET und mindestens zehn Sekunden Abstand geprüft. Jede Änderung oder fehlgeschlagene Prüfung stoppt den gemeinsamen Anfragekontext vor weiteren oder zwischengespeicherten Prüfungen. Keine Cookies, Weiterleitungen, Initialisierung, Challenges, POSTs oder Uploads.',
          'Vorbereitung bleibt in Civic; keine Übermittlung, externe Fertigstellung oder Sendebestätigung. Bei unklarem Ausgang niemals erneut melden oder den Versandkanal wechseln.',
        ],
      } as Requirements,
    ]),
  );
}
