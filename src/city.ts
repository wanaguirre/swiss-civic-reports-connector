import { z } from 'zod';
import { CITY, coordinates, type Point, type Prepared, type Requirements } from './model.js';
import type { Language } from './language.js';
import { mapUrl, fallbackUrl } from './model.js';
import { zurichReportingGuidance } from './reporting-guidance.js';

const text = z.string();
const categorySchema = z.object({
  service_code: text,
  service_name: text,
  description: text.optional(),
});
const reportSchema = z.object({
  service_request_id: z.union([text, z.number()]).transform(String),
  status: text,
  service_code: text.optional(),
  detail: text.optional(),
  description: text.optional(),
  service_notice: text.optional(),
  requested_datetime: text.optional(),
  updated_datetime: text.optional(),
  agency_sent_datetime: text.optional(),
  interface_used: text.optional(),
  lat: z.coerce.number().finite().optional(),
  long: z.coerce.number().finite().optional(),
});
const categoryRules = z.object({
  category_photo_required: z.union([z.number(), z.boolean()]).optional(),
  phone_required: z.union([z.number(), z.boolean()]).optional(),
  bodies: z.array(text).default([]),
  category_extra_json: z
    .array(
      z.object({
        code: text,
        description: text.default(''),
        required: z.boolean().default(false),
        datatype: text.optional(),
        values: z.unknown().optional(),
      }),
    )
    .default([]),
});

// Sent as the report's source; the public list returns it as interface_used.
export const SUBMISSION_INTERFACE = 'MCP';

/** Zürich municipal adapter. Read failures can be retried by callers; submission outcomes must never be replayed automatically. */
export class CityClient {
  readonly bfsId = 261;
  readonly serviceId = 'zurich-fixmystreet';
  readonly privacy =
    'Description and photos may be published by the city. Email, optional name and phone are sent as contact details; this client requests that your name not be shown. Drafts contain these details locally.';
  readonly submissionMode = 'direct' as const;
  readonly fallbackPrefilled = true;
  readonly trackingSupported = true;
  readonly guidance = zurichReportingGuidance;
  mapUrl = mapUrl;
  fallbackUrl = fallbackUrl;
  reportUrl(id: string) {
    if (!/^\d+$/.test(id)) throw new Error('Report ID must contain digits only.');
    return `${CITY}/report/${id}`;
  }
  readonly municipality = 'Zürich';
  // The name residents see on the city's emails, such as the confirmation link.
  readonly reportingService = 'Züri wie neu';
  // Public pages residents can open when a sent report cannot be followed here.
  readonly reportingUrl = CITY;
  readonly reportFormUrl = new URL('/report/new', CITY).href;
  readonly placeMapUrl = `${CITY}/around?lat={latitude}&lon={longitude}`;
  readonly deliveryLanguage: Language = 'de';
  constructor(private request: typeof fetch = fetch) {}

