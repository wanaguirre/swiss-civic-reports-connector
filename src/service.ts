import { SUBMISSION_INTERFACE } from './city.js';
import {
  type ReportingAdapter,
  destinationFor,
  sameDestination,
  receiptDestination,
  ZURICH_DESTINATION,
} from './municipalities.js';
import { Store } from './store.js';
import {
  coordinates,
  reportInput,
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
    readonly city: ReportingAdapter,
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
    photos: Prepared['photos'],
  ) {
    const photoCount = photos.length;
    const rule = requirements[input.category];
    if (!rule)
      throw new Error(
        'Category is not available at this location. Use list_categories and resolve_location.',
      );
    if (
      rule.location_label_max_length !== undefined &&
      input.location_label.length > rule.location_label_max_length
    )
      throw new Error(
        `This category accepts a location label of at most ${rule.location_label_max_length} characters.`,
      );
    if (rule.email_supported === false && input.email.trim())
      throw new Error('This municipality does not accept a reporter email.');
    if (rule.email_required !== false && !input.email)
      throw new Error('This reporting service requires an email address.');
    if (
      rule.description_max_length !== undefined &&
      input.description.length > rule.description_max_length
    )
      throw new Error(
        `This service accepts at most ${rule.description_max_length} description characters, including location context.`,
      );
    if (rule.description_prefix && !input.description.startsWith(rule.description_prefix + '\n'))
      throw new Error('Municipal location context changed. Prepare and review a new preview.');
    for (const field of ['name', 'phone'] as const)
      if (rule.contact_fields && !rule.contact_fields.includes(field) && input[field]?.trim())
        throw new Error(`This municipality does not accept a reporter ${field}.`);
    if (rule.name_required && !input.name?.trim())
      throw new Error('This service requires the reporter’s full name.');
    if (rule.max_photos !== undefined && photoCount > rule.max_photos)
      throw new Error(`This service accepts at most ${rule.max_photos} photo(s).`);
    if (
      rule.max_photo_bytes !== undefined &&
      photos.some((p) => Buffer.byteLength(p.jpeg, 'base64') > rule.max_photo_bytes!)
    )
      throw new Error(`This category accepts photos of at most ${rule.max_photo_bytes} bytes.`);
    if (rule.photo_required && !photoCount) throw new Error('This category requires a photo.');
    if (rule.phone_required && !input.phone)
      throw new Error('This category requires a contact phone number.');
    if (
      rule.phone_digits !== undefined &&
      (!Number.isInteger(rule.phone_digits) ||
        rule.phone_digits < 1 ||
        rule.phone_digits > 50 ||
        (input.phone && (!/^\d+$/.test(input.phone) || input.phone.length !== rule.phone_digits)))
    )
      throw new Error(
        `This service requires a phone number with exactly ${rule.phone_digits} digits.`,
      );
    const fields = new Map(rule.extra_fields.map((field) => [field.code, field]));
    for (const [key, value] of Object.entries(input.extra_fields)) {
      if (RESERVED_FIELDS.has(key) || /^photo|^password|^submit_/i.test(key) || !fields.has(key))
        throw new Error(`Unsupported extra field: ${key}`);
      const field = fields.get(key)!;
      if (field.max_length !== undefined && value.length > field.max_length)
        throw new Error(`${field.description} must not exceed ${field.max_length} characters.`);
      if (field.datatype && !['string', 'text'].includes(field.datatype))
        throw new Error(`Use the official form for this category's typed field: ${key}`);
      if (value.trim() && field.format) {
        const formats = {
          postcode_4_5_digits: /^[0-9]{4,5}$/,
          numeric_date: /^[0-9.,]+$/,
          ckw_lamp_number: /^[A-Z][0-9]{1,2}-[0-9]{1,2}[A-Z]?$/,
        };
        const pattern = formats[field.format];
        if (!pattern || pattern.exec(value)?.[0] !== value)
          throw new Error(`Invalid format for extra field: ${key}`);
      }
      if (value.trim() && field.values) {
        if (
          !Array.isArray(field.values) ||
          !field.values.every((v: unknown) => typeof v === 'string')
        )
          throw new Error(`Use the official form for the category's choice field: ${key}`);
        if (!field.values.includes(value))
          throw new Error(`Invalid choice for extra field: ${key}`);
      }
    }
    for (const field of rule.extra_fields) {
      if (field.required && !input.extra_fields[field.code]?.trim())
        throw new Error(`Category requires extra field: ${field.code} (${field.description})`);
    }
    return rule;
  }
  present(preview: Prepared) {
    if (!sameDestination(preview.destination ?? ZURICH_DESTINATION, destinationFor(this.city)))
      throw new Error('This preview belongs to a different municipality or service.');
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
      ...(preview.terms_url ? { terms_url: preview.terms_url } : {}),
      municipality: { bfs_id: this.city.bfsId, name: this.city.municipality },
      submission_mode: this.city.submissionMode,
      fallback_prefilled: this.city.fallbackPrefilled,
      duplicate_search_available: this.city.trackingSupported,
      map_url: this.city.mapUrl(preview.input),
      official_form_url: this.city.fallbackUrl(preview.input),
      submission_enabled: this.options.submissionEnabled && this.city.submissionMode === 'direct',
      confirmation_required:
        'Show the description, category, exact map location, contact details, ALL extra fields and photos, and any terms URL. Obtain explicit acceptance of those terms with approval. Ask the user to approve this particular report before calling submit_report.',
      privacy: this.city.privacy,
      fallback_note:
        this.city.submissionMode === 'unverified'
          ? 'Sending is unavailable until municipal upload and receipt verification is complete. This preview has not been sent.'
          : this.city.fallbackPrefilled
            ? 'The official-form link contains the report text and location. Photos and contact details are not included and must be attached there. Opening the link does not submit a report.'
            : 'Copy the prepared text and select the category and location in the official form. Add photos and any required contact details there. Nothing is sent or prefilled by opening the link.',
    };
  }
  async prepare(raw: unknown) {
    const input = reportInput.parse(raw);
    if (new Set(input.photo_ids).size !== input.photo_ids.length)
      throw new Error('A photo cannot be attached twice.');
    const photos = await Promise.all(input.photo_ids.map((id) => this.store.photo(id)));
    const requirements = await this.city.requirements(input);
    const prefix = requirements[input.category]?.description_prefix;
    if (prefix && !input.description.startsWith(prefix + '\n'))
      input.description = prefix + '\n' + input.description;
    const rule = this.validate(input, requirements, photos);
    let duplicates: unknown;
    try {
      duplicates = await this.city.nearby(input);
    } catch {
      duplicates = {
        coverage: 'Duplicate search unavailable. Check the official map before confirming.',
        matches: [],
      };
    }
    const prepared = await this.store.prepare(
      input,
      photos,
      destinationFor(this.city),
      this.city.termsUrl,
    );
    return { ...this.present(prepared), requirements: rule, nearby_reports: duplicates };
  }
  async submit(id: string, token: string, confirmed: boolean, acceptedTermsUrl?: string) {
    if (confirmed !== true) throw new Error('Explicit approval of this preview is required.');
    if (this.city.submissionMode !== 'direct')
      throw new Error(
        this.city.submissionMode === 'unverified'
          ? 'Sending is unavailable until municipal upload and receipt verification is complete.'
          : 'Complete and send this report in the municipality’s official form. Direct submission is unavailable.',
      );
    if (!this.options.submissionEnabled)
      throw new Error(
        'Experimental submission is disabled. Set ZURI_ENABLE_SUBMISSION=true to opt in, or use the prepared official-form link.',
      );
    const preview = await this.store.confirmed(id, token);
    if (!sameDestination(preview.destination ?? ZURICH_DESTINATION, destinationFor(this.city)))
      throw new Error(
        'This preview belongs to a different municipality or service. Prepare a new preview.',
      );
    if (preview.terms_url !== this.city.termsUrl)
      throw new Error('Municipal terms changed. Prepare and approve a new preview.');
    if (preview.terms_url && acceptedTermsUrl !== preview.terms_url)
      throw new Error('Explicit acceptance of the terms shown in this preview is required.');
    // Revalidate changing city rules before claiming or sending a report.
    this.validate(
      preview.input,
      await this.city.requirements(preview.input, { fresh: true }),
      preview.photos,
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
    const claim = await this.store.claim(preview, summary, this.city.trackingSupported);
    if (!claim.owned) return { ...claim.receipt, already_attempted: true };
    let receipt = { ...claim.receipt, tracking_available: this.city.trackingSupported };
    try {
      const result = await this.city.submit(preview);
      const messages = {
        unknown:
          'The send request was attempted, but municipal acceptance is unverified. Check the official service. Do not resubmit or create a replacement automatically.',
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
        ...(result.report_id ? { url: this.city.reportUrl(result.report_id) } : {}),
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
    if (!receipt || !sameDestination(receiptDestination(receipt), destinationFor(this.city)))
      throw Object.assign(new Error('Report not found for this municipality.'), { status: 404 });
    if (!this.city.trackingSupported)
      throw new Error('Public tracking is unavailable for this municipality.');
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
    return this.store.linkReport(fingerprint, id, this.city.reportUrl(id));
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
    if (!receipt || !sameDestination(receiptDestination(receipt), destinationFor(this.city)))
      throw Object.assign(new Error('Report not found for this municipality.'), { status: 404 });
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
    return refresh && this.city.trackingSupported
      ? track(this.city, this.store, receipts)
      : { receipts, complete: true };
  }
}
