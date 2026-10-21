import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

export const auwFormUrl = 'https://www.elektra-auw.ch/strassenlampe/';
export const auwPrivacyUrl =
  'https://www.elektra-auw.ch/wp-content/uploads/2024/01/Datenschutzerkla%CC%88rung-EGA-Auw-aktuell.pdf';
export const auwReferralUrl = 'https://www.auw.ch/';
export const auwIdentityUrl = 'https://www.elektra-auw.ch/kontakt/';
export const auwCategory = 'Defekte Strassenbeleuchtung';
export const auwScope =
  'Only nonurgent defects of actual Elektra Auw-maintained public street or pavement lamps within Auw (BFS4223), at the confirmed precise lamp point. Confirm the maintained public asset, actual fault location, defect type and genuine lamp number, preserving leading zeros. Supply, boundaries and provider office alone do not prove responsibility. Excludes private fixtures, outages, urgent danger and neighbouring municipalities. Local preparation collects private combined reporter name, address/locality and telephone; no email or photo attachments.';
// Two independent complete form captures were byte-identical. No state values
// are masked, retained or reused; all sources, including inert client, are pinned.
export const auwSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: 'https://www.elektra-auw.ch/strassenlampe/',
      sha256: '90681cde403a846f1a14bede440e930b26d4d17aef8e5e59f2e2fe4233ef651c',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.auw.ch/',
      sha256: 'ddcfd70c1befb1d3c9b2e45e69c36c2bf5720836b8466c8992fe389ae1e88d89',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.elektra-auw.ch/kontakt/',
      sha256: '062580cbe573d2ce36ef83b8699322f941705b74bd0898a1d30fb6d567afcb70',
      type: 'html',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.elektra-auw.ch/wp-content/uploads/2024/01/Datenschutzerkla%CC%88rung-EGA-Auw-aktuell.pdf',
      sha256: 'd90b0b00491dd3ee7ab2ba63fb584bb34026f092d4effc69340d68bcad4bbcbe',
      type: 'pdf',
      maxBytes: 1000000,
    },
    {
      url: 'https://www.elektra-auw.ch/wp-content/plugins/ninja-forms/assets/js/min/front-end.js?ver=3.14.8',
      sha256: '0c88808c4b985b51cfc08bd844e922ecbac7a85daa92cc2c1d2a2f12dcbcccbe',
      type: 'javascript',
      maxBytes: 1000000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
const paused = () =>
  new Error('The Auw Elektra Auw source has changed or stopped. Preparation is paused.');
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertAuwSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw paused();
}
export async function verifyAuwSources(
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
  const paced: typeof fetch = (input, init) => {
    const task = shared.tail.then(async () => {
      assertAuwSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertAuwSourcesAvailable(request);
      shared.next = now() + 2_000;
      try {
        const response = await request(input, init);
        if (response.status === 403 || response.status === 429) shared.stopped = true;
        return response;
      } catch {
        shared.stopped = true;
        throw paused();
      }
    });
    shared.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
  assertAuwSourcesAvailable(request);
  try {
    await verifyPublicSourceManifest(paced, auwSources, retry, now);
  } catch {
    shared.stopped = true;
    throw paused();
  }
}
export const auwCategories = [{ service_code: auwCategory, service_name: auwCategory }];
export async function loadAuwCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifyAuwSources(request, retry, now);
  return auwCategories.map((c) => ({ ...c }));
}
export function auwRequirements(): Record<string, Requirements> {
  const field = (code: string, description: string, contact = false, max_length = 100) => ({
    code,
    description,
    required: true,
    contact,
    datatype: 'string',
    max_length,
  });
  return {
    [auwCategory]: {
      scope: auwScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      phone_max_length: 100,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Elektra Genossenschaft Auw – public streetlighting'],
      extra_fields: [
        field('reporter_name', 'Full reporter name', true),
        field('reporter_address', 'Private reporter street and locality', true, 250),
        field('lamp_location', 'Actual fault location / street', false, 250),
        field('defect_type', 'Type of lamp defect', false, 200),
        field('lamp_number', 'Actual lamp number (keep leading zeros)'),
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm Elektra Auw privacy policy read and understood',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Elektra Auw privacy policy read and understood'],
        },
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm actual Elektra Auw-maintained public lamp in Auw',
          required: true,
          datatype: 'string',
          values: ['Actual public lamp in Auw maintained by Elektra Auw confirmed'],
        },
      ],
      notes: [
        'Nur echte nicht dringende Defekte an bestätigten öffentlichen Strassen- oder Trottoirlampen im Unterhalt der Elektra Auw innerhalb Auw BFS4223. Genauen Lampenpunkt und echte Nummer bestätigen; führende Nullen erhalten. Keine privaten Anlagen, Stromausfälle, akute Gefahr oder anderen Gemeinden.',
        'Natives Formular8 verlangt Defektort, Defektart, Lampennummer, Absendername, Strasse/Ort und Telefon. Interne Typnamen firstname/address/zip/city ändern die tatsächliche Bedeutung nicht: Defektart ist kein Vorname, Lampennummer keine Privatadresse, Absendername keine numerische Postleitzahl. Private Angaben bleiben ausserhalb der KI. Lokale Vorbereitung ohne freiwillige E-Mail und Fotos.',
        'Textgrenzen, nützliche Beschreibung, bestätigter öffentlicher Unterhalt und Datenschutz-Lesebestätigung sind lokale Regeln; kein natives Zustimmungsfeld erfinden. Richtlinie erlaubt Dienstleister, Geschäftspartner, Behörden und gesetzliche Weitergabe sowie gewisse Auslandempfänger. Keine feste Lampen-Löschfrist oder absolute Nichtweitergabe zusagen; Portal-/Bewerberfristen nicht übernehmen.',
        'Nur lokale Vorbereitung. Keine NinjaForms-Ausführung, Nonce-/Zustandsnutzung, Honeypot-/Challenge-Aktion, Nutzlast, Übermittlung oder externe Abschluss-/Trackingfunktion. Tatsächlicher Eingang und spätere Annahme ungeprüft. Bei unklarem Ausgang weder erneut melden noch Kanal wechseln.',
      ],
    },
  };
}
