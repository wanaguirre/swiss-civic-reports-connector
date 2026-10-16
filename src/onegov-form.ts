import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Prepared } from './model.js';
import { inspectEbikonForm } from './ebikon-form.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const all = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(all) : []),
];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
const text = (n: Node): string =>
  'value' in n ? n.value : 'childNodes' in n ? n.childNodes.map(text).join(' ') : '';
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const cls = (n: Element, c: string) => (attr(n, 'class') ?? '').split(/\s+/).includes(c);
const changed = () =>
  new Error('The OneGov form contract changed or is unavailable. Sending is paused.');
const uuid = '[a-f0-9]{32}';
export type OneGovName = 'ebikon' | 'meggen';
export const oneGovProfiles = {
  ebikon: {
    origin: 'https://www.ebikon.ch',
    path: '/form/schaden-melden',
    title: 'Schaden melden',
    first: 'personalien_vorname',
    last: 'personalien_name',
    email: 'personalien_e_mail',
    phone: 'personalien_telefon',
    location: 'wo_befindet_sich_der_schaden_strasse_hausnummer_oder_genaue_beschreibung_des_ortes_',
    description: 'wo_befindet_sich_der_schaden_beschreiben_sie_den_schaden_moglichst_genau_',
    photo: 'foto_hochladen_ein_foto_hilft_uns_den_schaden_zu_beurteilen_',
  },
  meggen: {
    origin: 'https://www.meggen.ch',
    path: '/form/meldung-sicherheitsproblem',
    title: 'Meldung Sicherheitsproblem',
    first: 'kontaktangaben_vorname',
    last: 'kontaktangaben_name',
    email: 'kontaktangaben_e_mail',
    phone: 'kontaktangaben_telefon',
    location: 'sicherheitsproblem_standortbeschrieb',
    description: 'sicherheitsproblem_detailbeschrieb',
    photo: 'sicherheitsproblem_foto',
  },
} as const;

