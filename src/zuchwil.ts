import { createHash } from 'node:crypto';
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
import { destinationFor, sameDestination, type ReportingAdapter } from './municipalities.js';
import { SwissPlaces } from './places.js';

const ORIGIN = 'https://www.zuchwil.ch';
const FORM = `${ORIGIN}/de/verwaltung/formulare/schadensmelder.php`;
const TERMS = `${ORIGIN}/de/datenschutz/`;
const UPLOADER = '/weblication/grid5/scripts/wUploader.php';
const CATEGORY = 'Schadensmeldung';
const changed = () =>
  new Error(
    'Zuchwil is unavailable or its anonymous form contract has changed. Preparation is paused.',
  );
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: Element, key: string) => n.attrs.find((a) => a.name === key)?.value;
const text = (n: Node): string =>
  'value' in n ? n.value : 'childNodes' in n ? n.childNodes.map(text).join('') : '';
const sameOrigin = (path: string) => {
  const url = new URL(path, ORIGIN);
  if (url.origin !== ORIGIN || url.username || url.password || url.hash) throw changed();
  return url;
};
const token = (value: string | undefined, min = 16, max = 256) => {
  if (!value || value.length < min || value.length > max || !/^[a-zA-Z0-9_-]+$/.test(value))
    throw changed();
  return value;
};
function protectedControls(nodes: Element[]) {
  // Inspect active elements, not generic CMS styles or the site's unrelated login link.
  if (
    nodes.some(
      (n) =>
        /captcha|turnstile|challenge/i.test(
          [attr(n, 'src'), attr(n, 'class'), attr(n, 'id'), attr(n, 'name')].join(' '),
        ) && n.tagName !== 'style',
    )
  )
    throw changed();
}
type FormSession = {
  action: string;
  token: string;
  uploadUrl: string;
  formId: string;
  visitorId: string;
};
/** Contains ephemeral tokens. Never persist or log the result. */
export function inspectZuchwilForm(html: string): FormSession {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const page = all(parse(html));
  const forms = page.filter(
    (n) => n.tagName === 'form' && attr(n, 'class')?.split(/\s+/).includes('schadensmelder'),
  );
  if (forms.length !== 1) throw changed();
  const form = forms[0],
    nodes = all(form);
  protectedControls(nodes);
  protectedControls(page.filter((n) => n.tagName === 'script' || n.tagName === 'iframe'));
  if (nodes.some((n) => n.tagName === 'fieldset' && attr(n, 'disabled') !== undefined))
    throw changed();
  // Externally associated fields are part of the form too, but not supported.
  if (page.some((n) => attr(n, 'form') && attr(n, 'form') === attr(form, 'id'))) throw changed();
  const action = sameOrigin(attr(form, 'action') ?? '');
  if (
    !/^\/weblication\/grid5\/tmpHTTP\/wForm-cached-\d{10}-nsid-[a-f0-9]{32}\.php$/.test(
      action.pathname,
    ) ||
    action.search ||
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    attr(form, 'target') !== '_self'
  )
    throw changed();
  const expected: [string, string, string | undefined][] = [
    ['title_damage', 'text', 'required'],
    ['wFormToken', 'hidden', undefined],
    ['description_damage', 'textarea', 'required'],
    ['address', 'textarea', 'required'],
    ['remarks_damage', 'textarea', undefined],
    ['email', 'text', 'email'],
    ['images', 'hidden', undefined],
    ['datenschutz-akzeptiert[]', 'checkbox', 'required'],
  ];
  const controls = nodes.filter((n) =>
    ['input', 'textarea', 'select', 'button', 'iframe', 'object'].includes(n.tagName),
  );
  if (controls.length !== expected.length + 3) throw changed();
  for (const [name, type, validator] of expected) {
    const found = controls.filter((n) => attr(n, 'name') === name);
    if (found.length !== 1) throw changed();
    const n = found[0];
    if (
      (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
      attr(n, 'data-validators') !== validator ||
      ['disabled', 'readonly', 'form', 'formaction', 'maxlength', 'required', 'checked'].some(
        (k) => attr(n, k) !== undefined,
      )
    )
      throw changed();
    if (['title_damage', 'email'].includes(name) && attr(n, 'aria-required') !== 'true')
      throw changed();
    if (name === 'datenschutz-akzeptiert[]' && attr(n, 'value') !== 'Ja') throw changed();
    if (name === 'images' && attr(n, 'value') !== '') throw changed();
  }
  for (const type of ['reset', 'submit']) {
    const found = controls.filter((n) => n.tagName === 'button' && attr(n, 'type') === type);
    if (
      found.length !== 1 ||
      ['name', 'formaction', 'form', 'disabled'].some((k) => attr(found[0], k) !== undefined)
    )
      throw changed();
  }
  const privacyLinks = nodes.filter(
    (n) => n.tagName === 'a' && attr(n, 'href') && sameOrigin(attr(n, 'href')!).href === TERMS,
  );
  if (privacyLinks.length !== 1) throw changed();
  const frames = controls.filter((n) => n.tagName === 'iframe');
  if (frames.length !== 1 || attr(frames[0], 'srcdoc') !== undefined) throw changed();
  const upload = sameOrigin(attr(frames[0], 'src') ?? '');
  if (
    upload.pathname !== UPLOADER ||
    [...upload.searchParams.keys()].sort().join(',') !==
      'action,element,form,lang,project,uploaded,vid' ||
    upload.searchParams.get('action') !== 'showmaskuploadform' ||
    upload.searchParams.get('element') !== 'images' ||
    upload.searchParams.get('project') !== '/de' ||
    upload.searchParams.get('lang') !== 'de' ||
    upload.searchParams.get('uploaded') !== ''
  )
    throw changed();
  const formId = upload.searchParams.get('form') ?? '';
  if (!/^[a-f0-9]{8}$/.test(formId)) throw changed();
  return {
    action: action.href,
    token: token(
      attr(
        controls.find((n) => attr(n, 'name') === 'wFormToken')!,
        'value',
      ),
      32,
      32,
    ),
    uploadUrl: upload.href,
    formId,
    visitorId: token(upload.searchParams.get('vid') ?? undefined),
  };
}

/** Parse the observed literal configuration, without evaluating municipal JS. */
export function inspectZuchwilUploader(html: string, form: FormSession) {
  if (Buffer.byteLength(html) > 200_000) throw changed();
  const nodes = all(parse(html));
  protectedControls(nodes);
  if (nodes.some((n) => attr(n, 'type') === 'password')) throw changed();
  const script = nodes
    .filter((n) => n.tagName === 'script' && !attr(n, 'src'))
    .map(text)
    .join('\n');
  const one = (pattern: RegExp) => {
    const matches = [...script.matchAll(pattern)];
    if (matches.length !== 1) throw changed();
    return matches[0][1];
  };
  const csrf = token(one(/\bvar\s+wCsrf\s*=\s*["']([a-zA-Z0-9_-]+)["']\s*;/g));
  if (
    one(/\bvar\s+wVersionGrid\s*=\s*['"]([^'"]*)['"]/g) !== '21' ||
    one(/\bvar\s+checkMetaDataActive\s*=\s*['"]([^'"]*)['"]/g) !== '1'
  )
    throw changed();
  if (
    one(/\bvar\s+wUserType\s*=\s*['"]([^'"]*)['"]/g) !== '' ||
    one(/\bvar\s+elementName\s*=\s*['"]([^'"]*)['"]/g) !== 'images' ||
    one(/\bvar\s+formID\s*=\s*['"]([^'"]*)['"]/g) !== form.formId
  )
    throw changed();
  const raw = one(/\bwUploader\.add\('#uploader',\s*(\{[^}]*\})\);/g);
  // Only the deployed literal grammar is supported; functions/expressions fail closed.
  const entry =
    /\s*'([^']+)'\s*:\s*(?:'([^']*)'|(true|false)|([0-9]+)|parseInt\('([0-9]*)'\))\s*(,|$)/gy;
  const content = raw.slice(1, -1),
    config: Record<string, string> = {};
  let end = 0;
  for (let m; (m = entry.exec(content));) {
    if (Object.hasOwn(config, m[1])) throw changed();
    config[m[1]] = m[2] ?? m[3] ?? m[4] ?? m[5];
    end = entry.lastIndex;
  }
  const dir = `/weblication/grid5/tmp/_wUploadForm/wFormTmp(${form.formId})`;
  const expected = {
    type: 'form',
    showCurrent: 'true',
    formID: form.formId,
    uploaded: '',
    dirDest: dir,
    maskId: '',
    vId: form.visitorId,
    nameDest: '',
    onAfterUpload: '',
    maxUploads: '128',
    maxSizeImage: '5',
    maxWidthImage: '',
    useSend: '',
    showThumbnails: '',
    resizeIfhasCopyright: '',
  };
  if (
    end !== content.length ||
    Object.keys(config).length !== Object.keys(expected).length ||
    Object.entries(expected).some(([k, v]) => config[k] !== v)
  )
    throw changed();
  return { csrf, dir };
}

// The source extracts an upload filename; that is NOT a municipal receipt.
export function zuchwilUploadedFilename(response: string): string {
  if (response.length > 16_384 || /error|wOnAfterUploadFailed|captcha|turnstile/i.test(response))
    throw new Error('Zuchwil upload result is unverified or failed.');
  const matches = [...response.matchAll(/&filename=([^&\s<>"']+)/g)];
  if (matches.length !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,150}\.jpe?g$/.test(matches[0][1]))
    throw new Error('Zuchwil upload filename is missing or unsafe.');
  return matches[0][1];
}

type LocalRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: FormData | URLSearchParams;
};
export type ZuchwilSubmissionPlan = {
  expiresAt: number;
  uploads: { photoId: string; preflight: LocalRequest; chunks: LocalRequest[] }[];
  finalizeUpload?: LocalRequest;
  buildForm(uploadedFilenames: string[]): LocalRequest;
};

export class ZuchwilClient implements ReportingAdapter {
  readonly bfsId = 2534;
  readonly municipality = 'Zuchwil';
  readonly serviceId = 'zuchwil-weblication';
  readonly deliveryLanguage = 'de' as const;
  readonly submissionMode = 'unverified' as const;
  readonly reportingService = 'Zuchwil Schadensmelder';
  readonly reportingUrl = FORM;
  readonly reportFormUrl = FORM;
  readonly termsUrl = TERMS;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly privacy =
    'Preparation keeps photos, report text and contact details in Civic. Anonymous municipal form checks send none of these details. Uploads and municipal receipts remain unverified; nothing is sent.';
  readonly guidance = {
    municipality: 'Zuchwil',
    delivery_language: 'de' as const,
    verified_on: '2026-10-16',
    sources: [{ title: 'Official Zuchwil damage form', url: FORM }],
    scope:
      'Non-emergency public-space damage, defective streetlights, disorder at waste collection points, missing dog-waste bags, fallen trees and damaged bus stops.',
    issue_groups: [],
    exclusions: [
      {
        issue: 'Emergency or immediate danger',
        next_step:
          'Use the appropriate emergency service; this maintenance form is not an emergency channel.',
      },
    ],
    responsibility:
      'Use the confirmed exact issue location in Zuchwil. Do not invent a municipal category or contact details.',
    routing_note:
      'German title and description, issue address and email are required. Name, phone and one photo are optional. Privacy consent is separate from report approval. Preparation only; never claim delivery or ask for municipal login.',
  };
  private places: Pick<SwissPlaces, 'municipality'>;
  private now: () => number;
  private verifiedUntil = 0;
  private retryAt = 0;
  private checking?: Promise<void>;
  private active = 0;
  constructor(
    private request: typeof fetch = fetch,
    options: { places?: Pick<SwissPlaces, 'municipality'>; now?: () => number } = {},
  ) {
    this.places = options.places ?? new SwissPlaces(request);
    this.now = options.now ?? Date.now;
  }
  private async session() {
    if (this.now() < this.retryAt)
      throw new Error('Zuchwil reads are paused. Try preparing later.');
    if (this.active >= 2)
      throw new Error('Zuchwil has enough requests in progress. Try preparing later.');
    this.active++;
    const cookies = new Map<string, string>();
    const read = async (url: string, limit: number) => {
      const response = await this.request(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Civic Zuchwil preparation (read-only)',
          ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        },
      });
      if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
        const retry = response.headers.get('retry-after') ?? '';
        const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - this.now();
        if (Number.isFinite(delay) && delay > 0)
          this.retryAt = this.now() + Math.min(delay, Number.MAX_SAFE_INTEGER - this.now());
        await response.body?.cancel();
        throw changed();
      }
      try {
        for (const cookie of response.headers.getSetCookie()) {
          if (cookie.length > 4096 || cookies.size >= 8) throw changed();
          const [pair, ...attributes] = cookie.split(';'),
            split = pair.indexOf('=');
          const name = pair.slice(0, split),
            value = pair.slice(split + 1);
          if (
            split < 1 ||
            !/^[a-zA-Z0-9_%.-]+$/.test(name) ||
            !/^[\x21-\x3A\x3C-\x7E]+$/.test(value)
          )
            throw changed();
          for (const item of attributes) {
            const [k, v] = item.trim().split('=');
            if (
              k.toLowerCase() === 'domain' &&
              !['zuchwil.ch', '.zuchwil.ch', 'www.zuchwil.ch'].includes(v?.toLowerCase())
            )
              throw changed();
            if (k.toLowerCase() === 'path' && v !== '/') throw changed();
            if (k.toLowerCase() === 'max-age' && Number(v) <= 0) throw changed();
            if (k.toLowerCase() === 'expires' && Date.parse(v) <= this.now()) throw changed();
          }
          cookies.set(name, value);
        }
      } catch {
        await response.body?.cancel().catch(() => {});
        throw changed();
      }
      if (!response.body) throw changed();
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > limit) throw changed();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return Buffer.concat(chunks).toString('utf8');
    };
    try {
      const form = inspectZuchwilForm(await read(FORM, 1_000_000));
      if (!cookies.has('WSESSIONID')) throw changed();
      const widget = inspectZuchwilUploader(await read(form.uploadUrl, 200_000), form);
      return { ...form, ...widget, cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    } catch {
      this.verifiedUntil = 0;
      this.retryAt = Math.max(this.retryAt, this.now() + 300_000);
      throw changed();
    } finally {
      this.active--;
    }
  }
  private async verify(fresh = false) {
    if (!fresh && this.verifiedUntil > this.now()) return;
    if (this.checking) return this.checking;
    this.checking = this.session()
      .then(() => {
        this.verifiedUntil = this.now() + 300_000;
      })
      .finally(() => {
        this.checking = undefined;
      });
    return this.checking;
  }
  private async boundary(point: Point) {
    if ((await this.places.municipality(coordinates.parse(point)))?.bfs_id !== this.bfsId)
      throw new Error('The exact location is outside Zuchwil.');
  }
  async categories() {
    await this.verify();
    return [{ service_code: 'damage', service_name: CATEGORY }];
  }
  async requirements(
    point: Point,
    options: { fresh?: boolean } = {},
  ): Promise<Record<string, Requirements>> {
    await this.boundary(point);
    await this.verify(options.fresh);
    return {
      [CATEGORY]: {
        photo_required: false,
        email_required: true,
        phone_required: false,
        contact_fields: ['name', 'phone'],
        max_photos: 1,
        bodies: [this.municipality],
        extra_fields: [
          {
            code: 'report_title',
            description: 'Report title',
            required: true,
            datatype: 'string',
            max_length: 100,
            translate: true,
          },
        ],
        notes: [
          'Die Gemeinde benötigt einen Titel, eine Beschreibung, die Adresse des Schadens und Ihre E-Mail-Adresse. Name und Telefonnummer sind freiwillig.',
          'Vor einer späteren Übermittlung ist eine gesonderte Zustimmung zur Datenschutzerklärung der Gemeinde erforderlich. Derzeit wird nichts übermittelt.',
        ],
      },
    };
  }
  geocode(query: string) {
    return new CityClient(this.request).geocode(query);
  }
  mapUrl(point: Point) {
    coordinates.parse(point);
    return this.placeMapUrl
      .replace('{longitude}', String(point.longitude))
      .replace('{latitude}', String(point.latitude));
  }
  fallbackUrl(_input: ReportInput) {
    return FORM;
  }
  reportUrl(_id: string): string {
    throw new Error('Zuchwil report links and receipts are unverified.');
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Zuchwil public report lookup is unverified.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Zuchwil tracking is unverified.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Zuchwil duplicate lookup is unverified.');
  }

  /** Local contract plan only. Reads a fresh anonymous session; never dispatches
   * upload/preflight/finalization/form requests. Contains secrets: do not log,
   * persist, reuse across residents or expose through a client API. */
  async buildSubmission(
    preview: Prepared,
    acceptedTermsUrl: string,
  ): Promise<ZuchwilSubmissionPlan> {
    if (!preview.destination || !sameDestination(preview.destination, destinationFor(this)))
      throw new Error('Preview belongs to a different municipality or service.');
    if (
      !Number.isFinite(Date.parse(preview.expires_at)) ||
      Date.parse(preview.expires_at) <= this.now()
    )
      throw new Error('Preview expired. Prepare a new preview.');
    if (preview.terms_url !== TERMS || acceptedTermsUrl !== TERMS)
      throw new Error('Explicit acceptance of the preview’s municipal privacy terms is required.');
    const input = reportInput.parse(preview.input),
      title = input.extra_fields.report_title;
    if (
      input.category !== CATEGORY ||
      !input.email ||
      !title?.trim() ||
      title.length > 100 ||
      Object.keys(input.extra_fields).some((k) => k !== 'report_title')
    )
      throw new Error('Zuchwil requires the reviewed title, category and email.');
    if (
      preview.photos.length > 1 ||
      input.photo_ids.length !== preview.photos.length ||
      preview.photos.some((p, i) => p.id !== input.photo_ids[i])
    )
      throw new Error('Zuchwil supports one matching preview photo at most.');
    const photos = preview.photos.map((p) => {
      const bytes = Buffer.from(p.jpeg, 'base64');
      if (
        bytes.length > 5_000_000 ||
        bytes.length < 3 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255 ||
        createHash('sha256').update(bytes).digest('hex') !== p.sha256
      )
        throw new Error('Preview photo integrity check failed.');
      return { id: p.id, bytes };
    });
    await this.boundary(input);
    const session = await this.session(),
      expiresAt = Math.min(Date.parse(preview.expires_at), this.now() + 300_000);
    const headers = { Cookie: session.cookie, Origin: ORIGIN, Referer: FORM };
    const get = (path: string, params: Record<string, string>): LocalRequest => {
      const url = sameOrigin(path);
      url.search = new URLSearchParams(params).toString();
      return { url: url.href, method: 'GET', headers: { ...headers } };
    };
    const uploads = photos.map((photo) => {
      const name = 'civic-report.jpg',
        size = photo.bytes.length,
        chunkSize = size > 1_048_576 ? 2_048_000 : 204_800;
      const count = Math.ceil(size / chunkSize),
        chunks: LocalRequest[] = [];
      for (let i = 0; i < count; i++) {
        const filename = count > 1 ? `${name}-part-${i + 1}` : name,
          body = new FormData();
        for (const [k, v] of Object.entries({
          uploadFilenameOrig: filename,
          action: 'uploadfile',
          type: 'smart',
          wcsrf: session.csrf,
          vid: session.visitorId,
          uploaddir: session.dir,
          part: String(i + 1),
          ispart: count > 1 ? '1' : '0',
          islastpart: count > 1 && i === count - 1 ? '1' : '0',
        }))
          body.set(k, v);
        body.set(
          'uploadFilename',
          new Blob([photo.bytes.subarray(i * chunkSize, Math.min(size, (i + 1) * chunkSize))], {
            type: 'application/octet-stream',
          }),
          filename,
        );
        chunks.push({ url: ORIGIN + UPLOADER, method: 'POST', headers: { ...headers }, body });
      }
      // The public helper wGetUrlPost moves the query into a URL-encoded POST.
      // Its metadata prefix contains image bytes: constructing it is local only.
      const md = [...photo.bytes.subarray(0, Math.min(40_000, size - 1))]
        .map((b) => b.toString(16))
        .join('_');
      const preflight: LocalRequest = {
        url: `${ORIGIN}/weblication/grid5/scripts/wFilemanager.php`,
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'getinfoforupload',
          path: `${session.dir}/${name}`,
          size: String(size),
          wcsrf: session.csrf,
          vid: session.visitorId,
          md,
        }),
      };
      return { photoId: photo.id, preflight, chunks };
    });
    return {
      expiresAt,
      uploads,
      ...(photos.length
        ? {
            finalizeUpload: get(UPLOADER, {
              action: 'onafteruploadall',
              dir: session.dir,
              wcsrf: session.csrf,
            }),
          }
        : {}),
      buildForm: (uploadedFilenames) => {
        if (this.now() >= expiresAt)
          throw new Error('Zuchwil plan expired. Obtain a fresh anonymous session.');
        if (
          uploadedFilenames.length !== photos.length ||
          new Set(uploadedFilenames).size !== uploadedFilenames.length ||
          uploadedFilenames.some((n) => zuchwilUploadedFilename(`&filename=${n}`) !== n)
        )
          throw new Error(
            'A matching verified upload filename is required for every preview photo.',
          );
        const body = new FormData();
        for (const [k, v] of Object.entries({
          title_damage: title,
          wFormToken: session.token,
          description_damage: input.description,
          address: `${input.location_label}\nKoordinaten (WGS84): ${input.latitude}, ${input.longitude}`,
          remarks_damage: [
            input.name ? `Name: ${input.name}` : '',
            input.phone ? `Telefon: ${input.phone}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          email: input.email,
          images: uploadedFilenames.join('|'),
          'datenschutz-akzeptiert[]': 'Ja',
        }))
          body.set(k, v);
        return { url: session.action, method: 'POST', headers: { ...headers }, body };
      },
    };
  }
  async submit(_preview: Prepared): Promise<{ state: 'unknown' }> {
    throw new Error(
      'Sending is disabled until Zuchwil upload and municipal receipt verification is complete.',
    );
  }
}
