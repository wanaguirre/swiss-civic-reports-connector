import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Requirements } from './model.js';

export const lungernFormUrl = 'https://www.maengelmelder.eu/de/maengelmelder/index.php?c=lungern';
export const lungernWidgetUrl =
  'https://www.maengelmelder.eu/de-wGlobal/wGlobal/scripts/php/maengelmelder/widget/form.js';
export const lungernConfigUrl =
  'https://www.maengelmelder.eu/de-wGlobal/wGlobal/scripts/php/maengelmelder/api.php';
export const lungernReferralUrl = 'https://www.lungern.ch/aemter/6448';
export const lungernPrivacyUrl = 'https://www.maengelmelder.eu/de/datenschutz/index.php?c=lungern';
export const lungernScope =
  'Non-emergency public-space defects in Lungern (BFS1405), through its explicitly referred Mängelmelder. Only the reviewed defect classes; Sonstiges remains limited to public-space maintenance. Not emergencies, private-property disputes or administrative requests. The provider polygon is empty: exact BFS and resident confirmation are required and do not independently prove responsibility for an individual asset.';
export const lungernCategories = [
  'Abfall im Wald wild deponiert',
  'Abfallkübel defekt / überfüllt',
  'Robidogkasten defekt / überfüllt',
  'Schachtdeckel defekt oder offen',
  'Signalisation (Strassenschilder) umgefallen / defekt',
  'Sitzbank beschädigt',
  'Spielplatz (öffentlich) defekt / verunreinigt',
  'Strassenbeleuchtung defekt',
  'Vandalismus an öffentlichen Gebäuden / Einrichtungen',
  'WC Anlagen (öffentlich) defekt',
  'Sonstiges',
] as const;
const readActions = [
  'getAllDataFromConfigAsArray',
  'reportTypes',
  'geoLocation',
  'getTexts',
] as const;
const changed = () => new Error('The Lungern defect portal has changed. Preparation is paused.');
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v !== null && typeof v === 'object'
      ? `{${Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
          .join(',')}}`
      : JSON.stringify(v);
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');

/** Inspect the municipal tenant's published embedding without executing it.
 * Public client keys may rotate; tenant identity, resource URL and all returned settings are pinned. */
export function inspectLungernPage(html: string): string {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const scripts = all(parse(html)).filter((n) => 'tagName' in n && n.tagName === 'script');
    const resources = scripts.filter(
      (n) =>
        'attrs' in n &&
        n.attrs.some(
          (a) => a.name === 'src' && new URL(a.value, lungernFormUrl).href === lungernWidgetUrl,
        ),
    );
    const calls = scripts
      .map((n) =>
        'childNodes' in n ? n.childNodes.map((c) => ('value' in c ? c.value : '')).join('') : '',
      )
      .filter((s) => s.includes('renderMaengelmelderForm'));
    if (resources.length !== 1 || calls.length !== 1) throw changed();
    const match = calls[0]
      .trim()
      .match(
        /^renderMaengelmelderForm\("maengelmelderWrapper", "lungern", "([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})", "[a-f0-9]{40}"\);?$/,
      );
    if (!match) throw changed();
    return match[1];
  } catch {
    throw changed();
  }
}

/** Complete widget source + complete selected tenant settings, categories, centre and labels.
 * Status id=0 in this source is not a case receipt; no write transport is implemented. */
export function inspectLungernContract(widgetSha256: string, data: unknown[]) {
  if (
    widgetSha256 !== 'bafa7ccd1cd509c249a947b3580d37179e8c0311c8e036ab48b1f9a79c11c024' ||
    hash(data) !== '6d15e662037781593a1a1aef1c6d208d43082ffd3331d2ac2a3aff424dc52b57'
  )
    throw changed();
  return lungernCategories.map((name) => ({ service_code: name, service_name: name }));
}

