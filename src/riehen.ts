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
import { WeblicationReader } from './weblication-reader.js';
import {
  inspectWeblicationUploader,
  zuchwilUploadedFilename,
  type ZuchwilSubmissionPlan,
} from './zuchwil.js';
const ORIGIN = 'https://www.riehen.ch';
const FORM = `${ORIGIN}/verwaltung/formulare/meldung-schaeden.php`;
// The form itself displays and links BOTH policies in its consent statement.
const TERMS = FORM;
const UPLOADER = '/weblication/grid5/scripts/wUploader.php';
export const riehenCategories = {
  damage: 'Schäden und Mängel an der Infrastruktur der Gemeinde',
  graffiti: 'Verschmierung an öffentlichen Liegenschaften in Riehen',
} as const;
const surfaces = [
  'Strassenfassade',
  'Seitenfassade',
  'Mauer',
  'Sockelbereich',
  'Geländer, Gitter',
  'Fenster, Tür, Tor',
  'Säule, Stütze',
  'Vitrinen, Kasten',
];
const roles = ['Spraymelder/in', 'Eigentümer/in'];
const changed = () =>
  new Error(
    'Riehen is unavailable or its anonymous form contract has changed. Preparation is paused.',
  );
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: Element, key: string) => n.attrs.find((a) => a.name === key)?.value;
const sameOrigin = (path: string) => {
  const url = new URL(path, ORIGIN);
  if (url.origin !== ORIGIN || url.username || url.password || url.hash) throw changed();
  return url;
};
const token = (s?: string) => {
  if (!s || !/^[a-zA-Z0-9_-]{16,256}$/.test(s)) throw changed();
  return s;
};
type FormSession = {
  action: string;
  token: string;
  sessionId: string;
  uploadUrl: string;
  formId: string;
  visitorId: string;
};
/** Ephemeral session secrets; never persist, log or expose them to clients. */
export function inspectRiehenForm(html: string): FormSession {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const page = all(parse(html)),
    forms = page.filter(
      (n) => n.tagName === 'form' && all(n).some((c) => attr(c, 'name') === 'meldung-schaden[]'),
    );
  if (forms.length !== 1) throw changed();
  const form = forms[0],
    nodes = all(form),
    action = sameOrigin(attr(form, 'action') ?? '');
  if (
    !/^\/weblication\/grid5\/tmpHTTP\/wForm-[a-f0-9]{32}-[a-f0-9]{32}\.php$/.test(
      action.pathname,
    ) ||
    action.search ||
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    attr(form, 'target') !== '_self'
  )
    throw changed();
  const active = [...nodes, ...page.filter((n) => ['script', 'iframe'].includes(n.tagName))];
  if (
    active.some(
      (n) =>
        /captcha|turnstile|challenge/i.test(
          ['src', 'class', 'id', 'name'].map((k) => attr(n, k)).join(' '),
        ) && n.tagName !== 'style',
    ) ||
    nodes.some((n) => n.tagName === 'fieldset' && attr(n, 'disabled') !== undefined)
  )
    throw changed();
  if (attr(form, 'id') && page.some((n) => attr(n, 'form') === attr(form, 'id'))) throw changed();
  // Validate branch ancestry as well as names. Moving the photo into another
  // branch must not silently change what a resident's preview promises.
  const branch = (n: Node): string => {
    const conditions: string[] = [];
    for (let p: Node | null = n; p && p !== form; p = 'parentNode' in p ? p.parentNode : null) {
      if ('tagName' in p && attr(p, 'data-conditionalformdata'))
        conditions.push(attr(p, 'data-conditionalformdata')!);
    }
    const distinct = [...new Set(conditions)];
    if (distinct.length > 1) throw changed();
    if (!distinct.length) return '';
    const found = Object.values(riehenCategories).find(
      (v) => distinct[0] === `type:or;operator:or;conditions:meldung-schaden=='${v}'`,
    );
    if (!found) throw changed();
    return found;
  };
  for (const n of nodes) if (attr(n, 'data-conditionalformdata')) branch(n);
  const controls = nodes.filter((n) =>
    ['input', 'textarea', 'select', 'button', 'iframe', 'object'].includes(n.tagName),
  );
  const expected: [string, string, string | undefined, string, string[]?][] = [
    ...['firstname', 'lastname', 'street', 'plz', 'Ort', 'telephone'].map(
      (n) => [n, 'text', 'required', ''] as [string, string, string, string],
    ),
    ['email', 'text', 'email', ''],
    ['postfach', 'text', undefined, ''],
    ['WSESSIONID', 'hidden', undefined, ''],
    ['wFormToken', 'hidden', undefined, ''],
    ['meldung-schaden[]', 'checkbox', 'required', '', Object.values(riehenCategories)],
    ['beschreibung-schaden', 'textarea', 'required', riehenCategories.damage],
    ...['strasse-objekt', 'ort-objekt', 'name-spray'].map(
      (n) => [n, 'text', 'required', riehenCategories.graffiti] as [string, string, string, string],
    ),
    ['lagebeschreibung', 'text', undefined, riehenCategories.graffiti],
    ['mailspray', 'text', 'email', riehenCategories.graffiti],
    ['art-verschmierung[]', 'checkbox', 'required', riehenCategories.graffiti, surfaces],
    ['radio-spraymelder', 'radio', 'required', riehenCategories.graffiti, roles],
    ['foto', 'hidden', undefined, riehenCategories.graffiti],
    ['bemerkungen', 'textarea', undefined, riehenCategories.graffiti],
    ['datenschutz-akzeptiert[]', 'checkbox', 'required', '', ['Ja']],
    ['subject-4', 'text', "pregMatch('^$')", ''],
  ];
  if (controls.length !== expected.reduce((n, e) => n + (e[4]?.length ?? 1), 0) + 2)
    throw changed();
  for (const [name, type, validator, scope, values] of expected) {
    const found = controls.filter((n) => attr(n, 'name') === name);
    if (found.length !== (values?.length ?? 1)) throw changed();
    const actual = found.map((n) => attr(n, 'value') ?? '');
    if (
      values &&
      (new Set(actual).size !== values.length || values.some((v) => !actual.includes(v)))
    )
      throw changed();
    for (const n of found) {
      if (
        (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
        attr(n, 'data-validators') !== validator ||
        branch(n) !== scope ||
        ['disabled', 'readonly', 'form', 'formaction', 'maxlength', 'required', 'checked'].some(
          (k) => attr(n, k) !== undefined,
        )
      )
        throw changed();
      if (type === 'hidden' && name === 'foto' && attr(n, 'value') !== '') throw changed();
    }
  }
  const buttons = controls.filter((n) => n.tagName === 'button'),
    frames = controls.filter((n) => n.tagName === 'iframe');
  if (
    buttons.length !== 1 ||
    attr(buttons[0], 'type') !== 'submit' ||
    ['name', 'formaction', 'disabled', 'form'].some((k) => attr(buttons[0], k) !== undefined) ||
    branch(buttons[0]) ||
    frames.length !== 1 ||
    attr(frames[0], 'srcdoc') !== undefined ||
    branch(frames[0]) !== riehenCategories.graffiti
  )
    throw changed();
  const links = nodes
    .filter((n) => n.tagName === 'a')
    .map((n) => sameOrigin(attr(n, 'href') ?? '').href)
    .sort();
  if (
    JSON.stringify(links) !==
    JSON.stringify([ORIGIN + '/datenschutz/', ORIGIN + '/datenschutz/nutzungsbedingungen.php'])
  )
    throw changed();
  const upload = sameOrigin(attr(frames[0], 'src') ?? '');
  if (
    upload.pathname !== UPLOADER ||
    [...upload.searchParams.keys()].sort().join(',') !==
      'action,element,form,lang,project,showThumbnails,uploaded,vid' ||
    upload.searchParams.get('action') !== 'showmaskuploadform' ||
    upload.searchParams.get('element') !== 'foto' ||
    upload.searchParams.get('project') !== '/de' ||
    upload.searchParams.get('lang') !== 'de' ||
    upload.searchParams.get('uploaded') !== '' ||
    upload.searchParams.get('showThumbnails') !== '1'
  )
    throw changed();
  const formId = upload.searchParams.get('form') ?? '';
  if (!/^[a-f0-9]{8}$/.test(formId)) throw changed();
  const value = (name: string) =>
    attr(
      controls.find((n) => attr(n, 'name') === name)!,
      'value',
    );
  const formToken = token(value('wFormToken'));
  if (!/^[a-f0-9]{32}$/.test(formToken)) throw changed();
  return {
    action: action.href,
    token: formToken,
    sessionId: token(value('WSESSIONID')),
    uploadUrl: upload.href,
    formId,
    visitorId: token(upload.searchParams.get('vid') ?? undefined),
  };
}
export function inspectRiehenUploader(html: string, form: FormSession) {
  try {
    return inspectWeblicationUploader(html, form, {
      version: '20',
      element: 'foto',
      userType: false,
      maxUploads: '',
      maxWidthImage: '20000',
      showThumbnails: '1',
    });
  } catch {
    throw changed();
  }
}
const field = (
  code: string,
  description: string,
  values?: string[],
): Requirements['extra_fields'][number] => ({
  code,
  description,
  required: true,
  datatype: 'string',
  max_length: 200,
  ...(values ? { values } : {}),
});
/** Public rule definitions; never resident contact values. One surface per report. */
export function riehenRequirements(): Record<string, Requirements> {
  const contact = [
    field('first_name', 'First name'),
    field('last_name', 'Last name'),
    field('contact_street', 'Your street and house number'),
    field('contact_postcode', 'Your postcode'),
    field('contact_city', 'Your town/city'),
    field('public_property', 'Confirm the affected property is public', ['yes']),
  ];
  for (const item of contact) if (item.code !== 'public_property') item.contact = true;
  const common: Requirements = {
    photo_required: false,
    email_required: true,
    phone_required: true,
    contact_fields: ['phone'],
    bodies: ['Riehen'],
    extra_fields: contact,
    notes: [
      'Erforderlich: Vorname, Nachname, Wohnadresse, Telefon und E-Mail. Keine Meldungen zu privaten Liegenschaften.',
      'Vor einer Übermittlung müssen Datenschutzerklärung und Nutzungsbedingungen der Gemeinde akzeptiert werden. Derzeit wird nichts übermittelt.',
    ],
  };
  return {
    [riehenCategories.damage]: {
      ...common,
      scope:
        'Damage or defects in municipal infrastructure. This branch has no photo attachment field.',
      max_photos: 0,
    },
    [riehenCategories.graffiti]: {
      ...common,
      scope:
        'Graffiti on public property in Riehen only. Select one affected surface and your role. Private-property graffiti is excluded.',
      max_photos: 1,
      max_photo_bytes: 1_999_999,
      extra_fields: [
        ...contact,
        field('object_street', 'Affected property: street and number'),
        field('graffiti_surface', 'Affected surface', surfaces),
        field('reporter_role', 'Your role', roles),
      ],
      notes: [
        ...common.notes!,
        'Civic unterstützt eine Oberfläche und ein optionales Foto unter 2 MB pro Meldung. Name und E-Mail der meldenden Person werden auch als Spraymelder/in bzw. Eigentümer/in verwendet.',
      ],
    },
  };
}
export type RiehenSubmissionPlan = ZuchwilSubmissionPlan;
type LocalRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: FormData | URLSearchParams;
};
export class RiehenClient implements ReportingAdapter {
  readonly bfsId = 2703;
  readonly municipality = 'Riehen';
  readonly serviceId = 'riehen-weblication';
  readonly deliveryLanguage = 'de' as const;
  readonly submissionMode = 'unverified' as const;
  readonly reportingService = 'Riehen Schadensmelder';
  readonly reportingUrl = FORM;
  readonly reportFormUrl = FORM;
  readonly termsUrl = TERMS;
  readonly placeMapUrl = 'https://map.geo.admin.ch/?center={longitude},{latitude}&z=10';
  readonly trackingSupported = false;
  readonly fallbackPrefilled = false;
  readonly privacy =
    'Preparation keeps photos, report text and contact details in Civic. Anonymous municipal form checks send none of these details. Uploads and municipal receipts remain unverified; nothing is sent.';
  readonly guidance = {
    municipality: 'Riehen',
    delivery_language: 'de' as const,
    verified_on: '2026-10-16',
    sources: [
      { title: 'Official Riehen damage and graffiti form', url: FORM },
      { title: 'Privacy', url: ORIGIN + '/datenschutz/' },
      { title: 'Terms of use', url: ORIGIN + '/datenschutz/nutzungsbedingungen.php' },
    ],
    scope:
      'Damage and defects in municipal infrastructure, or graffiti on public property in Riehen. These are separate report classes with different photo and extra-field rules.',
    issue_groups: Object.values(riehenCategories),
    exclusions: [
      {
        issue: 'Graffiti on private property',
        next_step:
          'Use Riehen’s separate private-property guidance; do not classify it as public graffiti.',
      },
      {
        issue: 'Emergency or immediate danger',
        next_step: 'Use the appropriate emergency service, not this maintenance form.',
      },
    ],
    responsibility:
      'The resident must confirm public ownership; do not infer it from a photo. One report class and one affected surface per report.',
    routing_note:
      'Read category requirements before drafting. General damage accepts no photo; public graffiti allows one optional photo under 2 MB through Civic. Required: first and last name, home address, phone and email. Do not invent contact details, ownership or the reporter’s role. Preparation only; acceptance and tracking remain unverified.',
  };
  private places: Pick<SwissPlaces, 'municipality'>;
  private now: () => number;
  private verifiedUntil = 0;
  private checking?: Promise<void>;
  private reader: WeblicationReader<FormSession>;
  constructor(
    private request: typeof fetch = fetch,
    options: { places?: Pick<SwissPlaces, 'municipality'>; now?: () => number } = {},
  ) {
    this.places = options.places ?? new SwissPlaces(request);
    this.now = options.now ?? Date.now;
    this.reader = new WeblicationReader(
      request,
      this.now,
      this.municipality,
      'riehen.ch',
      FORM,
      inspectRiehenForm,
      inspectRiehenUploader,
      changed,
      false,
    );
  }
  private async session() {
    try {
      const session = await this.reader.session();
      return session;
    } catch (error) {
      this.verifiedUntil = 0;
      throw error;
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
      throw new Error('The exact location is outside Riehen.');
  }
  async categories() {
    await this.verify();
    return Object.entries(riehenCategories).map(([service_code, service_name]) => ({
      service_code,
      service_name,
    }));
  }
  async requirements(
    point: Point,
    options: { fresh?: boolean } = {},
  ): Promise<Record<string, Requirements>> {
    await this.boundary(point);
    await this.verify(options.fresh);
    return riehenRequirements();
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
    throw new Error('Riehen report links and receipts are unverified.');
  }
  async reports(): ReturnType<CityClient['reports']> {
    throw new Error('Riehen public report lookup is unverified.');
  }
  async report(): ReturnType<CityClient['report']> {
    throw new Error('Riehen tracking is unverified.');
  }
  async nearby(): ReturnType<CityClient['nearby']> {
    throw new Error('Riehen duplicate lookup is unverified.');
  }

  /** Local contract plan only. Reads a fresh anonymous session; never dispatches
   * upload/preflight/finalization/form requests. Contains secrets: do not log,
   * persist, reuse across residents or expose through a client API. */
  async buildSubmission(
    preview: Prepared,
    acceptedTermsUrl: string,
  ): Promise<RiehenSubmissionPlan> {
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
      rule = riehenRequirements()[input.category];
    if (
      !rule ||
      !input.email ||
      !input.phone?.trim() ||
      input.name?.trim() ||
      Object.keys(input.extra_fields).some((k) => !rule.extra_fields.some((f) => f.code === k))
    )
      throw new Error('Riehen requires the reviewed report class and contact fields.');
    for (const field of rule.extra_fields) {
      const value = input.extra_fields[field.code];
      if (
        !value?.trim() ||
        value.length > (field.max_length ?? 500) ||
        (Array.isArray(field.values) && !field.values.includes(value))
      )
        throw new Error('Missing or unsupported Riehen field: ' + field.code);
    }
    const graffiti = input.category === riehenCategories.graffiti;
    if (
      preview.photos.length > (rule.max_photos ?? 0) ||
      input.photo_ids.length !== preview.photos.length ||
      preview.photos.some((p, i) => p.id !== input.photo_ids[i])
    )
      throw new Error('Riehen supports one matching preview photo at most.');
    const photos = preview.photos.map((p) => {
      const bytes = Buffer.from(p.jpeg, 'base64');
      if (
        bytes.length >= 2_000_000 ||
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
            }),
          }
        : {}),
      buildForm: (uploadedFilenames) => {
        if (this.now() >= expiresAt)
          throw new Error('Riehen plan expired. Obtain a fresh anonymous session.');
        if (
          uploadedFilenames.length !== photos.length ||
          new Set(uploadedFilenames).size !== uploadedFilenames.length ||
          uploadedFilenames.some((n) => zuchwilUploadedFilename(`&filename=${n}`) !== n)
        )
          throw new Error(
            'A matching verified upload filename is required for every preview photo.',
          );
        const body = new FormData();
        const e = input.extra_fields;
        const address = `${input.location_label}\nKoordinaten (WGS84): ${input.latitude}, ${input.longitude}`;
        const values: Record<string, string> = {
          firstname: e.first_name,
          lastname: e.last_name,
          street: e.contact_street,
          postfach: '',
          plz: e.contact_postcode,
          Ort: e.contact_city,
          telephone: input.phone!,
          email: input.email,
          WSESSIONID: session.sessionId,
          wFormToken: session.token,
          'meldung-schaden[]': input.category,
          'datenschutz-akzeptiert[]': 'Ja',
          'subject-4': '',
          'beschreibung-schaden': graffiti ? '' : `${input.description}\n\n${address}`,
          'strasse-objekt': graffiti ? e.object_street : '',
          'ort-objekt': graffiti ? 'Riehen' : '',
          lagebeschreibung: graffiti ? address : '',
          'name-spray': graffiti ? `${e.first_name} ${e.last_name}` : '',
          mailspray: graffiti ? input.email : '',
          foto: uploadedFilenames.join('|'),
          bemerkungen: graffiti ? input.description : '',
        };
        if (graffiti) {
          values['art-verschmierung[]'] = e.graffiti_surface;
          values['radio-spraymelder'] = e.reporter_role;
        }
        for (const [k, v] of Object.entries(values)) body.set(k, v);
        return { url: session.action, method: 'POST', headers: { ...headers }, body };
      },
    };
  }
  async submit(_preview: Prepared): Promise<{ state: 'unknown' }> {
    throw new Error(
      'Sending is disabled until Riehen upload and municipal receipt verification is complete.',
    );
  }
}
