import { createHash } from 'node:crypto';
import type { Requirements } from './model.js';
export const staefaFormUrl = 'https://kundenportal.gws.ch/forms/deffective-street-lamp';
export const staefaLayoutUrl = 'https://api.energyboard.ch/api/Tenant/getLayout';
export const staefaTranslationsUrl = 'https://api.energyboard.ch/api/Translation/GWS/deCH';
export const staefaScope =
  'Non-emergency public-lighting defects within Stäfa, including Uerikon. Gemeindewerke Stäfa plans and operates this lighting on behalf of the municipality. Not private lights, electricity outages or other municipal defects.';
export const staefaCategories = [
  'Lampe brennt nicht',
  'Lampe brennt unregelmässig',
  'Leuchte zerstört',
  'Andere Defekte',
] as const;
const changed = () =>
  new Error('The Stäfa public lighting form is unavailable or has changed. Preparation is paused.');
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value !== null && typeof value === 'object'
      ? `{${Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
          .join(',')}}`
      : JSON.stringify(value);
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw changed();
  return value as Record<string, unknown>;
};
/** Hash only the complete selected public form, never unrelated tenant content. Exact schema changes pause preparation. */
export function inspectStaefaLayout(layout: unknown) {
  try {
    const forms = record(record(layout).dynFormFields).counter;
    if (!Array.isArray(forms)) throw changed();
    const selected = forms.filter((f) => record(f).formId === 'deffective-street-lamp');
    if (
      selected.length !== 1 ||
      hash(selected[0]) !== '8afe7c2dc48d96136123bdd36428d2519a4806581acc7414d6983149c184ed4e'
    )
      throw changed();
  } catch {
    throw changed();
  }
}
export function inspectStaefaTranslations(input: unknown) {
  try {
    const data = record(input),
      common = record(data.common),
      forms = record(data.forms),
      formCommon = record(forms.common);
    const selected = {
      common: Object.fromEntries(
        [
          'street',
          'streetNbr',
          'lampNr',
          'reason',
          'deffectiveReason1',
          'deffectiveReason2',
          'deffectiveReason3',
          'deffectiveReason4',
          'lastname',
          'firstname',
          'communication1',
          'comments',
          'salutation',
        ].map((k) => [k, common[k]]),
      ),
      forms: {
        deffectiveStreetLamp: forms.deffectiveStreetLamp,
        common: Object.fromEntries(
          ['deffectiveStreetlamp', 'personalInformation'].map((k) => [k, formCommon[k]]),
        ),
      },
    };
    if (hash(selected) !== 'c38df0c1f3d6c1a3864fe4c155740931b9e99e9071496591cebfa9b366b234be')
      throw changed();
    return staefaCategories.map((name, i) => ({
      service_code: `deffectiveReason${i + 1}`,
      service_name: name,
    }));
  } catch {
    throw changed();
  }
}
async function publicJson(url: string, request: typeof fetch, retry: (delay: number) => void) {
  const response = await request(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/json',
      tenant: 'GWS',
      backoffice: 'false',
      'User-Agent': 'Civic public lighting preparation (read-only)',
    },
  });
  if (
    !response.ok ||
    !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
  ) {
    const value = response.headers.get('retry-after') ?? '',
      delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
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
      if (size > 1_000_000) throw changed();
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export async function loadStaefaCategories(request: typeof fetch, retry: (delay: number) => void) {
  inspectStaefaLayout(await publicJson(staefaLayoutUrl, request, retry));
  return inspectStaefaTranslations(await publicJson(staefaTranslationsUrl, request, retry));
}
export function staefaRequirements(): Record<string, Requirements> {
  return Object.fromEntries(
    staefaCategories.map((category) => [
      category,
      {
        scope: staefaScope,
        photo_required: false,
        max_photos: 0,
        email_required: false,
        email_supported: false,
        phone_required: true,
        contact_fields: ['phone'],
        description_max_length: 5000,
        location_label_max_length: 250,
        bodies: ['Stäfa'],
        extra_fields: [
          {
            code: 'first_name',
            description: 'First name',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'last_name',
            description: 'Last name',
            required: true,
            contact: true,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lighting_street',
            description: 'Street of the defective light',
            required: true,
            datatype: 'string',
            max_length: 200,
          },
          {
            code: 'lighting_house_number',
            description: 'Nearby house number (optional)',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
          {
            code: 'lamp_number',
            description: 'Actual pole number, if known; do not invent one',
            required: false,
            datatype: 'string',
            max_length: 100,
          },
        ],
        notes: [
          'Nur öffentliche Beleuchtung auf dem Gemeindegebiet Stäfa, einschliesslich Uerikon; GWS betreibt sie im Auftrag der Gemeinde.',
          'Vorname, Nachname und Telefon sind erforderlich. Das öffentliche Formular hat kein E-Mail-Feld.',
          'Civic verlangt eine bestätigte, aussagekräftige Ortsangabe mit Strasse und Beschreibung. Hausnummer und echte Kandelabernummer sind freiwillig.',
          'Reine Textmeldung: Quellfotos können beim Entwurf helfen, müssen aber ausdrücklich von der Übermittlung ausgeschlossen werden.',
          'Vorbereitung nur in Civic. Senden, Empfangsnachweis und Statusabfrage sind nicht verifiziert. Bei unklarem Ausgang niemals automatisch erneut senden.',
        ],
      } satisfies Requirements,
    ]),
  );
}
