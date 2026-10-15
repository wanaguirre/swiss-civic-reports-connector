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
import { destinationFor, sameDestination } from './municipalities.js';
import { SwissPlaces } from './places.js';

// Reviewed tenant identifiers, never supplied by a report or an HTML response.
export const anthrazitTenants = Object.freeze({
  winterthur: Object.freeze({
    bfsId: 230,
    municipality: 'Winterthur',
    origin: 'https://m.winterthur.ch',
    apid: '1643504707',
    usid: '9885',
    usmid: '4769',
    radius: '10000',
    clat: '47.4970314',
    clong: '8.722418',
    terms: '1873279288',
  }),
  schlieren: Object.freeze({
    bfsId: 247,
    municipality: 'Schlieren',
    origin: 'https://m.schlieren.ch',
    apid: '1837234',
    usid: '7930',
    usmid: '4502',
    radius: '4000',
    clat: '47.3961007',
    clong: '8.4469846',
    terms: undefined,
  }),
});
type Tenant = (typeof anthrazitTenants)[keyof typeof anthrazitTenants];
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const attr = (node: Node, name: string) =>
  'attrs' in node ? node.attrs.find((a) => a.name === name)?.value : undefined;
const children = (node: Node): Node[] => ('childNodes' in node ? node.childNodes : []);
const nodes = (node: Node): Node[] => [node, ...children(node).flatMap(nodes)];
const elements = (node: Node, tag: string) =>
  nodes(node).filter((n): n is Element => 'tagName' in n && n.tagName === tag);
const text = (node: Node): string =>
  node.nodeName === '#text'
    ? (node as DefaultTreeAdapterMap['textNode']).value
    : children(node).map(text).join('');
const hasClass = (node: Node, name: string) => attr(node, 'class')?.split(/\s+/).includes(name);
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
function document(html: string) {
  if (html.length > 1_000_000) throw new Error('Municipal response is too large.');
  const doc = parse(html);
  if (nodes(doc).some((n) => attr(n, 'type') === 'password' || attr(n, 'id') === 'loginRegForm'))
    throw new Error('The official service requires login. Complete it in the official form.');
  return doc;
}
function endpoint(tenant: Tenant, step?: number, rid?: string) {
  const url = new URL('/index.php', tenant.origin);
  url.search = new URLSearchParams({
    apid: tenant.apid,
    do: 'add',
    ...(step ? { step: String(step) } : {}),
    ...(rid ? { rid } : {}),
  }).toString();
  return url;
}
function trustedPage(url: URL, tenant: Tenant) {
  if (
    url.origin !== tenant.origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== '/index.php' ||
    url.searchParams.get('apid') !== tenant.apid ||
    url.searchParams.get('do') !== 'add' ||
    [...url.searchParams.keys()].some(
      (k) => !['apid', 'do', 'step', 'rid', 'embed', 'jsr'].includes(k),
    )
  )
    throw new Error('Unexpected municipal wizard destination.');
  for (const key of url.searchParams.keys())
    if (url.searchParams.getAll(key).length !== 1)
      throw new Error('Ambiguous municipal wizard destination.');
}

