import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { CityClient } from './city.js';
import {
  coordinates,
  type Point,
  type Prepared,
  type ReportInput,
  type Requirements,
} from './model.js';
import type { ReportingAdapter } from './municipalities.js';
import { SwissPlaces } from './places.js';

export const municipalForms = Object.freeze({
  bern: Object.freeze({
    bfsId: 351,
    municipality: 'Bern',
    language: 'de' as const,
    formUrl: 'https://www.bern.ch/helfen/@@damagereport',
    reportingUrl: 'https://www.bern.ch/helfen/block_view',
  }),
  fribourg: Object.freeze({
    bfsId: 2196,
    municipality: 'Fribourg',
    language: 'fr' as const,
    formUrl: 'https://www.ville-fribourg.ch/on-repare',
    reportingUrl: 'https://www.ville-fribourg.ch/on-repare',
  }),
});
type Name = keyof typeof municipalForms;
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Category = { service_code: string; service_name: string };
const attr = (node: Element, key: string) => node.attrs.find((a) => a.name === key)?.value;
const all = (node: Node): Element[] => [
  ...('tagName' in node ? [node] : []),
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
const text = (node: Node): string =>
  'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
const hasClass = (node: Element, value: string) =>
  (attr(node, 'class') ?? '').split(/\s+/).includes(value);
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const changed = () =>
  new Error('The municipal reporting form is unavailable or has changed. Preparation is paused.');
const fribourgClass = 'webform-submission-gcee-avis-de-defectuosite-form';
const fribourgId = 'webform_submission_gcee_avis_de_defectuosite_paragraph_11662_add_form';
const specs = {
  bern: [
    ['form.widgets.image', 'file', false],
    ['form.widgets.location', 'text', true],
    ['form.widgets.category:list', 'select', true],
    ['form.widgets.category-empty-marker', 'hidden', false],
    ['form.widgets.email', 'text', true],
    ['form.widgets.message', 'textarea', false],
    ['accept_terms', 'checkbox', false],
    ['accept_text', 'text', false],
    ['form.buttons.damagereport_button_send', 'submit', false],
  ],
  fribourg: [
    ['coordonnees[name]', 'text', true],
    ['coordonnees[email]', 'email', true],
    ['coordonnees[phone]', 'tel', false],
    ['coordonnees[address]', 'text', true],
    ['coordonnees[address_2]', 'text', false],
    ['coordonnees[city]', 'text', true],
    ['adresse_exact', 'textarea', true],
    ['description_du_degat', 'textarea', true],
    ['files[photo_du_degat_optionnel_]', 'file', false],
    ['photo_du_degat_optionnel__upload_button', 'submit', false],
    ['photo_du_degat_optionnel_[fids]', 'hidden', false],
    ['form_build_id', 'hidden', false],
    ['form_id', 'hidden', false],
    ['op', 'submit', false],
  ],
} as const;

/** Return only public metadata. Never retain HTML, session tokens or cookies. */
export function inspectMunicipalForm(name: Name, html: string): Category[] {
  const config = municipalForms[name];
  if (!config || Buffer.byteLength(html) > 1_000_000) throw changed();
  const doc = all(parse(html));
  const matches = doc.filter(
    (e) =>
      e.tagName === 'form' &&
      (name === 'bern' ? attr(e, 'id') === 'damagereport-form' : hasClass(e, fribourgClass)),
  );
  if (matches.length !== 1) throw changed();
  const form = matches[0],
    nodes = all(form);
  if (
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    new URL(attr(form, 'action') ?? '', config.formUrl).href !== config.formUrl
  )
    throw changed();
  // Scope protection checks to the report, not unrelated page-feedback forms.
  if (
    nodes.some(
      (e) =>
        e.tagName === 'iframe' ||
        /captcha|turnstile|challenge/i.test(
          [attr(e, 'id'), attr(e, 'class'), attr(e, 'name'), attr(e, 'src')].join(' '),
        ),
    )
  )
    throw changed();
  const controls = nodes.filter((e) =>
    ['input', 'textarea', 'select', 'button'].includes(e.tagName),
  );
  if (controls.length !== specs[name].length) throw changed();
  for (const [field, type, required] of specs[name]) {
    const found = controls.filter((e) => attr(e, 'name') === field);
    if (found.length !== 1) throw changed();
    const e = found[0];
    const actualType = e.tagName === 'input' ? attr(e, 'type') : e.tagName;
    if (
      actualType !== type ||
      attr(e, 'disabled') !== undefined ||
      attr(e, 'readonly') !== undefined ||
      attr(e, 'form') !== undefined ||
      attr(e, 'formaction') !== undefined ||
      attr(e, 'multiple') !== undefined ||
      (attr(e, 'required') !== undefined || hasClass(e, 'required')) !== required
    )
      throw changed();
  }
  const value = (field: string) =>
    attr(
      controls.find((e) => attr(e, 'name') === field)!,
      'value',
    ) ?? '';
  if (name === 'fribourg') {
    if (
      value('form_id') !== fribourgId ||
      !/^form-[\w-]{10,200}$/.test(value('form_build_id')) ||
      value('op') !== 'Envoyer' ||
      value('photo_du_degat_optionnel_[fids]')
    )
      throw changed();
    // A smaller live contact limit invalidates our preparation contract.
    for (const [field, limit] of [
      ['coordonnees[name]', 100],
      ['coordonnees[email]', 254],
      ['coordonnees[phone]', 50],
      ['coordonnees[address]', 255],
      ['coordonnees[address_2]', 255],
      ['coordonnees[city]', 255],
    ] as const) {
      const max = attr(
        controls.find((e) => attr(e, 'name') === field)!,
        'maxlength',
      );
      if (max !== undefined && (!/^\d+$/.test(max) || Number(max) < limit)) throw changed();
    }
    return [{ service_code: 'gcee-avis-de-defectuosite', service_name: 'Avis de défectuosité' }];
  }
  if (
    value('form.widgets.category-empty-marker') !== '1' ||
    value('form.buttons.damagereport_button_send') !== 'Melden'
  )
    throw changed();
  const selector = controls.find((e) => attr(e, 'name') === 'form.widgets.category:list')!;
  const categories = all(selector)
    .filter((e) => e.tagName === 'option' && attr(e, 'value') !== 'None')
    .map((e) => {
      const code = attr(e, 'value') ?? '',
        label = normalize(text(e));
      if (
        !/^[a-z][a-z0-9-]{0,99}$/.test(code) ||
        !label ||
        label.length > 100 ||
        attr(e, 'disabled') !== undefined
      )
        throw changed();
      return { service_code: code, service_name: label };
    });
  if (
    !categories.length ||
    categories.length > 100 ||
    new Set(categories.map((c) => c.service_code)).size !== categories.length ||
    new Set(categories.map((c) => c.service_name)).size !== categories.length
  )
    throw changed();
  return categories;
}

async function readHtml(response: Response) {
  if (
    !response.ok ||
    !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
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
      if (bytes > 1_000_000) throw changed();
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Read/preparation adapter. No municipal write transport exists until actual
 * upload and receipt contracts are verified. A global send flag cannot unlock it. */
export class MunicipalFormClient implements ReportingAdapter {
  readonly bfsId: number;
  readonly municipality: string;
  readonly deliveryLanguage: 'de' | 'fr';
  readonly serviceId: string;
  readonly reportingService: string;
  readonly reportingUrl: string;
  readonly reportFormUrl: string;
  readonly submissionMode = 'unverified' as const;
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly privacy =
    'Preparation keeps contact details and normalized photos in Civic. Nothing is sent to the municipality: upload, submission and receipt verification is pending.';
  readonly guidance;
  private places: Pick<SwissPlaces, 'municipality'>;
  private now: () => number;
  private cached?: { expires: number; value: Category[] };
  private pending?: Promise<Category[]>;
  private retryAt = 0;
  constructor(
    private name: Name,
    private request: typeof fetch = fetch,
    options: { places?: Pick<SwissPlaces, 'municipality'>; now?: () => number } = {},
  ) {
    const config = municipalForms[name];
    if (!config) throw new Error('Unsupported municipal form.');
    this.bfsId = config.bfsId;
    this.municipality = config.municipality;
    this.deliveryLanguage = config.language;
    this.serviceId = `${name}-defect-form`;
    this.reportingService = name === 'bern' ? 'Schaden melden' : 'Avis de défectuosité';
    this.reportingUrl = config.reportingUrl;
    this.reportFormUrl = config.formUrl;
    this.places = options.places ?? new SwissPlaces(request);
    this.now = options.now ?? Date.now;
    this.guidance = {
      municipality: this.municipality,
      delivery_language: this.deliveryLanguage,
      verified_on: '2026-10-15',
      sources: [{ title: 'Official municipal damage form', url: this.reportingUrl }],
      scope: 'Non-emergency defects in municipal infrastructure and public spaces.',
      issue_groups: [],
      exclusions: [
        {
          issue: 'Emergency or immediate danger',
          next_step: 'Use the appropriate emergency service.',
        },
        ...(name === 'bern'
          ? [
              {
                issue: 'Street-light fault',
                next_step:
                  'Bern directs street-light faults to Energie Wasser Bern (ewb), outside this form.',
              },
            ]
          : []),
      ],
      responsibility:
        'Use the exact municipal boundary and the official form’s current categories.',
      routing_note:
        'Preparation only. Municipal uploads, acceptance and tracking are unverified; do not claim the report has been sent.',
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
    throw new Error('Public report linking is unverified for this municipality.');
  }
  geocode(query: string) {
    return new CityClient(this.request).geocode(query);
  }
  categories() {
    return this.loadCategories(false);
  }
  private async loadCategories(fresh: boolean): Promise<Category[]> {
    if (this.retryAt > this.now()) throw changed();
    if (!fresh && this.cached && this.cached.expires > this.now())
      return structuredClone(this.cached.value);
    if (!this.pending)
      this.pending = (async () => {
        try {
          const response = await this.request(this.reportFormUrl, {
            method: 'GET',
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
            headers: {
              Accept: 'text/html',
              'User-Agent': 'Civic municipal form preparation (read-only)',
            },
          });
          if (!response.ok) {
            const header = response.headers.get('retry-after') ?? '';
            const delay = /^\d+$/.test(header)
              ? Number(header) * 1000
              : Date.parse(header) - this.now();
            if (Number.isFinite(delay) && delay > 0)
              this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
          }
          const value = inspectMunicipalForm(this.name, await readHtml(response));
          this.cached = { value, expires: this.now() + 300_000 };
          return value;
        } catch (error) {
          this.cached = undefined;
          this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
          throw error;
        }
      })().finally(() => {
        this.pending = undefined;
      });
    return structuredClone(await this.pending);
  }
  async requirements(
    point: Point,
    options: { fresh?: boolean } = {},
  ): Promise<Record<string, Requirements>> {
    const exact = coordinates.parse(point),
      municipality = await this.places.municipality(exact);
    if (municipality?.bfs_id !== this.bfsId)
      throw new Error('The exact location is outside this municipality.');
    const cats = await this.loadCategories(options.fresh === true);
    const rule: Requirements = {
      photo_required: false,
      phone_required: false,
      name_required: this.name === 'fribourg',
      contact_fields: this.name === 'fribourg' ? ['name', 'phone'] : [],
      max_photos: 1,
      bodies: [this.municipality],
      extra_fields:
        this.name === 'fribourg'
          ? [
              {
                code: 'reporter_address',
                description: 'Reporter postal street address',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_postcode_city',
                description: 'Reporter postcode and locality',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_address_2',
                description: 'Additional reporter postal address (optional)',
                required: false,
                datatype: 'string',
                max_length: 255,
              },
            ]
          : [],
    };
    return Object.fromEntries(cats.map((c) => [c.service_name, structuredClone(rule)]));
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Public report lookup is unverified for this municipality.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Public tracking is unverified for this municipality.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Duplicate search is unavailable for this municipality.');
  }
  async submit(_preview: Prepared): Promise<{ state: 'unknown' }> {
    throw new Error(
      'Sending is disabled until municipal upload and receipt verification is complete.',
    );
  }
}
