import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';
export const egsFormUrl = 'https://www.egs-strom.ch/strassenbeleuchtung/';
export const egsPrivacyUrl =
  'https://www.egs-strom.ch/wp-content/uploads/2024/05/Datenschutzerklaerung-19.03.2024.pdf';
export const egsMunicipalities = Object.freeze({
  'egs-obersiggenthal': Object.freeze({
    bfsId: 4038,
    municipality: 'Obersiggenthal',
    referral: 'https://www.obersiggenthal.ch/',
  }),
  'egs-untersiggenthal': Object.freeze({
    bfsId: 4044,
    municipality: 'Untersiggenthal',
    referral: 'https://www.untersiggenthal.ch/de/energie-umwelt/energie/energieversorgung/',
  }),
});
export type EgsName = keyof typeof egsMunicipalities;
export const isEgsMunicipality = (name: string): name is EgsName =>
  Object.hasOwn(egsMunicipalities, name);
export const egsCategories = [
  { service_code: 'Lampe brennt nicht', service_name: 'Lampe brennt nicht' },
  { service_code: 'Lampe brennt unreglemässig', service_name: 'Lampe brennt unregelmässig' },
  ...['Leuchte zerstört', 'Kandelabertürchen fehlt', 'Andere Defekte'].map((service_code) => ({
    service_code,
    service_name: service_code,
  })),
];
export function egsScope(name: EgsName) {
  const c = egsMunicipalities[name];
  return `Only nonurgent faults of actual EGS-maintained public streetlights within ${c.municipality} (BFS${c.bfsId}), at the confirmed precise lamp point. Municipal boundaries do not prove lamp ownership. Private fixtures, supply outages, other assets, urgent danger and neighbouring municipalities are excluded. The canonical native municipality derives from the frozen destination, never a free-text neighbour choice.`;
}
// Factual hashes only. Whole first HTML includes unchanged native state and all
// script/configuration references. The observed missing-client page is rejected,
// never normalized as rotation. No provider code, payload or state is retained.
export const egsSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://www.egs-strom.ch/strassenbeleuchtung/',
      sha256: 'd1769db27e88f82576f6a134df725afb7097f8caf97da802eb7480b07f312071',
      type: 'html' as const,
      maxBytes: 1000000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/uploads/2024/05/Datenschutzerklaerung-19.03.2024.pdf',
      sha256: '1ed86f3f1e3387b3f24a17c4f864e6a820c4ece090cad376539d26eb11e0c6ec',
      type: 'pdf' as const,
      maxBytes: 100000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/js/frontend/wpforms.min.js?ver=1.9.0.4',
      sha256: '5f99e943c5c2dcedcb6637fb25cac8d3c681df3f2123895072aa65aa00508ef5',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/js/integrations/elementor/frontend.min.js?ver=1.9.0.4',
      sha256: '59e9f2bfefde83bfd4b43035be4e43a5ff5be6a1b5164a2b71ebfc0835a041b6',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/pro/lib/intl-tel-input/module.intl-tel-input.min.js?ver=21.2.8',
      sha256: '5737a871ce5042682fd85d99ac16b3b8e4c3b887c45541ed6a65de67186e5e5f',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/lib/jquery.validate.min.js?ver=1.20.1',
      sha256: '5221f0987fdce1d32801e65a835e135f7f474d386caaae34e49ec78132c00377',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/js/share/utils.min.js?ver=1.9.0.4',
      sha256: '5e3c1c51cc1426df4bf854e510a9bf1b0d756deb01ac55a8a2c15c62567d2b62',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/js/frontend/wpforms-modern.min.js?ver=1.9.0.4',
      sha256: '37f530a49715f9e150a7f6d2aa9b214ac86da8fb5afde85fd727c9f195643d10',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
    {
      url: 'https://www.egs-strom.ch/wp-content/plugins/wpforms/assets/pro/lib/intl-tel-input/module.intl-tel-input-utils.min.js',
      sha256: '03ead4f04bab625255f63b23982637a01d410e17859484da407565bf957c35e4',
      type: 'javascript' as const,
      maxBytes: 500000,
    },
  ].map((pin) => Object.freeze(pin)),
);
const changed = () =>
  new Error('The EGS reporting source has changed or is cooling down. Preparation is paused.');
type Queue = { tail: Promise<void>; next: number; blockedUntil: number };
const queues = new WeakMap<typeof fetch, Queue>();
/** Share the provider's ten-second request cadence and access cooldown between
 * both destinations. Clock/sleep injection is for offline scheduling checks. */
