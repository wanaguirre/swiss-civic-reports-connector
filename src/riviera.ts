import { createHash } from 'node:crypto';
import { parse, parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import proj4 from 'proj4';
import { z } from 'zod';
import { CityClient } from './city.js';
import {
  coordinates,
  reportInput,
  type Point,
  type Prepared,
  type ReportInput,
  type Requirements,
} from './model.js';
import { destinationFor, sameDestination, type ReportingAdapter } from './municipalities.js';
import { SwissPlaces } from './places.js';

const ORIGIN = 'https://www.signalements-riviera.ch';
export const rivieraMunicipalities = Object.freeze({
  blonaySaintLegier: Object.freeze({ bfsId: 5892, municipality: 'Blonay - Saint-Légier' }),
  chardonne: Object.freeze({ bfsId: 5882, municipality: 'Chardonne' }),
  corseaux: Object.freeze({ bfsId: 5883, municipality: 'Corseaux' }),
  corsierSurVevey: Object.freeze({ bfsId: 5884, municipality: 'Corsier-sur-Vevey' }),
  jongny: Object.freeze({ bfsId: 5885, municipality: 'Jongny' }),
  laTourDePeilz: Object.freeze({ bfsId: 5889, municipality: 'La Tour-de-Peilz' }),
  montreux: Object.freeze({ bfsId: 5886, municipality: 'Montreux' }),
  rennaz: Object.freeze({ bfsId: 5412, municipality: 'Rennaz' }),
  vevey: Object.freeze({ bfsId: 5890, municipality: 'Vevey' }),
  veytaux: Object.freeze({ bfsId: 5891, municipality: 'Veytaux' }),
});
export type RivieraMunicipality = keyof typeof rivieraMunicipalities;
const themes: Readonly<Record<number, string>> = Object.freeze({
  1: 'Places de jeux / bancs publics',
  2: 'Eclairage public',
  3: "Fuites canalisation d'eau",
  4: 'Signalisation routière',
  5: 'Sécurité sur les chantiers',
  8: 'Chenilles processionnaires du pin',
  18: 'Vélos-épaves',
});
// Same projection and integer coordinates as the operator's public frontend.
// https://www.signalements-riviera.ch/common/js/proj4js/epsg2056.js (2026-10-15)
const LV95 =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs';
export function rivieraCoordinates(point: Point) {
  const { longitude, latitude } = coordinates.parse(point);
  const [east, north] = proj4('EPSG:4326', LV95, [longitude, latitude]);
  if (
    ![east, north].every(Number.isFinite) ||
    east < 2480000 ||
    east > 2840000 ||
    north < 1070000 ||
    north > 1300000
  )
    throw new Error('Location is outside the Swiss reporting area.');
  return { east: Math.trunc(east), north: Math.trunc(north) };
}
const changed = () =>
  new Error(
    'Signalements-Riviera is unavailable or its reporting contract has changed. Preparation is paused.',
  );
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: Element, key: string) => n.attrs.find((a) => a.name === key)?.value;
const plain = (n: Node): string =>
  'tagName' in n && ['script', 'style', 'iframe'].includes(n.tagName)
    ? ''
    : 'value' in n
      ? n.value
      : 'childNodes' in n
        ? n.childNodes.map(plain).join(' ')
        : '';
const plainHtml = (value: string) => {
  const text = plain(parseFragment(value)).replace(/\s+/g, ' ').trim();
  if (text.length > 2000) throw changed();
  return text;
};

