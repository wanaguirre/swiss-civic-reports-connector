import { CityClient, SUBMISSION_INTERFACE } from './city.js';
import { Store } from './store.js';
import {
  coordinates,
  reportInput,
  fallbackUrl,
  mapUrl,
  CITY,
  type Point,
  type ReportInput,
  type Prepared,
  type ReceiptSummary,
  type Requirements,
} from './model.js';
import { importPhoto, thumbnail } from './photos.js';
import { CLOCK_SKEW_MS, textHash, track } from './tracking.js';
import type { Language } from './language.js';

const RESERVED_FIELDS = new Set([
  'service',
  'title',
  'detail',
  'category',
  'lat',
  'lon',
  'pc',
  'used_map',
  'may_show_name',
  'name',
  'email',
  'phone',
  'submit_register',
  'submit_sign_in',
  'username_register',
  'password_register',
  'password_sign_in',
  'upload_fileid',
  'submit_problem',
]);

/** Shared workflow boundary: validate live rules, freeze previews, and claim each submission before dispatch. */
export class ReportService {
  constructor(
    readonly city: CityClient,
    readonly store: Store,
    readonly options: { submissionEnabled: boolean; allowPaths: boolean },
  ) {}

  async inspectPhoto(input: { path?: string; base64?: string; capture_location?: Point }) {
    const photo = await importPhoto(input, this.options.allowPaths, this.store.now());
    if (!photo.gps && input.capture_location)
      photo.capture_location = coordinates.parse(input.capture_location);
    await this.store.savePhoto(photo);
    const { jpeg: _, ...metadata } = photo;
    return {
      metadata: {
        ...metadata,
        note: 'GPS is a suggestion; ask the user to confirm the exact issue location. Uploaded JPEG has no original EXIF metadata.',
      },
      image: await thumbnail(photo),
    };
  }
  private validate(
    input: ReportInput,
    requirements: Record<string, Requirements>,
    photoCount: number,
  ) {
    const rule = requirements[input.category];
    if (!rule)
      throw new Error(
        'Category is not available at this location. Use list_categories and resolve_location.',
      );
    if (rule.photo_required && !photoCount) throw new Error('This category requires a photo.');
    if (rule.phone_required && !input.phone)
      throw new Error('This category requires a contact phone number.');
    const fields = new Map(rule.extra_fields.map((field) => [field.code, field]));
    for (const [key, value] of Object.entries(input.extra_fields)) {
      if (RESERVED_FIELDS.has(key) || /^photo|^password|^submit_/i.test(key) || !fields.has(key))
        throw new Error(`Unsupported extra field: ${key}`);
      const field = fields.get(key)!;
      if (field.datatype && !['string', 'text'].includes(field.datatype))
        throw new Error(`Use the official form for this category's typed field: ${key}`);
      if (value.trim() && field.values)
        throw new Error(`Use the official form for the category's choice field: ${key}`);
    }
    for (const field of rule.extra_fields) {
      if (field.required && !input.extra_fields[field.code]?.trim())
        throw new Error(`Category requires extra field: ${field.code} (${field.description})`);
    }
    return rule;
  }
  present(preview: Prepared) {
    const { photo_ids: _, location_confirmed: __, ...input } = preview.input;
    return {
      preview_id: preview.id,
      confirmation_token: preview.confirmation_token,
      expires_at: preview.expires_at,
      report: input,
      attachments: preview.photos.map((p) => ({
        id: p.id,
        sha256: p.sha256,
        width: p.width,
        height: p.height,
      })),
      map_url: mapUrl(preview.input),
      official_form_url: fallbackUrl(preview.input),
      submission_enabled: this.options.submissionEnabled,
      confirmation_required:
        'Show the description, category, exact map location, contact details and ALL photos. Ask the user to approve this particular report before calling submit_report.',
      privacy:
        'Description and photos may be published by the city. Email, optional name and phone are sent to the city as contact details; this client requests that your name not be shown. Drafts contain these details locally.',
      fallback_note:
        'The official-form link contains the report text and location. Photos and contact details are not included and must be attached there. Opening the link does not submit a report.',
    };
  }
  async prepare(raw: unknown) {
    const input = reportInput.parse(raw);
    if (new Set(input.photo_ids).size !== input.photo_ids.length)
      throw new Error('A photo cannot be attached twice.');
    const photos = await Promise.all(input.photo_ids.map((id) => this.store.photo(id)));
    const requirements = await this.city.requirements(input);
    const rule = this.validate(input, requirements, photos.length);
    let duplicates: unknown;
    try {
      duplicates = await this.city.nearby(input);
    } catch {
      duplicates = {
        coverage: 'Duplicate search unavailable. Check the official map before confirming.',
        matches: [],
      };
    }
    const prepared = await this.store.prepare(input, photos);
    return { ...this.present(prepared), requirements: rule, nearby_reports: duplicates };
  }
  async submit(id: string, token: string, confirmed: boolean) {
    if (confirmed !== true) throw new Error('Explicit approval of this preview is required.');
    if (!this.options.submissionEnabled)
      throw new Error(
        'Experimental submission is disabled. Set ZURI_ENABLE_SUBMISSION=true to opt in, or use the prepared official-form link.',
      );
    const preview = await this.store.confirmed(id, token);
    // Revalidate changing city rules before claiming or sending a report.
    this.validate(
      preview.input,
      await this.city.requirements(preview.input),
      preview.photos.length,
    );
    const { input } = preview;
    const summary: ReceiptSummary = {
      municipality: {
        bfs_id: this.city.bfsId,
        name: this.city.municipality,
        reporting_service: this.city.reportingService,
      },
      category: input.category,
      location_label: input.location_label,
      latitude: input.latitude,
      longitude: input.longitude,
      text_sha256: textHash(input.description),
      description: input.description,
    };
    const claim = await this.store.claim(preview, summary);
    if (!claim.owned) return { ...claim.receipt, already_attempted: true };
    let receipt = claim.receipt;
    try {
      const result = await this.city.submit(preview);
      const messages = {
        accepted:
          'City endpoint accepted the report. Publication or moderation may still be pending.',
        confirmation_pending:
          'The city emailed the reporter a confirmation link. The report goes ahead only after that link is clicked. Do not submit it again.',
        rejected:
          'City endpoint rejected the request. Check the official form and current requirements. This preview will not be resent.',
      };
      receipt = {
        ...receipt,
        ...result,
        ...(result.report_id ? { url: `${CITY}/report/${result.report_id}` } : {}),
        message: messages[result.state],
      };
    } catch {
      receipt = {
        ...receipt,
        state: 'unknown',
        message:
          'The city may have received the report, but no reliable response was received. Check your email and the city website. Do not resubmit or create a replacement automatically.',
      };
    }
    await this.store.saveReceipt(receipt);
    return receipt;
  }
  // A resident can add the public number of a sent report the client could not match by
  // itself, such as an older report without a summary. A published report must have
  // come through this client, no earlier than this one was sent; a report still under
  // review is accepted and checked once the city publishes it.
  async linkReport(fingerprint: string, id: string) {
    const receipt = (await this.store.receipts()).find((r) => r.fingerprint === fingerprint);
    if (!receipt) throw Object.assign(new Error('Report not found.'), { status: 404 });
    const published = await this.city.report(id);
    if (
      published &&
      ((published.interface_used && published.interface_used !== SUBMISSION_INTERFACE) ||
        (published.requested_datetime &&
          receipt.created_at &&
          Date.parse(published.requested_datetime) <
            Date.parse(receipt.created_at) - CLOCK_SKEW_MS))
    ) {
      throw Object.assign(new Error('That number belongs to a different report.'), { status: 409 });
    }
    return this.store.linkReport(fingerprint, id, `${CITY}/report/${id}`);
  }
  // The sent text and the city's reply in the resident's language. Each text is
  // translated at most once per language, only when first read in it, and kept
  // with the receipt; a changed reply is translated again.
  async translateReceipt(
    fingerprint: string,
    target: Language,
    translate?: (text: string, from: Language, to: Language) => Promise<string>,
  ) {
    const receipt = (await this.store.receipts()).find((r) => r.fingerprint === fingerprint);
    if (!receipt) throw Object.assign(new Error('Report not found.'), { status: 404 });
    const from = this.city.deliveryLanguage,
      result: { reply?: string; description?: string } = {};
    const sources = {
      reply: receipt.tracking?.reply?.replace(/\r/g, '').replace(/\n\s*\n/g, '\n'),
      description: receipt.summary?.description,
    };
    for (const field of ['reply', 'description'] as const) {
      const text = sources[field];
      if (!text || target === from) continue;
      const source_sha256 = textHash(text),
        kept = receipt.translations?.[target]?.[field];
      if (kept?.source_sha256 === source_sha256) {
        result[field] = kept.text;
        continue;
      }
      if (!translate)
        throw Object.assign(new Error('Connect your AI to translate.'), { status: 409 });
      const translated = (await translate(text, from, target)).trim();
      if (!translated || translated.length > 8000)
        throw new Error('The translation was empty or too long. Try again.');
      await this.store.saveTranslation(fingerprint, target, field, {
        source_sha256,
        text: translated,
      });
      result[field] = translated;
    }
    return result;
  }
  // Receipts, newest first; with refresh, their public status is updated first.
  async receipts(refresh = false) {
    const receipts = await this.store.receipts();
    return refresh ? track(this.city, this.store, receipts) : { receipts, complete: true };
  }
}