export function paceEgsSourceReads(
  request: typeof fetch,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  let q = queues.get(request);
  if (!q) {
    q = { tail: Promise.resolve(), next: 0, blockedUntil: 0 };
    queues.set(request, q);
  }
  const queue = q;
  return (input, init) => {
    const task = queue.tail.then(async () => {
      if (queue.blockedUntil > now()) throw changed();
      const delay = Math.max(0, queue.next - now());
      if (delay) await sleep(delay);
      if (queue.blockedUntil > now()) throw changed();
      queue.next = now() + 10000;
      // The manifest timeout belongs to network I/O, after the pacing queue.
      const response = await request(input, { ...init, signal: AbortSignal.timeout(20_000) });
      if (response.status === 403) queue.blockedUntil = Infinity;
      if (response.status === 429) {
        const h = response.headers.get('retry-after') ?? '';
        const retry = /^\d+$/.test(h) ? Number(h) * 1000 : Date.parse(h) - now();
        queue.blockedUntil = Math.max(
          queue.blockedUntil,
          now() + Math.max(300000, Number.isFinite(retry) ? retry : 0),
        );
      }
      return response;
    });
    queue.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
}
export function assertEgsSourcesAvailable(request: typeof fetch, now: () => number = Date.now) {
  if ((queues.get(request)?.blockedUntil ?? 0) > now()) throw changed();
}
export async function loadEgsCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
  sleep?: (ms: number) => Promise<void>,
) {
  const paced = paceEgsSourceReads(request, now, sleep);
  try {
    await verifyPublicSourceManifest(paced, egsSources, retry, now);
  } catch (error) {
    const q = queues.get(request)!;
    q.blockedUntil = Math.max(q.blockedUntil, now() + 300000);
    throw error;
  }
  return egsCategories.map((c) => ({ ...c }));
}
export function egsRequirements(name: EgsName): Record<string, Requirements> {
  const c = egsMunicipalities[name];
  return Object.fromEntries(
    egsCategories.map(({ service_code }) => [
      service_code,
      {
        scope: egsScope(name),
        photo_required: false,
        max_photos: 0,
        email_required: true,
        phone_required: true,
        phone_max_length: 50,
        contact_fields: ['phone'],
        description_max_length: 4000,
        location_label_max_length: 250,
        bodies: [`Elektrizitäts-Genossenschaft Siggenthal – ${c.municipality} Strassenbeleuchtung`],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          })),
          {
            code: 'salutation',
            description: 'Salutation',
            required: true,
            contact: true,
            datatype: 'string',
            values: ['Frau', 'Herr'],
          },
          {
            code: 'contact_company',
            description: 'Your company (optional)',
            required: false,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lighting_location',
            description: 'Precise actual lamp location',
            required: true,
            datatype: 'string',
            max_length: 500,
          },
          {
            code: 'lighting_street',
            description: 'Actual lamp street (optional)',
            required: false,
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
            code: 'public_lamp_confirmed',
            description: `Confirm the actual EGS-maintained public lamp in ${c.municipality}`,
            required: true,
            datatype: 'string',
            values: [`Public lamp in ${c.municipality} maintained by EGS confirmed`],
          },
        ],
        notes: [
          `Nur nicht dringende Schäden an tatsächlichen öffentlichen Lampen im Unterhalt der EGS in ${c.municipality}. Gemeindegrenzen allein beweisen nicht den Unterhalt. Keine privaten Leuchten, Versorgungsunterbrüche, anderen Anlagen oder unmittelbaren Gefahren.`,
          'Genaue tatsächliche Lampenposition erforderlich. Strasse und echte Kandelabernummer freiwillig; Nummer nie erfinden und führende Nullen erhalten. Die native Gemeinde wird aus dem verbindlichen Ziel abgeleitet, nicht frei gewählt.',
          'Private Anrede, Vor-/Nachname, Telefon und E-Mail erforderlich; Firma freiwillig. Alle Kontaktdaten bleiben ausserhalb der KI. Keine erfundenen postalischen Felder oder zusätzliche Einwilligung. Native Telefon-Länderprüfung und Normalisierung sind für eine Übermittlung unbestätigt; lokal wird nur begrenzter Telefontext geprüft.',
          'Eine Fehlerart und nützliche Beschreibung sind konservative lokale Regeln; native Grund-Auswahl und Kommentar sind freiwillig. Native Schreibweise Lampe brennt unreglemässig bleibt als Kennung erhalten. Keine Fotoanhänge.',
          'Die allgemeine Richtlinie nennt Dienstleister, Partner, Behörden und Auslandbedingungen, aber keine feste Aufbewahrungsfrist für Lampenmeldungen. Native reCAPTCHA-, Telefon-GeoIP- und UUID-Cookie-Datenflüsse bleiben für eine Übermittlung ungeklärt; Civic führt nichts davon aus.',
          'Neun feste vollständige Quellen werden ausschliesslich mit GET gelesen, mindestens zehn Sekunden zwischen Anfragen, gemeinsam für beide EGS-Ziele. Kalte Prüfungen benötigen mindestens 80 Sekunden. Jede Änderung oder die beobachtete Seite ohne Formular-Clients stoppt die Vorbereitung bis zur Quellenprüfung und neuen Version.',
          'Keine Normalisierung/Wiederverwendung nativer Zustände, keine Client-/CAPTCHA-Ausführung, keine Initialisierung, kein Payload oder POST. Alles bleibt in Civic; keine externe Fertigstellung oder Statusabfrage. Unklarer Ausgang erlaubt weder erneute Meldung noch Kanalwechsel.',
        ],
      },
    ]),
  );
}
