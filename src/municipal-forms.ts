import { inspectMeggenForm, submitOneGov, oneGovReportUrl } from './onegov-form.js';
import { inspectEbikonForm } from './ebikon-form.js';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { CityClient } from './city.js';
import {
  coordinates,
  reportInput,
  type Point,
  type Prepared,
  type ReportInput,
  type Requirements,
} from './model.js';
import type { ReportingAdapter } from './municipalities.js';
import { SwissPlaces } from './places.js';

export const municipalForms = Object.freeze({
  meggen: Object.freeze({
    bfsId: 1063,
    municipality: 'Meggen',
    language: 'de' as const,
    formUrl: 'https://www.meggen.ch/form/meldung-sicherheitsproblem',
    reportingUrl: 'https://www.meggen.ch/form/meldung-sicherheitsproblem',
  }),
  ebikon: Object.freeze({
    bfsId: 1054,
    municipality: 'Ebikon',
    language: 'de' as const,
    formUrl: 'https://www.ebikon.ch/form/schaden-melden',
    reportingUrl: 'https://www.ebikon.ch/form/schaden-melden',
  }),
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
  if (name === 'ebikon') return inspectEbikonForm(html);
  if (name === 'meggen') return inspectMeggenForm(html);
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

/** Preparation defaults for all forms. Only the source-reviewed OneGov profiles
 * have a separately opted-in experimental transport; applications keep it off. */
export class MunicipalFormClient implements ReportingAdapter {
  readonly bfsId: number;
  readonly municipality: string;
  readonly deliveryLanguage: 'de' | 'fr';
  readonly serviceId: string;
  readonly reportingService: string;
  readonly reportingUrl: string;
  readonly reportFormUrl: string;
  readonly submissionMode: 'unverified' | 'direct';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly privacy: string;
  readonly guidance;
  private places: Pick<SwissPlaces, 'municipality'>;
  private now: () => number;
  private cached?: { expires: number; value: Category[] };
  private pending?: Promise<Category[]>;
  private retryAt = 0;
  constructor(
    private name: Name,
    private request: typeof fetch = fetch,
    options: {
      places?: Pick<SwissPlaces, 'municipality'>;
      now?: () => number;
      experimentalSubmission?: boolean;
    } = {},
  ) {
    const config = municipalForms[name];
    if (!config) throw new Error('Unsupported municipal form.');
    if (options.experimentalSubmission && name !== 'ebikon' && name !== 'meggen')
      throw new Error('Experimental submission is only implemented for the reviewed OneGov forms.');
    this.submissionMode = options.experimentalSubmission === true ? 'direct' : 'unverified';
    this.privacy =
      this.submissionMode === 'direct'
        ? 'After your approval, Civic sends your reviewed contact details, report and optional normalized photo to the municipality. Its service emails a ticket reference; Civic does not request a personal-data copy by email.'
        : 'Preparation keeps contact details and normalized photos in Civic. Sending is disabled pending a genuine municipal delivery pilot.';
    this.bfsId = config.bfsId;
    this.municipality = config.municipality;
    this.deliveryLanguage = config.language;
    this.serviceId = `${name}-defect-form`;
    this.reportingService =
      name === 'meggen'
        ? 'Meldung Sicherheitsproblem'
        : name !== 'fribourg'
          ? 'Schaden melden'
          : 'Avis de défectuosité';
    this.reportingUrl = config.reportingUrl;
    this.reportFormUrl = config.formUrl;
    this.places = options.places ?? new SwissPlaces(request);
    this.now = options.now ?? Date.now;
    this.guidance = {
      municipality: this.municipality,
      delivery_language: this.deliveryLanguage,
      verified_on: name === 'ebikon' || name === 'meggen' ? '2026-10-16' : '2026-10-15',
      sources: [{ title: 'Official municipal damage form', url: this.reportingUrl }],
      scope:
        name === 'meggen'
          ? 'Non-emergency safety defects in municipal infrastructure, handled by Meggen’s Planning / Construction department. Use its single safety-problem class; not general complaints or police reports.'
          : 'Non-emergency defects in municipal infrastructure and public spaces.',
      issue_groups: [],
      exclusions: [
        {
          issue: 'Emergency or immediate danger',
          next_step: 'Use the appropriate emergency service.',
        },
        ...(name === 'bern' || name === 'ebikon' || name === 'meggen'
          ? [
              {
                issue: 'Street-light fault',
                next_step:
                  name === 'meggen'
                    ? 'Meggen lists defective lighting separately from this safety-problem form.'
                    : name === 'ebikon'
                      ? 'Ebikon directs street-light faults to CKW, outside this damage form.'
                      : 'Bern directs street-light faults to Energie Wasser Bern (ewb), outside this form.',
              },
            ]
          : []),
      ],
      responsibility:
        'Use the exact municipal boundary and the official form’s current categories.',
      routing_note:
        this.submissionMode === 'direct'
          ? 'Experimental source-reviewed transport. A real municipal pilot remains pending. Only a verified ticket receipt means sent; uncertain responses must not be retried.'
          : 'Preparation only. Municipal delivery has not been pilot-verified; do not claim the report has been sent.',
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
    if (this.name === 'ebikon' || this.name === 'meggen') return oneGovReportUrl(this.name, _id);
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
    if (this.name === 'meggen')
      return {
        'Meldung Sicherheitsproblem': {
          scope: this.guidance.scope,
          photo_required: false,
          email_required: true,
          phone_required: false,
          contact_fields: ['phone'],
          max_photos: 1,
          max_photo_bytes: 5_000_000,
          description_max_length: 5000,
          location_label_max_length: 250,
          bodies: [this.municipality],
          extra_fields: [
            {
              code: 'first_name',
              contact: true,
              description: 'First name',
              required: true,
              datatype: 'string',
              max_length: 200,
            },
            {
              code: 'last_name',
              contact: true,
              description: 'Last name',
              required: true,
              datatype: 'string',
              max_length: 200,
            },
            {
              code: 'parcel_address',
              description: 'Issue address or parcel number (optional)',
              required: false,
              datatype: 'string',
              max_length: 250,
            },
          ],
          notes: [
            'Nicht dringende Sicherheitsprobleme an der kommunalen Infrastruktur. Vorname, Name und E-Mail sind erforderlich; Telefon, Grundstücksangabe und ein Foto sind freiwillig.',
            'Civic benötigt einen bestätigten Standort und eine Beschreibung. Höchstens ein Foto bis 5 MB.',
          ],
        },
      };
    if (this.name === 'ebikon')
      return Object.fromEntries(
        cats.map((c) => [
          c.service_name,
          {
            scope:
              'Non-emergency damage in public spaces: ' +
              c.service_name +
              '. Street-light faults use the separate CKW route.',
            photo_required: false,
            email_required: true,
            phone_required: false,
            contact_fields: ['phone'],
            max_photos: 1,
            max_photo_bytes: 5_000_000,
            description_max_length: 400,
            location_label_max_length: 150,
            bodies: [this.municipality],
            extra_fields: [
              {
                code: 'first_name',
                contact: true,
                description: 'First name',
                required: true,
                datatype: 'string',
                max_length: 200,
              },
              {
                code: 'last_name',
                contact: true,
                description: 'Last name',
                required: true,
                datatype: 'string',
                max_length: 200,
              },
              ...(c.service_name === 'Anderer Schaden'
                ? [
                    {
                      code: 'other_damage',
                      description: 'Type of other damage (optional)',
                      required: false,
                      datatype: 'string',
                      max_length: 200,
                      translate: true,
                    },
                  ]
                : []),
            ],
            notes: [
              'Vorname, Nachname, E-Mail, Schadensart, Standort und Beschreibung sind erforderlich. Telefon und ein Foto sind freiwillig.',
              'Die Beschreibung darf höchstens 400 Zeichen, die Standortbezeichnung höchstens 150 Zeichen enthalten. Höchstens ein Foto bis 5 MB.',
            ],
          } satisfies Requirements,
        ]),
      );
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
                contact: true,
                description: 'Reporter postal street address',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_postcode_city',
                contact: true,
                description: 'Reporter postcode and locality',
                required: true,
                datatype: 'string',
                max_length: 255,
              },
              {
                code: 'reporter_address_2',
                contact: true,
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
  async submit(
    preview: Prepared,
  ): Promise<{ state: 'accepted' | 'rejected' | 'unknown'; report_id?: string }> {
    if (this.submissionMode !== 'direct' || (this.name !== 'ebikon' && this.name !== 'meggen'))
      throw new Error(
        'Sending is disabled until municipal upload and receipt verification is complete.',
      );
    const input = reportInput.parse(preview.input);
    if (
      preview.destination?.bfs_id !== this.bfsId ||
      preview.destination.service_id !== this.serviceId ||
      preview.terms_url !== undefined ||
      !Number.isFinite(Date.parse(preview.expires_at)) ||
      Date.parse(preview.expires_at) <= this.now()
    )
      throw new Error('Preview destination or expiry does not match this municipality.');
    const rule = (await this.requirements(input))[input.category];
    if (
      !rule ||
      !input.email ||
      input.name ||
      input.description.length > rule.description_max_length! ||
      input.location_label.length > rule.location_label_max_length! ||
      preview.photos.length > 1 ||
      input.photo_ids.length !== preview.photos.length ||
      preview.photos.some((p, i) => p.id !== input.photo_ids[i])
    )
      throw new Error('The approved preview does not match the current municipal requirements.');
    const fields = rule.extra_fields ?? [];
    if (
      Object.keys(input.extra_fields).some((key) => !fields.some((f) => f.code === key)) ||
      fields.some(
        (f) =>
          (f.required && !input.extra_fields[f.code]?.trim()) ||
          (f.max_length && (input.extra_fields[f.code]?.length ?? 0) > f.max_length),
      )
    )
      throw new Error('The approved contact or extra fields do not match this form.');
    if (this.retryAt > this.now()) throw changed();
    const result = await submitOneGov(this.name, preview, this.request, this.now, (delay) => {
      this.retryAt = Math.max(
        this.retryAt,
        this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now()),
      );
    });
    if (result.state !== 'accepted') this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
    return result;
  }
}