/** Validate the observed anonymous form without retaining HTML or session data. */
export function inspectRivieraForm(html: string): void {
  if (
    Buffer.byteLength(html) > 1_000_000 ||
    /captcha|turnstile|cffp_|type\s*=\s*["']password/i.test(html)
  )
    throw changed();
  const forms = all(parse(html)).filter((n) => n.tagName === 'form');
  if (forms.length !== 1) throw changed();
  const form = forms[0];
  if (
    new URL(attr(form, 'action') ?? '', ORIGIN).href !== `${ORIGIN}/add_signalement.php` ||
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data'
  )
    throw changed();
  const controls = all(form).filter((n) =>
    ['input', 'select', 'textarea', 'button', 'iframe'].includes(n.tagName),
  );
  const expected = [
    ['east', 'text'],
    ['north', 'text'],
    ['zone', 'text'],
    ['themes-list', 'select'],
    ['description', 'textarea'],
    ['photo', 'file'],
    ['email', 'email'],
    [undefined, 'button'],
  ];
  if (controls.length !== expected.length) throw changed();
  for (const [name, type] of expected) {
    const found = controls.filter((n) => attr(n, 'name') === name);
    if (found.length !== 1) throw changed();
    const n = found[0];
    if (
      (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
      ['form', 'formaction', 'multiple'].some((k) => attr(n, k) !== undefined)
    )
      throw changed();
    if (['themes-list', 'description'].includes(name ?? '') !== (attr(n, 'required') !== undefined))
      throw changed();
    if (['zone', 'themes-list', undefined].includes(name) !== (attr(n, 'disabled') !== undefined))
      throw changed();
    if (['east', 'north'].includes(name ?? '') !== (attr(n, 'readonly') !== undefined))
      throw changed();
    if (name === 'description' && attr(n, 'maxlength') !== '1000') throw changed();
    if (name === 'photo' && attr(n, 'accept') !== 'image/*,application/pdf') throw changed();
    if (name === undefined && attr(n, 'type') !== 'submit') throw changed();
  }
}

// One bounded cache and cooldown per fetch transport, shared by all ten profiles.
// Only public form/category/parcel metadata is read. No automatic retry occurs.
class RivieraReads {
  private cache = new Map<string, { expires: number; body: string }>();
  private pending = new Map<string, Promise<string>>();
  private retryAt = 0;
  constructor(
    private request: typeof fetch,
    private now: () => number,
  ) {}
  async read(url: URL, html = false, fresh = false): Promise<string> {
    if (this.now() < this.retryAt)
      throw new Error('Signalements-Riviera reads are paused. Try preparing later.');
    const key = url.href,
      cached = this.cache.get(key);
    if (!fresh && cached && cached.expires > this.now()) return cached.body;
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= 16)
      throw new Error('Signalements-Riviera has enough requests in progress. Try preparing later.');
    const promise = (async () => {
      try {
        const response = await this.request(url, {
          method: 'GET',
          redirect: 'error',
          signal: AbortSignal.timeout(20_000),
          headers: {
            Accept: html ? 'text/html' : 'application/json',
            'User-Agent': 'Civic Riviera preparation (read-only)',
          },
        });
        if (!response.ok) {
          const retry = response.headers.get('retry-after') ?? '';
          const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - this.now();
          if (Number.isFinite(delay) && delay > 0)
            this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
          await response.body?.cancel();
          throw changed();
        }
        // The deployed extra-attributes endpoint currently returns an empty body.
        // Some JSON routes advertise text/html; validate their bounded body below.
        if (
          !response.body ||
          (html && !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? ''))
        ) {
          await response.body?.cancel();
          throw changed();
        }
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > (html ? 1_000_000 : 100_000)) throw changed();
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const body = Buffer.concat(chunks).toString('utf8');
        if (html) inspectRivieraForm(body);
        else if (body.trim()) JSON.parse(body);
        else if (url.searchParams.get('ws') !== 'get_extra_attributes_at_location') throw changed();
        this.cache.delete(key);
        this.cache.set(key, { expires: this.now() + 300_000, body });
        while (this.cache.size > 128) this.cache.delete(this.cache.keys().next().value!);
        return body;
      } catch {
        this.cache.clear();
        this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
        throw changed();
      }
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
const sharedReads = new WeakMap<typeof fetch, RivieraReads>();
const categoryCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z
    .array(
      z.object({
        properties: z.object({
          gid_zone_thematique: z.number().int().positive().safe(),
          gid_thematique: z.number().int().positive().safe(),
          zone: z.string().min(1).max(100),
          thematique: z.string().min(1).max(100),
          info: z.string().max(8000).nullish(),
        }),
      }),
    )
    .max(64),
});
const parcels = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.object({}).passthrough()).max(100),
});
const extraAttributes = z.object({
  type: z.literal('FeatureCollection'),
  features: z
    .array(z.object({ properties: z.object({ description: z.string().max(500) }) }))
    .max(1),
});
const scopeNote =
  'Ce service ne traite pas les déchets, le bruit ou l’état de la chaussée. Les urgences doivent être signalées au service compétent par téléphone.';

