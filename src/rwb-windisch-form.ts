import { verifyPublicSourceManifest } from './public-source-manifest.js';
import { rwbSources, rwbCategories, rwbRequirements, rwbCategory } from './rwb-form.js';
export const rwbWindischIdentityUrl =
  'https://www.regionalwerke.ch/gemeinde-werke/elektrizitaetswerk-windisch';
export const rwbWindischReferralUrl =
  'https://www.windisch.ch/politik-verwaltung/verwaltung/abteilungen.html/48';
export const rwbWindischSources = Object.freeze([
  Object.freeze({
    url: rwbWindischIdentityUrl,
    sha256: 'd55188f4c18d8c72584c6890ab68a525972f2f6784b0efc380331be4f9b3f365',
    type: 'html' as const,
    maxBytes: 1_000_000,
  }),
  ...rwbSources,
]);
// Shared per request context, across client instances and before cached reads.
// A protected/rate-limited response is never an invitation to retry another path.
const contexts = new WeakMap<
  typeof fetch,
  { stopped: boolean; last: number; tail: Promise<void> }
>();
function context(request: typeof fetch) {
  let c = contexts.get(request);
  if (!c) {
    c = { stopped: false, last: -Infinity, tail: Promise.resolve() };
    contexts.set(request, c);
  }
  return c;
}
const changed = () =>
  new Error('The Windisch RWB reporting source has changed. Preparation is paused.');
export function assertRwbWindischSourcesAvailable(request: typeof fetch) {
  if (context(request).stopped) throw changed();
}
export async function verifyRwbWindischSources(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const c = context(request);
  const previous = c.tail;
  let release!: () => void;
  c.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    assertRwbWindischSourcesAvailable(request);
    await verifyPublicSourceManifest(
      async (url, init) => {
        assertRwbWindischSourcesAvailable(request);
        await pause(Math.max(0, 2000 - (now() - c.last)));
        c.last = now();
        const response = await request(url, init);
        if (response.status === 403 || response.status === 429) c.stopped = true;
        return response;
      },
      rwbWindischSources,
      retry,
      now,
    );
  } finally {
    release();
  }
}
export async function loadRwbWindischCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  await verifyRwbWindischSources(request, retry, now);
  return rwbCategories.map((c) => ({ ...c }));
}
export function rwbWindischRequirements() {
  const requirements = rwbRequirements('Windisch');
  requirements[rwbCategory].notes = [
    'Nur nicht dringende Defekte an tatsächlichen öffentlichen Strassenlampen des EW Windisch unter Betriebsführung der RWB. Tatsächliche Lampe und genauer Ort müssen bestätigt sein. Keine privaten Leuchten oder Versorgungsunterbrüche.',
    'Private Anrede, Vor-/Nachname, vollständige Melderadresse mit Hausnummer, PLZ und Ort sowie E-Mail und Telefon erforderlich. Diese bleiben ausserhalb der KI und getrennt vom Lampenstandort.',
    'Tatsächliche Lampenstrasse und nützliche Beschreibung erforderlich; echte Lampennummer freiwillig. Führende Nullen erhalten. Keine Fotos. Datenschutzerklärung bewusst lesen und akzeptieren.',
    'Die interne Weiterleitung ist nicht verifiziert. Allgemeine Partner-/Dienstleister-/Behördenweitergabe und Auslandbedingungen gelten; keine feste Aufbewahrungsdauer oder Veröffentlichung für Lampenmeldungen belegt.',
    'Nur lokale Vorbereitung. Senden, externe Fertigstellung und Statusabfrage sind nicht verfügbar. Bei unklarem Ausgang nicht erneut melden oder den Kanal wechseln.',
  ];
  return requirements;
}