async function read(
  request: typeof fetch,
  url: string,
  init: RequestInit,
  retry: (delay: number) => void,
  now: () => number,
  type: RegExp,
  limit: number,
) {
  const response = await request(url, {
    ...init,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !type.test(response.headers.get('content-type') ?? '') || !response.body) {
    const value = response.headers.get('retry-after') ?? '',
      delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
    if (Number.isFinite(delay) && delay > 0) retry(delay);
    await response.body?.cancel();
    throw changed();
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw changed();
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Only these four explicit configuration actions are sent. Never call the shared
 * endpoint without an action: its default operation is report creation. No report
 * fields, nearby validation, photos, consent or resident data enter these requests. */
export async function loadLungernCategories(
  request: typeof fetch,
  retry: (delay: number) => void,
  now: () => number = Date.now,
) {
  const headers = { 'User-Agent': 'Civic municipal preparation (configuration reads only)' };
  const html = await read(
    request,
    lungernFormUrl,
    { method: 'GET', headers },
    retry,
    now,
    /^text\/html(?:;|$)/i,
    1_000_000,
  );
  const key = inspectLungernPage(html);
  const widget = await read(
    request,
    lungernWidgetUrl,
    { method: 'GET', headers },
    retry,
    now,
    /^(?:application|text)\/javascript(?:;|$)/i,
    100_000,
  );
  // Reject changed client behavior before making any configuration request.
  if (
    createHash('sha256').update(widget).digest('hex') !==
    'bafa7ccd1cd509c249a947b3580d37179e8c0311c8e036ab48b1f9a79c11c024'
  )
    throw changed();
  const data: unknown[] = [];
  for (const action of readActions) {
    data.push(
      JSON.parse(
        await read(
          request,
          lungernConfigUrl,
          {
            method: 'POST',
            headers: {
              ...headers,
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ customer: 'lungern', action }),
          },
          retry,
          now,
          /^(?:application\/json|text\/html)(?:;|$)/i,
          100_000,
        ),
      ),
    );
  }
  return inspectLungernContract(createHash('sha256').update(widget).digest('hex'), data);
}

export function lungernRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    lungernCategories.map((category) => [
      category,
      {
        scope: lungernScope,
        photo_required: false,
        max_photos: 1,
        max_photo_bytes: 5_000_000,
        email_required: true,
        phone_required: false,
        contact_fields: [],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Lungern'],
        extra_fields: [
          ...[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
          ].map(([code, description]) => ({
            code,
            description,
            required: true,
            datatype: 'string',
            contact: true,
            max_length: 250,
          })),
          {
            code: 'location_details',
            description: 'Describe the affected place precisely; keep personal contact data out',
            required: true,
            datatype: 'string',
            max_length: 500,
            translate: true,
          },
          {
            code: 'public_space_confirmed',
            description: 'Confirm a non-emergency public-space issue in Lungern',
            required: true,
            datatype: 'string',
            values: ['Public-space issue in Lungern confirmed'],
          },
          {
            code: 'data_policy_consent',
            description:
              'Read the provider privacy notice and choose your response; stored locally, never submitted by Civic',
            required: true,
            datatype: 'string',
            values: ['I have read and accept the provider privacy notice'],
          },
        ],
        notes: [
          'Vorname, Nachname, E-Mail, Beschreibung und detaillierte Ortsangabe sind erforderlich. Kein Telefon und keine Kontaktadresse; Kontaktdaten gehören nicht in die öffentliche Beschreibung.',
          'Ein optionales Foto. Civic begrenzt die Vorbereitung auf ein normalisiertes JPEG bis 5 MB; diese sowie die Zeichenlimits sind lokale Grenzen, keine veröffentlichten Anbieterlimits.',
          'Nur bestätigte, nicht dringende Anliegen im öffentlichen Raum in Lungern. Auch Sonstiges bleibt auf Unterhalt im öffentlichen Raum beschränkt. Der Anbieter liefert kein Polygon; Gemeindegrenze und Verantwortung müssen unabhängig geprüft werden.',
          'Die offizielle Datenschutzerklärung muss bewusst gelesen und akzeptiert werden. Civic speichert diese Auswahl lokal und sendet sie nicht an den Anbieter.',
          'Nur Vorbereitung. Senden, externe Fertigstellung und Tracking sind gesperrt. Der Erfolgscode id=0 ist keine Fallnummer. Bei unklarem Ausgang niemals automatisch erneut senden oder den Kanal wechseln.',
        ],
      },
    ]),
  );
}
