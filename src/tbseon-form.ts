import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

export const tbseonFormUrl = 'https://tbseon.ch/kundencenter/kundenformulare/';
export const tbseonPrivacyUrl = 'https://tbseon.ch/datenschutz-ihre-daten-sind-bei-uns-sicher/';
export const tbseonReferralUrl =
  'https://www.egliswil.ch/verwaltung/online-schalter.html/42/product/96';
export const tbseonIdentityUrl = 'https://tbseon.ch/die-tbs/unternehmen/';
export const tbseonCategory = 'Defekte Strassenbeleuchtung';
export const tbseonScope =
  'Only nonurgent faults of actual TB Seon-maintained public streetlights within Egliswil (BFS4195), at the confirmed exact lamp point. Confirm the actual EWG identification plate and its second and third lines. Boundaries and electricity supply alone do not prove maintenance. Excludes Seon, Schafisheim, Teufenthal, private fixtures, supply outages and urgent danger. Local preparation supports only the native Telefon contact branch.';
// Two independent successful captures had identical complete bytes. No state is
// masked, calculated, retained or reused. Any source drift stops preparation.
export const tbseonSources: readonly PublicSourcePin[] = Object.freeze(
  (
    [
      {
        url: tbseonFormUrl,
        sha256: '896957ab8c5da78aab8221c8a711646ded351a306bd550977e76a60fde8e4dbe',
        type: 'html',
        maxBytes: 1_000_000,
      },
      {
        url: tbseonReferralUrl,
        sha256: '3dccb88ec75423491081b6519bfa82e1ed5f7b56688c332b476f7c2c4145c7c1',
        type: 'html',
        maxBytes: 1_000_000,
      },
      {
        url: tbseonPrivacyUrl,
        sha256: 'c6899fdb7757d81f7144e08c26601e12448efd3caafffd4c2f595d1f1d0fa910',
        type: 'html',
        maxBytes: 1_000_000,
      },
      {
        url: tbseonIdentityUrl,
        sha256: '2af6ba52b072a4e882388726700129891f40f02b856fbb4c4e733fae85602e8f',
        type: 'html',
        maxBytes: 1_000_000,
      },
      {
        url: 'https://tbseon.ch/wp-content/uploads/fusion-scripts/fd5a2bbed7402230cea563e7bece6827.min.js?ver=3.16.1',
        sha256: '27e01a8a60a26a9bb27142e60931722dad3ca93c85b862fe1f8d7d233d39b66e',
        type: 'javascript',
        maxBytes: 1_000_000,
      },
    ] as const
  ).map((p) => Object.freeze(p)),
);
const paused = () =>
  new Error('The Egliswil TB Seon source has changed or stopped. Preparation is paused.');
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertTbseonSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw paused();
}
export async function verifyTbseonSources(
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
      assertTbseonSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertTbseonSourcesAvailable(request);
      shared.next = now() + 10_000;
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
  assertTbseonSourcesAvailable(request);
  try {
    await verifyPublicSourceManifest(paced, tbseonSources, retry, now);
  } catch {
    shared.stopped = true;
    throw paused();
  }
}
export const tbseonCategories = [{ service_code: tbseonCategory, service_name: tbseonCategory }];
export async function loadTbseonCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifyTbseonSources(request, retry, now);
  return tbseonCategories.map((c) => ({ ...c }));
}
export function tbseonRequirements(): Record<string, Requirements> {
  const privateField = (code: string, description: string, max_length = 100) => ({
    code,
    description,
    max_length,
    required: true,
    contact: true,
    datatype: 'string',
  });
  return {
    [tbseonCategory]: {
      scope: tbseonScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      phone_max_length: 100,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['Technische Betriebe Seon AG – Egliswil Strassenbeleuchtung'],
      extra_fields: [
        privateField('first_name', 'First name'),
        privateField('last_name', 'Surname'),
        privateField('reporter_street', 'Private reporter street/address', 200),
        privateField('contact_postcode', 'Private reporter postcode', 50),
        privateField('contact_locality', 'Private reporter locality'),
        {
          code: 'salutation',
          description: 'Salutation (optional)',
          required: false,
          contact: true,
          datatype: 'string',
          values: ['Herr', 'Frau'],
        },
        {
          code: 'contact_preference',
          description: 'Contact by telephone',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Telefon'],
        },
        {
          code: 'privacy_acknowledgement',
          description: 'Confirm you have read and understood TB Seon’s privacy policy',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['TB Seon privacy policy read and understood'],
        },
        {
          code: 'lamp_plate_line_2',
          description: 'Actual EWG plate, second line (keep leading zeros)',
          required: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'lamp_plate_line_3',
          description: 'Actual EWG plate, third line (keep leading zeros)',
          required: true,
          datatype: 'string',
          max_length: 100,
        },
        {
          code: 'public_lamp_confirmed',
          description:
            'Confirm the actual maintained public lamp and genuine EWG plate within Egliswil',
          required: true,
          datatype: 'string',
          values: ['Actual EWG public lamp in Egliswil maintained by TB Seon confirmed'],
        },
      ],
      notes: [
        'Nur echte, nicht dringende Defekte an bestätigten öffentlichen Lampen im Unterhalt der TB Seon innerhalb Egliswil. Kein anderer Versorgungsort, keine Privatlampe, kein Stromausfall und keine akute Gefahr. Genauer Lampenpunkt und echte EWG-Tafel bestätigen; zweite/dritte Zeile nie erfinden, führende Nullen erhalten.',
        'Diese lokale Vorbereitung unterstützt ausdrücklich nur Telefon. Die nativen Optionen E-Mail und gar nicht bleiben hier ausgeschlossen. Private Vor-/Nachnamen, Adresse, PLZ/Ort und Telefon erforderlich; Anrede freiwillig. Keine Kundennummer/Firma, Umzugs- oder Zählerdaten und keine Konto-E-Mail übernehmen. Private Angaben bleiben ausserhalb der KI.',
        'Die beiden Tafelzeilen sind nativ mit Stern beschriftet, haben aber keine required/aria-required-Attribute. Ihre Pflicht sowie nützliche Beschreibung und Textgrenzen sind lokale konservative Regeln. Kein Foto anhängen; kein natives Uploadfeld festgestellt.',
        'Offizielle Datenschutzerklärung lesen und Verständnis lokal bestätigen; kein natives Zustimmungsfeld erfinden. Formular verspricht Vertraulichkeit, die Richtlinie erlaubt Auftragsdienstleister und gesetzliche/gerichtliche Weitergabe. Keine absolute Nichtweitergabe, feste Lampen-Löschfrist oder Veröffentlichungszusage. Notwendige Geschäfts-/Auftragsdaten sind von Löschung ausgenommen. Native reCAPTCHA-Verarbeitung und spätere Annahme bleiben ungeprüft.',
        'Diese Vorbereitung bleibt in Civic. Es wird nichts gesendet und keine externe Meldung geöffnet. Der tatsächliche Eingang einer späteren Meldung ist nicht geprüft. Bei unklarem Ausgang weder erneut melden noch den Kanal wechseln.',
      ],
    },
  };
}
