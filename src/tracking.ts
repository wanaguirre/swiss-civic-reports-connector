import { distance, SUBMISSION_INTERFACE, type CityClient } from './city.js';
import { CITY, type Receipt, type ReceiptSummary, type Tracking } from './model.js';
import { hash } from './photos.js';
import type { Store } from './store.js';

// Follows sent reports in the municipality's public Open311 list. It reads only
// what the city publishes for everyone: never the resident's email, and never
// the write route. Unconfirmed reports are absent from the list until the
// resident clicks the city's email link and the city publishes them.
const RECHECK_MS = 10 * 60_000;
const SEARCH_MS = 30 * 86400_000;
export const CLOCK_SKEW_MS = 10 * 60_000;
const RADIUS_M = 30;
const MAX_LOOKUPS = 10;
const MAX_REPLY = 2000;

export const textHash = (text: string) => hash(text.replace(/\s+/g, ' ').trim());
type Published = Awaited<ReturnType<CityClient['reports']>>[number];

function published(report: Published, at: string, matched_by: Tracking['matched_by']): Tracking {
  const reply = report.service_notice?.trim();
  return {
    checked_at: at,
    status: report.status,
    matched_by,
    ...(report.requested_datetime ? { published_at: report.requested_datetime } : {}),
    ...(report.updated_datetime ? { updated_at: report.updated_datetime } : {}),
    ...(report.agency_sent_datetime ? { forwarded_at: report.agency_sent_datetime } : {}),
    ...(reply ? { reply: reply.slice(0, MAX_REPLY) } : {}),
  };
}

// An older receipt kept no details. Once its number is linked, the city's public
// record supplies the category, position and published text; it has no street label.
function publicSummary(city: CityClient, report: Published): ReceiptSummary | undefined {
  if (report.lat === undefined || report.long === undefined || !report.service_code)
    return undefined;
  const detail = report.detail?.trim() ?? '';
  return {
    municipality: {
      bfs_id: city.bfsId,
      name: city.municipality,
      reporting_service: city.reportingService,
    },
    category: report.service_code,
    location_label: '',
    latitude: report.lat,
    longitude: report.long,
    text_sha256: textHash(detail),
    ...(detail ? { description: detail } : {}),
    source: 'public',
  };
}

// The exact text identifies the report. A moderator may edit the text, so the
// place alone is accepted only when one report sent through this client is
// there in the same category and nothing else could be it.
function find(receipt: Receipt, reports: Published[], taken: Set<string>) {
  const summary = receipt.summary!,
    since = Date.parse(receipt.created_at) - CLOCK_SKEW_MS;
  const nearby = reports.filter(
    (r) =>
      !taken.has(r.service_request_id) &&
      r.lat !== undefined &&
      r.long !== undefined &&
      (!r.interface_used || r.interface_used === SUBMISSION_INTERFACE) &&
      (!r.requested_datetime || Date.parse(r.requested_datetime) >= since) &&
      distance(summary, { latitude: r.lat, longitude: r.long }) <= RADIUS_M,
  );
  const byText = nearby.filter(
    (r) => r.detail !== undefined && textHash(r.detail) === summary.text_sha256,
  );
  if (byText.length === 1) return { report: byText[0], by: 'text' as const };
  if (byText.length || nearby.length !== 1) return undefined;
  const [only] = nearby;
  return only.interface_used === SUBMISSION_INTERFACE && only.service_code === summary.category
    ? { report: only, by: 'place' as const }
    : undefined;
}

export async function track(
  city: CityClient,
  store: Store,
  receipts: Receipt[],
): Promise<{ receipts: Receipt[]; complete: boolean }> {
  const now = store.now(),
    at = new Date(now).toISOString(),
    age = (r: Receipt) => now - Date.parse(r.created_at);
  const checked = (r: Receipt) => (r.tracking ? Date.parse(r.tracking.checked_at) : 0);
  // A linked number lets an older receipt without a summary be followed; such
  // receipts could only have gone to the first connected municipality.
  const due = (r: Receipt) =>
    (r.summary ? r.summary.municipality.bfs_id === city.bfsId : !!r.report_id) &&
    r.state !== 'rejected' &&
    // A recent claim still belongs to its submission, which writes the result.
    (r.state !== 'sending' || age(r) > 3600_000) &&
    r.tracking?.status !== 'closed' &&
    (!!r.report_id || age(r) <= SEARCH_MS) &&
    now - checked(r) >= RECHECK_MS;
  const pending = receipts.filter(due),
    updated = new Map<string, Receipt>();
  let complete = true;
  for (const receipt of pending
    .filter((r) => r.report_id)
    .sort((a, b) => checked(a) - checked(b))
    .slice(0, MAX_LOOKUPS)) {
    try {
      const report = await city.report(receipt.report_id!);
      const summary = report && !receipt.summary ? publicSummary(city, report) : undefined;
      updated.set(receipt.fingerprint, {
        ...receipt,
        ...(summary ? { summary } : {}),
        tracking: report
          ? published(report, at, receipt.tracking?.matched_by ?? 'id')
          : { ...receipt.tracking, checked_at: at },
      });
    } catch {
      complete = false;
    }
  }
  const unnumbered = pending.filter((r) => !r.report_id);
  if (unnumbered.length) {
    try {
      const since = new Date(
        Math.min(...unnumbered.map((r) => Date.parse(r.created_at))) - CLOCK_SKEW_MS,
      ).toISOString();
      const reports = await city.reports({ since, limit: 1000 });
      const taken = new Set(receipts.flatMap((r) => (r.report_id ? [r.report_id] : [])));
      for (const receipt of unnumbered) {
        const match = find(receipt, reports, taken);
        if (!match) {
          updated.set(receipt.fingerprint, { ...receipt, tracking: { checked_at: at } });
          continue;
        }
        const id = match.report.service_request_id;
        taken.add(id);
        updated.set(receipt.fingerprint, {
          ...receipt,
          report_id: id,
          url: `${CITY}/report/${id}`,
          tracking: published(match.report, at, match.by),
        });
      }
    } catch {
      complete = false;
    }
  }
  for (const receipt of updated.values())
    updated.set(receipt.fingerprint, await store.saveReceipt(receipt));
  return { receipts: receipts.map((r) => updated.get(r.fingerprint) ?? r), complete };
}