  private async json(url: URL) {
    const response = await this.request(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'zueri-wie-neu-mcp/0.4.0-rc.45 (independent civic reporting client)',
      },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Read request failed (HTTP ${response.status}). Try again later.`),
        { status: response.status },
      );
    return response.json();
  }
  async categories() {
    const url = new URL('/open311/v2/services.json?jurisdiction_id=zurich', CITY);
    return z.object({ services: z.array(categorySchema) }).parse(await this.json(url)).services;
  }
  async requirements(point: Point): Promise<Record<string, Requirements>> {
    coordinates.parse(point);
    const url = new URL('/report/new/ajax', CITY);
    url.search = new URLSearchParams({
      latitude: String(point.latitude),
      longitude: String(point.longitude),
    }).toString();
    const raw = await this.json(url);
    if (raw && typeof raw.error === 'string')
      throw new Error(`Location rejected by the city: ${raw.error}`);
    const result = z.object({ by_category: z.record(categoryRules) }).parse(raw);
    if (!Object.keys(result.by_category).length)
      throw new Error('No reporting categories for this location.');
    return Object.fromEntries(
      Object.entries(result.by_category).map(([name, rule]) => [
        name,
        {
          photo_required: !!rule.category_photo_required,
          phone_required: !!rule.phone_required,
          bodies: rule.bodies,
          extra_fields: rule.category_extra_json,
        },
      ]),
    );
  }
  async geocode(query: string) {
    const url = new URL('https://api3.geo.admin.ch/rest/services/api/SearchServer');
    url.search = new URLSearchParams({
      searchText: query,
      type: 'locations',
      limit: '5',
    }).toString();
    const parsed = z
      .object({
        results: z.array(
          z.object({
            attrs: z.object({
              label: text,
              lat: z.number().finite(),
              lon: z.number().finite(),
            }),
          }),
        ),
      })
      .parse(await this.json(url));
    return parsed.results.map(({ attrs }) => ({
      label: attrs.label.replace(/<[^>]*>/g, ''),
      latitude: attrs.lat,
      longitude: attrs.lon,
    }));
  }
  async reports(
    options: { id?: string; days?: number; since?: string; limit?: number; category?: string } = {},
  ) {
    if (options.id && !/^\d+$/.test(options.id))
      throw new Error('Report ID must contain digits only.');
    const url = new URL(`/open311/v2/requests${options.id ? `/${options.id}` : ''}.json`, CITY);
    url.searchParams.set('jurisdiction_id', 'zurich');
    if (!options.id) {
      url.searchParams.set('max_requests', String(options.limit ?? 500));
      url.searchParams.set(
        'start_date',
        options.since ?? new Date(Date.now() - (options.days ?? 30) * 86400_000).toISOString(),
      );
      if (options.category) url.searchParams.set('service_code', options.category);
    }
    const parsed = z
      .object({ service_requests: z.array(reportSchema) })
      .parse(await this.json(url));
    return parsed.service_requests.map((r) => ({
      ...r,
      url: `${CITY}/report/${r.service_request_id}`,
      status_meaning:
        r.status === 'closed'
          ? 'Answered/closed in the city system; this does not establish that the issue is repaired.'
          : r.status,
    }));
  }
  // One published report, or undefined while it is not (yet) public.
  async report(id: string) {
    try {
      return (await this.reports({ id }))[0];
    } catch (error) {
      if ((error as { status?: number }).status === 404) return undefined;
      throw error;
    }
  }
  async nearby(point: Point, radius = 200, days = 30) {
    const reports = await this.reports({ days, limit: 1000 });
    return {
      window_days: days,
      reports_scanned: reports.length,
      potentially_truncated: reports.length >= 1000,
      coverage:
        'Only recent publicly published reports. Pending, private, older or truncated reports may be missing; no match does not prove no duplicate.',
      matches: reports
        .filter((r) => r.lat !== undefined && r.long !== undefined)
        .map((r) => ({
          ...r,
          distance_m: Math.round(distance(point, { latitude: r.lat!, longitude: r.long! })),
        }))
        .filter((r) => r.distance_m <= radius)
        .sort((a, b) => a.distance_m - b.distance_m)
        .slice(0, 30),
    };
  }
  // This legacy app route is evidenced by FixMyStreet's public source, not a supported public write API.
  // Never retry this request: a timeout can occur after a report has been saved.
  async submit(
    preview: Prepared,
  ): Promise<{ state: 'accepted' | 'confirmation_pending' | 'rejected'; report_id?: string }> {
    const { input } = preview;
    const form = new FormData();
    const fields = {
      service: SUBMISSION_INTERFACE,
      title: input.description.slice(0, 100),
      detail: input.description,
      category: input.category,
      lat: String(input.latitude),
      lon: String(input.longitude),
      pc: input.location_label,
      used_map: '1',
      may_show_name: '0',
      name: input.name ?? '',
      email: input.email,
      phone: input.phone ?? '',
      submit_register: '1',
      ...input.extra_fields,
    };
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    for (const [index, photo] of preview.photos.entries()) {
      form.set(
        `photo${index + 1}`,
        new Blob([new Uint8Array(Buffer.from(photo.jpeg, 'base64'))], { type: 'image/jpeg' }),
        `report-${index + 1}.jpg`,
      );
    }
    const response = await this.request(new URL('/report/new/mobile', CITY), {
      method: 'POST',
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
      headers: { Accept: 'application/json', 'User-Agent': 'zueri-wie-neu-mcp/0.4.0-rc.45' },
    });
    if (!response.ok) throw new Error('Submission result uncertain. Do not retry.');
    const body = await response.json();
    if (body?.success === 1 || body?.success === true) {
      const id = String(body.report ?? '');
      return /^\d+$/.test(id)
        ? { state: 'accepted', report_id: id }
        : { state: 'confirmation_pending' };
    }
    if (
      body?.errors &&
      (typeof body.errors === 'string' ||
        (typeof body.errors === 'object' && Object.keys(body.errors).length))
    ) {
      return { state: 'rejected' };
    }
    throw new Error('Unrecognized submission response. Do not retry.');
  }
}

export function distance(a: Point, b: Point): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
