import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';
import { verifyPublicSourceManifest, type PublicSourcePin } from './public-source-manifest.js';

export const swlLightingFormUrl = 'https://www.swl.ch/de/swl/kundencenter/stoerung-melden';
export const swlLightingPrivacyUrl = 'https://www.swl.ch/de/datenschutzerklaerung';
export const swlLightingPageSha256 =
  '8fed5b7f5ed633ca87a05fd614e491a04dbd1c87a1757bd120f2a3e52cac5139';

const changed = () => new Error('The SWL lighting source has changed. Preparation is paused.');

/** Two independent public captures differed only in this shaped read-time value.
 * Discard it; retain every other byte, including protection and client markup.
 * This inspector does not execute code, obtain challenges or construct a payload.
 */
export function fingerprintSwlLightingPage(html: string): string {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const state = /(<input type="hidden" name="_csrf" value=")([A-Za-z0-9_-]{96})(")/g;
  if (
    [...html.matchAll(state)].length !== 1 ||
    [...html.matchAll(/\bname\s*=\s*["']_csrf["']/gi)].length !== 1
  )
    throw changed();
  return createHash('sha256').update(html.replace(state, '$1<read-time-csrf>$3')).digest('hex');
}

export function inspectSwlLightingPage(html: string): void {
  if (fingerprintSwlLightingPage(html) !== swlLightingPageSha256) throw changed();
}

export const swlCategory = 'Defekte Strassenbeleuchtung';
export const swlCategories = [{ service_code: swlCategory, service_name: swlCategory }];
export const swlReferralUrl = 'https://www.staufen.ch/services/ich-moechte.html/398/collection/16';
export const swlElectricityUrl =
  'https://www.staufen.ch/diverses/versorgungentsorgung/energie.html/33';
export const swlScope =
  'Only nonurgent faults of actual SWL-maintained public streetlights within Staufen (BFS4210), at the confirmed precise lamp point. Confirm actual maintained asset, street, nearest building and genuine lamp number(s), preserving leading zeros. Supply, boundaries and provider offices alone do not prove responsibility. Excludes private fixtures, urgent hazards, outages, other topics and other SWL municipalities. Telephone-only local preparation.';
export const swlSources: readonly PublicSourcePin[] = Object.freeze(
  [
    {
      url: swlReferralUrl,
      sha256: '420a1ac22b094885efafffa09246fad69f32b5e963c32c599424df3e7f92ee7e',
      type: 'html',
      maxBytes: 1_000_000,
    },
    {
      url: swlElectricityUrl,
      sha256: '8f74226dc0501aad8fcba68ee1af56c1a3a97db8cbebbb18c87e619245430a73',
      type: 'html',
      maxBytes: 1_000_000,
    },
    {
      url: swlLightingPrivacyUrl,
      sha256: '6bedd21b689796cae4bb06c25ee64e0a6cfc59f6be1cd10abd8ba8e196f86b45',
      type: 'html',
      maxBytes: 1_000_000,
    },
    {
      url: 'https://www.swl.ch/assets/www/main-7a11f31452736410701376979c163916.js',
      sha256: '7c99370fd08a57de34dbedf013bd6da700bc31ddd917456b395ad47040440a46',
      type: 'javascript',
      maxBytes: 1_000_000,
    },
  ].map((p) => Object.freeze(p)) as PublicSourcePin[],
);
type Context = { tail: Promise<void>; next: number; stopped: boolean };
const contexts = new WeakMap<typeof fetch, Context>();
export function assertSwlSourcesAvailable(request: typeof fetch) {
  if (contexts.get(request)?.stopped) throw changed();
}
async function readForm(request: typeof fetch, retry: (ms: number) => void, now: () => number) {
  const response = await request(swlLightingFormUrl, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Civic source verification (read-only; no client execution)',
    },
  });
  if (
    !response.ok ||
    response.redirected ||
    (response.url && response.url !== swlLightingFormUrl) ||
    !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
  ) {
    const value = response.headers.get('retry-after') ?? '';
    const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
    if (Number.isFinite(delay) && delay > 0) retry(delay);
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
    inspectSwlLightingPage(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export async function verifySwlSources(
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
      assertSwlSourcesAvailable(request);
      const delay = Math.max(0, shared.next - now());
      if (delay) await sleep(delay);
      assertSwlSourcesAvailable(request);
      shared.next = now() + 2000;
      try {
        const response = await request(input, init);
        if (response.status === 403 || response.status === 429) shared.stopped = true;
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
  assertSwlSourcesAvailable(request);
  try {
    await readForm(paced, retry, now);
    await verifyPublicSourceManifest(paced, swlSources, retry, now);
  } catch {
    shared.stopped = true;
    throw changed();
  }
}
export async function loadSwlCategories(
  request: typeof fetch,
  retry: (ms: number) => void,
  now: () => number = Date.now,
) {
  await verifySwlSources(request, retry, now);
  return swlCategories.map((c) => ({ ...c }));
}
export function swlRequirements(): Record<string, Requirements> {
  const field = (code: string, description: string, contact = false, max_length = 100) => ({
    code,
    description,
    required: true,
    contact,
    datatype: 'string',
    max_length,
  });
  return {
    [swlCategory]: {
      scope: swlScope,
      photo_required: false,
      max_photos: 0,
      email_required: false,
      email_supported: false,
      phone_required: true,
      phone_max_length: 100,
      contact_fields: ['phone'],
      description_max_length: 4000,
      location_label_max_length: 250,
      bodies: ['SWL Energie AG – Staufen streetlighting'],
      extra_fields: [
        field('first_name', 'First name', true),
        field('last_name', 'Surname', true),
        {
          code: 'salutation',
          description: 'Salutation',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['Herr', 'Frau', 'Divers'],
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
          description:
            'Confirm SWL privacy policy read; hCaptcha form / reCAPTCHA policy discrepancy understood',
          required: true,
          contact: true,
          datatype: 'string',
          values: ['SWL privacy policy and protection discrepancy read and understood'],
        },
        field('lamp_street', 'Actual lamp street', false, 200),
        field('nearest_house_number', 'Nearest building number'),
        field('lamp_number', 'Actual lamp number(s), keep leading zeros'),
        {
          code: 'public_lamp_confirmed',
          description: 'Confirm actual SWL-maintained public lamp in Staufen',
          required: true,
          datatype: 'string',
          values: ['Actual public lamp in Staufen maintained by SWL confirmed'],
        },
      ],
    },
  };
}