export function inspectMeggenForm(html: string) {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const page = all(parse(html)),
    forms = page.filter((n) => n.tagName === 'form' && attr(n, 'id') === 'main-form');
  if (forms.length !== 1) throw changed();
  const form = forms[0],
    nodes = all(form),
    config = oneGovProfiles.meggen;
  if (
    attr(form, 'method')?.toLowerCase() !== 'post' ||
    attr(form, 'enctype') !== 'multipart/form-data' ||
    new URL(attr(form, 'action') ?? '', config.origin + config.path).href !==
      config.origin + config.path
  )
    throw changed();
  if (
    page.some((n) => attr(n, 'form') === 'main-form') ||
    nodes.some(
      (n) =>
        ['iframe', 'object'].includes(n.tagName) ||
        /captcha|turnstile|challenge/i.test(
          ['name', 'class', 'id', 'src'].map((k) => attr(n, k)).join(' '),
        ) ||
        (n.tagName === 'fieldset' && attr(n, 'disabled') !== undefined),
    )
  )
    throw changed();
  const controls = nodes.filter((n) =>
    ['input', 'select', 'textarea', 'button'].includes(n.tagName),
  );
  const defs: [string, string, boolean][] = [
    ['csrf_token', 'hidden', false],
    [config.first, 'text', true],
    [config.last, 'text', true],
    [config.email, 'email', true],
    [config.phone, 'text', false],
    ['sicherheitsproblem_adresse_grundstucknummer', 'text', false],
    [config.location, 'textarea', false],
    [config.description, 'textarea', false],
    [config.photo, 'file', false],
    ['duplicate_of', 'text', false],
  ];
  if (controls.length !== defs.length + 1) throw changed();
  for (const [name, type, required] of defs) {
    const found = controls.filter((n) => attr(n, 'name') === name);
    if (found.length !== 1) throw changed();
    const n = found[0];
    if (
      (n.tagName === 'input' ? attr(n, 'type') : n.tagName) !== type ||
      (attr(n, 'aria-required') !== undefined) !== required ||
      attr(n, 'maxlength') !== undefined
    )
      throw changed();
    if (name === 'csrf_token' && !/^[a-zA-Z0-9_#.-]{20,500}$/.test(attr(n, 'value') ?? ''))
      throw changed();
    if (type === 'file' && attr(n, 'accept') !== 'application/pdf,image/jpeg,image/png,image/gif')
      throw changed();
    if (name === 'duplicate_of' && (attr(n, 'value') !== '' || attr(n, 'class') !== 'lazy-wolves'))
      throw changed();
  }
  for (const n of controls)
    if (
      ['disabled', 'readonly', 'form', 'formaction', 'multiple', 'required', 'checked'].some(
        (k) => attr(n, k) !== undefined,
      )
    )
      throw changed();
  const submit = controls.filter((n) => attr(n, 'type') === 'submit');
  if (
    submit.length !== 1 ||
    attr(submit[0], 'name') !== undefined ||
    attr(submit[0], 'value') !== 'Weiter'
  )
    throw changed();
  return [{ service_code: 'sicherheitsproblem', service_name: config.title }];
}

type ReviewField = { label: string; value: string; photo?: boolean };
/** Build the first POST only from the frozen preview; no network or retained tokens. */
function payload(name: OneGovName, html: string, preview: Prepared) {
  if (name === 'ebikon') inspectEbikonForm(html);
  else inspectMeggenForm(html);
  const config = oneGovProfiles[name],
    doc = all(parse(html));
  const form = doc.find((n) => n.tagName === 'form' && attr(n, 'id') === 'main-form')!,
    nodes = all(form);
  const values: Record<string, string> = {
    [config.first]: preview.input.extra_fields.first_name,
    [config.last]: preview.input.extra_fields.last_name,
    [config.email]: preview.input.email,
    [config.phone]: preview.input.phone ?? '',
    [config.location]: preview.input.location_label,
    [config.description]: preview.input.description,
  };
  if (name === 'ebikon') {
    values.was_mochten_sie_melden_auswahl = preview.input.category;
    values.was_mochten_sie_melden_auswahl_beschrieb = preview.input.extra_fields.other_damage ?? '';
  } else
    values.sicherheitsproblem_adresse_grundstucknummer =
      preview.input.extra_fields.parcel_address ?? '';
  const body = new FormData(),
    expected: ReviewField[] = [];
  for (const [key, value] of Object.entries(values)) {
    body.set(key, value);
    if (value) expected.push({ label: label(key), value });
  }
  body.set(
    'csrf_token',
    attr(
      nodes.find((n) => attr(n, 'name') === 'csrf_token')!,
      'value',
    )!,
  );
  body.set('duplicate_of', '');
  if (preview.photos.length) {
    const photo = preview.photos[0],
      bytes = Buffer.from(photo.jpeg, 'base64');
    if (
      bytes.length < 3 ||
      bytes.length > 5_000_000 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255 ||
      createHash('sha256').update(bytes).digest('hex') !== photo.sha256
    )
      throw new Error('Preview photo integrity check failed.');
    body.set(config.photo, new Blob([bytes], { type: 'image/jpeg' }), 'civic-report.jpg');
    expected.push({ label: label(config.photo), value: 'civic-report.jpg', photo: true });
  }
  function label(key: string) {
    const wrappers = nodes.filter((n) => cls(n, `field-${key}`));
    if (wrappers.length !== 1) throw changed();
    const spans = all(wrappers[0]).filter((n) => cls(n, 'label-text'));
    if (spans.length !== 1) throw changed();
    const value = norm(text(spans[0]));
    if (!value) throw changed();
    return value;
  }
  return { body, expected };
}

/** A review page is not acceptance. Match every echoed field before finalizing. */
function inspectReview(html: string, previewUrl: string, expected: ReviewField[]) {
  const page = all(parse(html)),
    containers = page.filter((n) => cls(n, 'fieldset-display'));
  if (
    containers.length !== 1 ||
    page.some(
      (n) =>
        cls(n, 'error') ||
        /captcha|turnstile|challenge/i.test(
          ['name', 'class', 'id', 'src'].map((k) => attr(n, k)).join(' '),
        ),
    )
  )
    throw changed();
  const rows = all(containers[0]).filter((n) => n.tagName === 'dl' && cls(n, 'field-display'));
  if (rows.length !== expected.length) throw changed();
  const remaining = [...expected];
  for (const row of rows) {
    const ns = all(row),
      labels = ns.filter((n) => n.tagName === 'dt'),
      data = ns.filter((n) => n.tagName === 'dd');
    if (labels.length !== 1 || data.length !== 1) throw changed();
    const label = norm(text(labels[0])),
      value = norm(text(data[0])),
      i = remaining.findIndex((e) => norm(e.label) === label);
    if (i < 0) throw changed();
    const e = remaining.splice(i, 1)[0];
    if (
      e.photo
        ? !/^civic-report\.jpg \([\d.,]+ (?:Byte|Bytes|kB|MB)\)$/.test(value)
        : norm(e.value) !== value
    )
      throw changed();
  }
  const checkouts = page.filter((n) => n.tagName === 'form' && cls(n, 'checkout'));
  if (checkouts.length !== 1) throw changed();
  const checkout = checkouts[0],
    controls = all(checkout).filter((n) =>
      ['input', 'select', 'textarea', 'button'].includes(n.tagName),
    );
  if (
    attr(checkout, 'method')?.toLowerCase() !== 'post' ||
    new URL(attr(checkout, 'action') ?? '', previewUrl).href !== previewUrl + '/complete' ||
    controls.length !== 2 ||
    page.some((n) => attr(n, 'form') && attr(n, 'form') === attr(checkout, 'id'))
  )
    throw changed();
  const choice = controls.find((n) => attr(n, 'name') === 'send_by_email'),
    button = controls.find((n) => attr(n, 'type') === 'submit');
  if (
    !choice ||
    attr(choice, 'type') !== 'checkbox' ||
    attr(choice, 'value') !== 'yes' ||
    !button ||
    attr(button, 'name') !== undefined ||
    !['Abschliessen', 'Abschließen', 'Complete'].includes(attr(button, 'value') ?? '') ||
    controls.some((n) =>
      ['disabled', 'formaction', 'form', 'required'].some((k) => attr(n, k) !== undefined),
    )
  )
    throw changed();
  // Do not opt the resident into emailing a copy of their entered personal data.
  // OneGov sends the ticket reference even when send_by_email is absent.
  return previewUrl + '/complete';
}

export function oneGovReportUrl(name: OneGovName, id: string) {
  if (!new RegExp(`^${uuid}$`).test(id)) throw new Error('Invalid OneGov receipt identifier.');
  return `${oneGovProfiles[name].origin}/ticket/FRM/${id}/status`;
}
function receipt(html: string, name: OneGovName) {
  const page = all(parse(html)),
    numbers = page.filter((n) => cls(n, 'ticket-number')),
    states = page.filter((n) => cls(n, 'ticket-state'));
  return (
    numbers.length === 1 &&
    /^FRM-[A-Z0-9-]{3,80}$/.test(norm(text(numbers[0]))) &&
    states.length === 1 &&
    all(states[0]).filter((n) =>
      ['open', 'pending', 'closed', 'archived'].some((s) => cls(n, `ticket-state-${s}`)),
    ).length === 1 &&
    page.some((n) => cls(n, 'ticket-title') && norm(text(n)) === oneGovProfiles[name].title)
  );
}

/** Source-reviewed OneGov 2026.52 contract. No retries, redirects or automatic recovery.
 * The caller must hold the durable send claim and explicit frozen-preview approval.
 * Only a ticket status page is acceptance; upload or preview success never is. */
export async function submitOneGov(
  name: OneGovName,
  preview: Prepared,
  request: typeof fetch,
  now: () => number,
  cooldown: (delay: number) => void,
) {
  const config = oneGovProfiles[name],
    origin = config.origin,
    formUrl = origin + config.path;
  const cookies = new Map<string, string>();
  const started = now();
  let wrote = false;
  async function call(url: string, method = 'GET', body?: FormData | URLSearchParams) {
    if (
      new URL(url).origin !== origin ||
      now() - started > 90_000 ||
      Date.parse(preview.expires_at) <= now()
    )
      throw changed();
    const response = await request(url, {
      method,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Civic approved municipal report',
        Origin: origin,
        Referer: formUrl,
        ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
    });
    if (response.status === 429 || response.status === 503) {
      const header = response.headers.get('retry-after') ?? '';
      const delay = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - now();
      cooldown(Number.isFinite(delay) ? Math.max(300_000, delay) : 300_000);
    }
    try {
      for (const raw of response.headers.getSetCookie()) {
        const parts = raw.split(';').map((s) => s.trim()),
          split = parts[0].indexOf('='),
          key = parts[0].slice(0, split),
          value = parts[0].slice(split + 1);
        if (
          split < 1 ||
          !/^[\w.-]{1,100}$/.test(key) ||
          !/^[\x21-\x3A\x3C-\x7E]{0,4000}$/.test(value)
        )
          throw changed();
        const domain = parts
            .find((s) => /^domain=/i.test(s))
            ?.slice(7)
            .replace(/^\./, ''),
          path = parts.find((s) => /^path=/i.test(s))?.slice(5);
        if (
          (domain &&
            domain !== new URL(origin).hostname &&
            domain !== new URL(origin).hostname.replace(/^www\./, '')) ||
          (path && path !== '/')
        )
          throw changed();
        if (parts.some((s) => /^max-age=0$/i.test(s)) || !value) cookies.delete(key);
        else cookies.set(key, value);
        if (cookies.size > 8) throw changed();
      }
    } catch (error) {
      await response.body?.cancel().catch(() => {});
      throw error;
    }
    return response;
  }
  async function html(r: Response) {
    if (!r.ok || !/^text\/html(?:;|$)/i.test(r.headers.get('content-type') ?? '') || !r.body) {
      await r.body?.cancel();
      throw changed();
    }
    const chunks: Uint8Array[] = [],
      reader = r.body.getReader();
    let size = 0;
    try {
      for (;;) {
        const p = await reader.read();
        if (p.done) break;
        size += p.value.byteLength;
        if (size > 1_000_000) throw changed();
        chunks.push(p.value);
      }
      return Buffer.concat(chunks).toString('utf8');
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  async function redirect(r: Response, pattern: RegExp) {
    const location = r.headers.get('location');
    await r.body?.cancel();
    if (![302, 303].includes(r.status) || !location) throw changed();
    const url = new URL(location, origin);
    if (url.origin !== origin || url.search || url.hash || !pattern.test(url.pathname))
      throw changed();
    return url.href;
  }
  try {
    const initial = await html(await call(formUrl)),
      { body, expected } = payload(name, initial, preview);
    wrote = true;
    const pending = await redirect(
      await call(formUrl, 'POST', body),
      new RegExp(`^/form-preview/${uuid}$`),
    );
    const review = await html(await call(pending));
    const complete = inspectReview(review, pending, expected);
    const status = await redirect(
      await call(complete, 'POST', new URLSearchParams()),
      new RegExp(`^/ticket/FRM/${uuid}/status$`),
    );
    if (!receipt(await html(await call(status)), name)) throw changed();
    return { state: 'accepted' as const, report_id: new URL(status).pathname.split('/')[3] };
  } catch {
    // Even the first POST persists a pending upload. Never replay it after loss of response.
    return { state: wrote ? ('unknown' as const) : ('rejected' as const) };
  } finally {
    cookies.clear();
  }
}