export class RivieraClient implements ReportingAdapter {
  readonly bfsId: number;
  readonly municipality: string;
  readonly serviceId: string;
  readonly deliveryLanguage = 'fr' as const;
  readonly submissionMode = 'unverified' as const;
  readonly reportingService = 'Signalements-Riviera';
  readonly reportingUrl = `${ORIGIN}/`;
  readonly reportFormUrl = `${ORIGIN}/nouveau.php`;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly privacy =
    'Preparation keeps normalized photos and contact details in Civic. Only the issue coordinates are used for public location/category checks. Municipal upload and receipt verification is pending; nothing is sent.';
  readonly guidance;
  private places: Pick<SwissPlaces, 'municipality'>;
  private reads: RivieraReads;
  constructor(
    name: RivieraMunicipality,
    private request: typeof fetch = fetch,
    options: { places?: Pick<SwissPlaces, 'municipality'>; now?: () => number } = {},
  ) {
    const profile = rivieraMunicipalities[name];
    if (!profile) throw new Error('Unsupported Riviera municipality.');
    this.bfsId = profile.bfsId;
    this.municipality = profile.municipality;
    this.serviceId = `riviera-${this.bfsId}`;
    this.places = options.places ?? new SwissPlaces(request);
    let reads = sharedReads.get(request);
    if (!reads) {
      reads = new RivieraReads(request, options.now ?? Date.now);
      sharedReads.set(request, reads);
    }
    this.reads = reads;
    this.guidance = {
      municipality: this.municipality,
      delivery_language: this.deliveryLanguage,
      verified_on: '2026-10-15',
      sources: [{ title: 'Official anonymous Riviera reporting service', url: this.reportingUrl }],
      scope:
        'Non-emergency lighting, water-pipe leaks, playgrounds/public benches, road signage, construction-site safety, pine processionary caterpillars and abandoned bicycles.',
      issue_groups: [],
      exclusions: [
        {
          issue: 'Rubbish, noise or road-surface condition',
          next_step:
            'These issues are outside Signalements-Riviera. Explain the scope instead of choosing an unrelated category.',
        },
        {
          issue: 'Emergency, immediate danger or harassment',
          next_step:
            'Use the appropriate dedicated service; these are outside this maintenance adapter.',
        },
      ],
      responsibility:
        'Use the exact municipality and its current location-specific categories. Include a lighting asset number only if known. Abandoned bicycles must meet the municipality’s stated condition criteria.',
      routing_note:
        'Write concise French report text within 1000 characters, including any location context. One photo maximum. Preparation only: never claim delivery or ask for municipal login.',
    };
  }
  mapUrl(point: Point) {
    coordinates.parse(point);
    return this.placeMapUrl
      .replace('{longitude}', String(point.longitude))
      .replace('{latitude}', String(point.latitude));
  }
  fallbackUrl(_input: ReportInput) {
    return this.reportingUrl;
  }
  reportUrl(_id: string): string {
    throw new Error('Riviera report linking and receipts are unverified.');
  }
  geocode(query: string) {
    return new CityClient(this.request).geocode(query);
  }
  async categories() {
    await this.reads.read(new URL(this.reportFormUrl), true);
    return Object.entries(themes).map(([id, name]) => ({ service_code: id, service_name: name }));
  }
  private async context(point: Point, fresh = false) {
    const exact = coordinates.parse(point);
    if ((await this.places.municipality(exact))?.bfs_id !== this.bfsId)
      throw new Error('The exact location is outside this municipality.');
    const projected = rivieraCoordinates(exact);
    await this.reads.read(new URL(this.reportFormUrl), true, fresh);
    const read = (ws: string) => {
      const url = new URL('/webservices.php', ORIGIN);
      url.search = new URLSearchParams({
        ws,
        e: String(projected.east),
        n: String(projected.north),
      }).toString();
      return this.reads.read(url, false, fresh);
    };
    const [rawCategories, rawParcels, rawExtra] = await Promise.all([
      read('get_themes_at_location'),
      read('get_parcelle_publique_at_location'),
      read('get_extra_attributes_at_location'),
    ]);
    try {
      const found = categoryCollection
        .parse(JSON.parse(rawCategories))
        .features.map((f) => f.properties);
      if (
        found.some((c) => c.zone !== this.municipality) ||
        new Set(found.map((c) => c.gid_zone_thematique)).size !== found.length ||
        new Set(found.map((c) => c.gid_thematique)).size !== found.length
      )
        throw changed();
      const categories = found.filter((c) => Object.hasOwn(themes, c.gid_thematique));
      if (!categories.length || categories.some((c) => themes[c.gid_thematique] !== c.thematique))
        throw changed();
      const publicParcel = parcels.parse(JSON.parse(rawParcels)).features.length > 0;
      const prefix = rawExtra.trim()
        ? extraAttributes.parse(JSON.parse(rawExtra)).features[0]?.properties.description.trim()
        : undefined;
      return { projected, categories, publicParcel, prefix };
    } catch {
      throw changed();
    }
  }
  private rules(
    context: Awaited<ReturnType<RivieraClient['context']>>,
  ): Record<string, Requirements> {
    return Object.fromEntries(
      context.categories.map((c) => [
        c.thematique,
        {
          photo_required: false,
          email_required: false,
          phone_required: false,
          contact_fields: [],
          max_photos: 1,
          description_max_length: 1000,
          ...(context.prefix ? { description_prefix: context.prefix } : {}),
          bodies: [this.municipality],
          extra_fields: [],
          notes: [
            scopeNote,
            ...(!context.publicParcel
              ? [
                  'Attention : cet emplacement n’est pas identifié comme domaine public. Vérifiez que cette thématique accepte un signalement à cet endroit.',
                ]
              : []),
            ...(c.info ? [plainHtml(c.info)].filter(Boolean) : []),
            ...(context.prefix
              ? [`Contexte de l’emplacement ajouté au texte à vérifier : ${context.prefix}`]
              : []),
          ],
        },
      ]),
    );
  }
  async requirements(point: Point, options: { fresh?: boolean } = {}) {
    return this.rules(await this.context(point, options.fresh));
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Riviera public report lookup is unverified.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Riviera tracking is unverified.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Riviera duplicate search is unverified.');
  }