// One private cookie jar per operation/attempt. Redirects never replay a POST or
// carry cookies, photos or contact details to another origin. No network retries.
class Session {
  private cookies = new Map<string, string>();
  constructor(
    private tenant: Tenant,
    private request: typeof fetch,
  ) {}
  async read(url: URL, init: RequestInit = {}, follow = true): Promise<{ url: URL; body: string }> {
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (url.origin !== this.tenant.origin) throw new Error('Unexpected municipal origin.');
      const response = await this.request(url, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'text/html,application/json',
          ...(init.method === 'POST' ? { Origin: this.tenant.origin } : {}),
          'User-Agent': 'swiss-civic-reports/0.3.1',
          ...(this.cookies.size
            ? { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
            : {}),
        },
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const index = pair.indexOf('=');
        if (index < 1 || pair.length > 4096)
          throw new Error('Unexpected municipal session cookie.');
        this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
        if (this.cookies.size > 32) throw new Error('Too many municipal session cookies.');
      }
      if (response.status >= 300 && response.status < 400) {
        // The final send result has no evidenced success contract. Do not follow
        // or replay it, including 307/308 which would repeat the write.
        if (!follow) return { url, body: '' };
        if (![301, 302, 303].includes(response.status))
          throw new Error('Unsafe municipal redirect.');
        const location = response.headers.get('location');
        if (!location) throw new Error('Missing municipal redirect destination.');
        url = new URL(location, url);
        trustedPage(url, this.tenant);
        init = {};
        continue;
      }
      if (!response.ok) throw new Error('Municipal request failed.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!response.body) throw new Error('Empty municipal response.');
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1_000_000) {
            await reader.cancel();
            throw new Error('Municipal response is too large.');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return { url, body: Buffer.concat(chunks).toString('utf8') };
    }
    throw new Error('Too many municipal redirects.');
  }
}
type Page = Awaited<ReturnType<Session['read']>>;
function form(page: Page, tenant: Tenant, step: number, names: string[]) {
  trustedPage(page.url, tenant);
  if (page.url.searchParams.get('step') !== String(step))
    throw new Error('Unexpected municipal wizard step.');
  const doc = document(page.body);
  const forms = elements(doc, 'form');
  if (forms.length !== 1) throw new Error('Unexpected municipal form.');
  const form = forms[0];
  const url = new URL(attr(form, 'action') || page.url.href, page.url);
  trustedPage(url, tenant);
  if (
    url.searchParams.get('step') !== String(step) ||
    (attr(form, 'method') ?? '').toLowerCase() !== 'post'
  )
    throw new Error('Unexpected municipal form action.');
  const controls = nodes(form).filter((n) =>
    ['input', 'textarea', 'select', 'button'].includes(n.nodeName),
  );
  const actual = controls.map((n) => attr(n, 'name')).filter((n): n is string => !!n);
  if (names.some((n) => !actual.includes(n)) || actual.some((n) => !names.includes(n)))
    throw new Error('Municipal form fields changed.');
  if (
    actual.some(
      (name) => name !== 'submit' && actual.filter((other) => other === name).length !== 1,
    )
  )
    throw new Error('Ambiguous municipal form fields.');
  if (controls.some((n) => ['file', 'password'].includes(attr(n, 'type') ?? '')))
    throw new Error('Unexpected municipal input.');
  return {
    doc,
    node: form,
    url,
    multipart: attr(form, 'enctype') === 'multipart/form-data',
    controls,
  };
}
function body(fields: Record<string, string>, multipart: boolean) {
  const data = multipart ? new FormData() : new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
function categories(page: Page, tenant: Tenant) {
  const doc = document(page.body);
  const containers = nodes(doc).filter((n) => attr(n, 'id') === 'catSelect');
  if (containers.length !== 1) throw new Error('Municipal categories unavailable.');
  const rows = nodes(containers[0]).filter((n) => hasClass(n, 'theRow') && attr(n, 'data-action'));
  const result = rows.map((row) => {
    const url = new URL(attr(row, 'data-action')!, page.url);
    trustedPage(url, tenant);
    const rid = url.searchParams.get('rid');
    const label = nodes(row).find((n) => hasClass(n, 'colDescription'));
    if (url.searchParams.get('step') !== '1' || !rid || !/^\d+$/.test(rid) || !label)
      throw new Error('Municipal category contract changed.');
    const name = normalized(text(label));
    if (!name || name.length > 100) throw new Error('Invalid municipal category.');
    return { service_code: rid, service_name: name };
  });
  if (
    !result.length ||
    result.length > 100 ||
    new Set(result.map((c) => c.service_name)).size !== result.length ||
    new Set(result.map((c) => c.service_code)).size !== result.length
  )
    throw new Error('Ambiguous municipal categories.');
  return result;
}

/** Shared Anthrazit wizard adapter. Writes require ReportService's durable claim
 * and approval. Winterthur additionally requires explicit experimental opt-in;
 * Schlieren stays read/preparation-only while its final step requests login. */
export class AnthrazitClient implements ReportingAdapter {
  private tenant: Tenant;
  readonly bfsId: number;
  readonly municipality: string;
  readonly serviceId: string;
  readonly reportingService = 'Stadtmelder';
  readonly deliveryLanguage = 'de' as const;
  readonly reportingUrl: string;
  readonly reportFormUrl: string;
  readonly termsUrl?: string;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly submissionMode: 'direct' | 'official_form';
  readonly privacy =
    'Report title, description, location and photos may be published. Email and optional contact details are sent to the municipality. Update notifications are off unless explicitly selected. Drafts contain these details locally.';
  readonly guidance;
  private places: Pick<SwissPlaces, 'municipality'>;
  constructor(
    name: keyof typeof anthrazitTenants,
    private request: typeof fetch = fetch,
    options: { experimentalSubmission?: boolean; places?: Pick<SwissPlaces, 'municipality'> } = {},
  ) {
    const tenant = anthrazitTenants[name];
    if (!tenant) throw new Error('Unsupported Anthrazit municipality.');
    this.tenant = tenant;
    this.bfsId = tenant.bfsId;
    this.municipality = tenant.municipality;
    this.serviceId = `anthrazit-${tenant.bfsId}`;
    this.reportingUrl = `${tenant.origin}/index.php?apid=${tenant.apid}`;
    this.reportFormUrl = endpoint(tenant).href;
    this.termsUrl = tenant.terms ? `${tenant.origin}/index.php?apid=${tenant.terms}` : undefined;
    this.submissionMode =
      name === 'winterthur' && options.experimentalSubmission === true ? 'direct' : 'official_form';
    this.places = options.places ?? new SwissPlaces(request);
    this.guidance = {
      municipality: this.municipality,
      delivery_language: 'de',
      verified_on: '2026-10-15',
      sources: [{ title: 'Official Stadtmelder', url: this.reportingUrl }],
      scope: 'Non-emergency observations in the municipality. Use live categories.',
      issue_groups: [],
      exclusions: [
        {
          issue: 'Emergency or immediate danger',
          next_step: 'Use the appropriate emergency service.',
        },
      ],
      responsibility: 'The municipality routes the report to its responsible office.',
      routing_note:
        'Choose from live categories and verify the municipality from the exact point. A public tracking API has not been verified.',
    };
  }
  mapUrl(point: Point) {
    coordinates.parse(point);
    return this.placeMapUrl
      .replace('{longitude}', String(point.longitude))
      .replace('{latitude}', String(point.latitude));
  }
  fallbackUrl(_input: ReportInput) {
    return this.reportFormUrl;
  }
  reportUrl(_id: string): string {
    throw new Error('Public report linking is not supported for this municipality.');
  }
  geocode(query: string) {
    return new CityClient(this.request).geocode(query);
  }
  async categories() {
    return categories(
      await new Session(this.tenant, this.request).read(endpoint(this.tenant)),
      this.tenant,
    );
  }
  async requirements(point: Point): Promise<Record<string, Requirements>> {
    coordinates.parse(point);
    const municipality = await this.places.municipality(point);
    if (municipality?.bfs_id !== this.bfsId)
      throw new Error('The exact location is outside this municipality.');
    const session = new Session(this.tenant, this.request);
    const cats = categories(await session.read(endpoint(this.tenant)), this.tenant);
    const url = new URL('/appl/api.php', this.tenant.origin);
    url.search = new URLSearchParams({
      outputType: 'json',
      do: 'usercontentCheckRadius',
      radius: this.tenant.radius,
      clat: this.tenant.clat,
      clong: this.tenant.clong,
      lat: String(point.latitude),
      long: String(point.longitude),
      checkoutofrange: '1',
      usmid: this.tenant.usmid,
      usid: this.tenant.usid,
      addcloser: 'true',
    }).toString();
    const result = JSON.parse((await session.read(url, {}, false)).body);
    if (!result || result.msg !== '' || Object.keys(result).some((k) => k !== 'msg'))
      throw new Error('Municipal location check did not confirm this point.');
    return Object.fromEntries(
      cats.map((c) => [
        c.service_name,
        {
          photo_required: false,
          phone_required: false,
          max_photos: 1,
          bodies: [this.municipality],
          extra_fields: [
            {
              code: 'report_title',
              description: 'Report title (German)',
              required: true,
              datatype: 'string',
              max_length: 100,
            },
            {
              code: 'street',
              description: 'Issue street (optional)',
              required: false,
              datatype: 'string',
              max_length: 250,
            },
            {
              code: 'postcode',
              description: 'Issue postcode (optional)',
              required: false,
              datatype: 'string',
              max_length: 20,
            },
            {
              code: 'place',
              description: 'Issue locality (optional)',
              required: false,
              datatype: 'string',
              max_length: 100,
            },
            {
              code: 'notify_updates',
              description: 'Email updates: yes or no (default no)',
              required: false,
              datatype: 'string',
              values: ['yes', 'no'],
            },
          ],
        },
      ]),
    );
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Public report lookup is not supported for this municipality.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Public tracking is not supported for this municipality.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Duplicate search is unavailable; check the official Stadtmelder.');
  }
  async submit(preview: Prepared): Promise<{ state: 'unknown' }> {
    if (this.submissionMode !== 'direct')
      throw new Error('Direct submission is disabled for this municipality.');
    if (
      !preview.destination ||
      !sameDestination(preview.destination, destinationFor(this)) ||
      preview.terms_url !== this.termsUrl
    )
      throw new Error('Preview destination or terms do not match.');
    const { input, photos } = preview;
    if (photos.length > 1 || !input.extra_fields.report_title || !input.email)
      throw new Error('Incomplete Anthrazit preview.');
    const session = new Session(this.tenant, this.request);
    const cats = categories(await session.read(endpoint(this.tenant)), this.tenant);
    const category = cats.find((c) => c.service_name === input.category);
    if (!category) throw new Error('Municipal category changed.');
    let page = await session.read(endpoint(this.tenant, 1, category.service_code));
    const location = form(page, this.tenant, 2, [
      'stepback',
      'foo',
      'latitude',
      'longitude',
      'submit',
    ]);
    page = await session.read(location.url, {
      method: 'POST',
      body: body(
        {
          stepback: '',
          foo: '',
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          submit: 'Weiter',
        },
        location.multipart,
      ),
    });
    let upload = form(page, this.tenant, 3, ['stepback', 'submit']);
    const imageCount = () =>
      nodes(upload.doc).filter((n) => hasClass(n, 'image') && 'tagName' in n).length;
    if (imageCount() !== 0) throw new Error('Municipal session already contains an image.');
    if (photos.length) {
      const scripts = elements(upload.doc, 'script').map(text).join('\n');
      const match = scripts.match(/url:\s*['"]([^'"]*userContentHandleImageUpload[^'"]*)['"]/);
      if (
        !match ||
        !/paramName:\s*['"]img['"]/.test(scripts) ||
        !/maxFilesize:\s*15\b/.test(scripts)
      )
        throw new Error('Municipal upload contract changed.');
      const url = new URL(match[1], page.url);
      if (
        url.origin !== this.tenant.origin ||
        url.pathname !== '/appl/api.php' ||
        url.searchParams.get('do') !== 'userContentHandleImageUpload' ||
        url.searchParams.get('usmid') !== this.tenant.usmid ||
        url.searchParams.get('usid') !== this.tenant.usid ||
        url.searchParams.get('outputType') !== 'json' ||
        [...url.searchParams.keys()].length !== 4
      )
        throw new Error('Unexpected municipal upload destination.');
      const bytes = Buffer.from(photos[0].jpeg, 'base64');
      if (!bytes.length || bytes.length > 15_000_000)
        throw new Error('Photo exceeds the supported upload size.');
      const data = new FormData();
      data.set('img', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'report.jpg');
      const result = JSON.parse(
        (await session.read(url, { method: 'POST', body: data }, false)).body,
      );
      if (
        !result ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        (result.error !== undefined && result.error !== '')
      )
        throw new Error('Municipal upload was not confirmed.');
      page = await session.read(upload.url);
      upload = form(page, this.tenant, 3, ['stepback', 'submit']);
      if (imageCount() !== 1)
        throw new Error('Uploaded image was not confirmed in the municipal session.');
    }
    page = await session.read(upload.url, {
      method: 'POST',
      body: body({ stepback: '', submit: 'Weiter' }, upload.multipart),
    });
    const details = form(page, this.tenant, 4, [
      'stepback',
      'objekttitel',
      'objekttext',
      'addresse1',
      'plz',
      'ort',
      'telefon',
      'email',
      'notification',
      'submit',
    ]);
    const fields: Record<string, string> = {
      stepback: '',
      objekttitel: input.extra_fields.report_title,
      objekttext: input.description,
      addresse1: input.extra_fields.street ?? '',
      plz: input.extra_fields.postcode ?? '',
      ort: input.extra_fields.place ?? '',
      telefon: [input.name, input.phone].filter(Boolean).join('\n'),
      email: input.email,
      submit: 'Weiter',
    };
    if (input.extra_fields.notify_updates === 'yes') fields.notification = '1';
    page = await session.read(details.url, {
      method: 'POST',
      body: body(fields, details.multipart),
    });
    const final = form(page, this.tenant, 5, ['stepback', 'proceed']);
    const visible = normalized(text(final.node));
    if (
      nodes(final.doc).some((n) => hasClass(n, 'elementAlert')) ||
      ![fields.objekttitel, fields.objekttext, input.category].every((v) =>
        visible.includes(normalized(v)),
      )
    )
      throw new Error('Municipal preview did not match the approved report.');
    const terms = elements(final.node, 'a').some((a) => {
      const href = attr(a, 'href');
      return href && new URL(href, page.url).href === preview.terms_url;
    });
    const send = final.controls.some(
      (n) => attr(n, 'type') === 'submit' && attr(n, 'value') === 'Absenden' && !attr(n, 'name'),
    );
    if (!terms || !send) throw new Error('Municipal send contract changed.');
    await session.read(
      final.url,
      { method: 'POST', body: body({ stepback: '', proceed: '' }, final.multipart) },
      false,
    );
    // No success response has been observed for a genuine approved report.
    // An HTTP 200/redirect alone must never be reported as acceptance.
    return { state: 'unknown' };
  }
}