  /** Build the observed wire payload locally. This method only makes public GETs;
   * it never uploads, dispatches, interprets a receipt or claims delivery. */
  async buildSubmission(
    preview: Prepared,
  ): Promise<{ url: string; method: 'POST'; body: FormData }> {
    if (!preview.destination || !sameDestination(preview.destination, destinationFor(this)))
      throw new Error('Preview belongs to a different municipality or service.');
    const input = reportInput.parse(preview.input),
      context = await this.context(input, true);
    const category = context.categories.find((c) => c.thematique === input.category);
    if (
      !category ||
      input.name?.trim() ||
      input.phone?.trim() ||
      Object.keys(input.extra_fields).length
    )
      throw new Error('Unsupported Riviera category or contact fields.');
    if (
      input.description.length > 1000 ||
      (context.prefix && !input.description.startsWith(context.prefix + '\n'))
    )
      throw new Error('Riviera text or location context changed. Prepare a new preview.');
    if (
      preview.photos.length > 1 ||
      input.photo_ids.length !== preview.photos.length ||
      preview.photos.some((p, i) => p.id !== input.photo_ids[i])
    )
      throw new Error('Riviera accepts one matching preview photo at most.');
    const body = new FormData();
    body.set('east', String(context.projected.east));
    body.set('north', String(context.projected.north));
    body.set('themes-list', String(category.gid_zone_thematique));
    body.set('description', input.description);
    if (input.email) body.set('email', input.email);
    if (preview.photos[0]) {
      const photo = preview.photos[0],
        bytes = Buffer.from(photo.jpeg, 'base64');
      if (
        bytes.length > 5_000_000 ||
        bytes.length < 3 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255 ||
        createHash('sha256').update(bytes).digest('hex') !== photo.sha256
      )
        throw new Error('Preview photo integrity check failed.');
      body.set('photo', new Blob([bytes], { type: 'image/jpeg' }), 'civic-report.jpg');
    }
    return { url: `${ORIGIN}/add_signalement.php`, method: 'POST', body };
  }
  async submit(_preview: Prepared): Promise<{ state: 'unknown' }> {
    throw new Error(
      'Sending is disabled until Riviera upload and municipal receipt verification is complete.',
    );
  }
}
