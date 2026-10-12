import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Point, Requirements } from './model.js';
import { coordinates } from './model.js';
import type { DraftRequest, DraftResult } from './telegram-draft.js';
import { parseDraftResult } from './telegram-draft.js';

type McpResult = { isError?: boolean; content: any[] };
type CallMcp = (name: string, args?: Record<string, unknown>) => Promise<McpResult>;
type Messenger = {
  call(method: string, body: Record<string, unknown>): Promise<any>;
  download(id: string): Promise<Buffer>;
  sendText(chat: number, text: string, buttons?: { text: string; callback_data: string }[][]): Promise<any>;
  sendPhoto(chat: number, base64: string): Promise<any>;
};
type Session = {
  updated: number; photos: { id: string; image: string }[]; caption: string;
  email?: string; name?: string; phone?: string; description?: string; category?: string;
  point?: Point; label?: string; locationConfirmed: boolean; nonce?: string;
  gps?: Point; requirements?: Record<string, Requirements>; assessment?: DraftResult;
  awaitingContact?: 'email' | 'phone';
  submissionAttempted?: boolean;
  candidates?: { label: string; latitude: number; longitude: number }[];
  preview?: { id: string; token: string; nonce: string; messageId: number };
};

// Receipt states in words; the raw state is for programs, not people.
const RESULT: Record<string, string> = { accepted: 'Received', confirmation_pending: 'Confirm in your email', rejected: 'Not accepted' };
export const HELP = `Zürich Reports — private bot\n\nSend a photo (or an original JPEG/PNG file), then share the exact issue location using Telegram's location picker. Review and confirm the map.\n\n/email your@email.ch\n/name Your name (optional)\n/phone +41… (if required)\n/address address in Zürich — find a location\n/draft — AI description/category (when enabled)\n/describe factual report text\n/categories — list exact category names\n/category exact category name\n/preview — review before sending\n/status — recent submission receipts\n/new — start a new report\n/cancel — discard this chat draft\n\nOnly the Send button on the latest preview can submit. City writes are disabled by default. No emergency reporting. Photos/text may become public if you submit. Telegram and your chosen AI provider process their respective messages/images.`;

export class TelegramBot {
  private session: Session;
  constructor(readonly userId: number, private messenger: Messenger, private mcp: CallMcp,
    private draft?: (request: DraftRequest) => Promise<DraftResult>,
    private defaults: { email?: string; name?: string; phone?: string } = {}, private now = Date.now) {
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Set ZURI_TELEGRAM_USER_ID to your positive numeric Telegram user ID.');
    this.session = this.fresh();
  }
  private fresh(): Session { return { ...this.defaults, updated: this.now(), photos: [], caption: '', locationConfirmed: false }; }
  private async tool(name: string, args: Record<string, unknown> = {}) {
    const result = await this.mcp(name, args);
    if (result.isError) throw new Error(result.content.find(c => c.type === 'text')?.text ?? 'MCP tool failed.');
    const value = result.content.find(c => c.type === 'text');
    return { data: value ? JSON.parse(value.text) : {}, images: result.content.filter(c => c.type === 'image') };
  }
  private change() { this.session.preview = undefined; this.session.updated = this.now(); }
  private async text(text: string, buttons?: { text: string; callback_data: string }[][]) {
    // Telegram caps text at 4096 characters. Keep buttons only on the final chunk.
    const chunks = text.match(/[\s\S]{1,3500}/g) ?? [''];
    let message;
    for (const [i, chunk] of chunks.entries()) message = await this.messenger.sendText(this.userId, chunk, i === chunks.length - 1 ? buttons : undefined);
    return message;
  }
  private async location(point: Point, label: string) {
    const { data } = await this.tool('resolve_location', point);
    this.change(); this.session.point = point; this.session.label = label;
    this.session.locationConfirmed = false; this.session.nonce = randomUUID(); this.session.candidates = undefined;
    this.session.requirements = data.categories;
    await this.text(`Is this the exact issue location?\n${label}\n${data.map_url}\n\nUse a new pin or /address to change it.`,
      [[{ text: 'Confirm this issue location', callback_data: `loc:${this.session.nonce}` }]]);
  }
  private async suggest() {
    if (!this.draft) throw new Error('AI drafting is not enabled. Use /describe and /category.');
    const s = this.session;
    if (s.submissionAttempted) { await this.nextStep(); return; }
    if (!s.photos.length && !s.caption) throw new Error('Send a photo or describe the issue first.');
    const previous_question = s.assessment?.action === 'clarify' ? s.assessment.message : undefined;
    // Clear the old draft before any model/network operation, including failed re-drafts.
    this.change(); s.description = undefined; s.category = undefined; s.assessment = undefined; s.awaitingContact = undefined;
    const { data } = await this.tool('list_categories');
    const categories = data.categories.map((c: any) => c.service_code);
    await this.text('Preparing your draft…');
    const result = parseDraftResult(await this.draft({ images: s.photos.map(p => p.image), caption: s.caption,
      categories, ...(previous_question ? { previous_question } : {}) }), categories);
    s.assessment = result;
    if (result.action === 'prepare') { s.description = result.description; s.category = result.category; }
    await this.nextStep(true);
  }
  private async nextStep(showDraft = false) {
    const s = this.session;
    s.awaitingContact = undefined;
    if (s.submissionAttempted) { await this.text('A submission was already attempted for this report. Check /status and your email. Do not retry or switch to the official form if the outcome is uncertain. Use /new only for a different issue.'); return; }
    if (s.assessment && s.assessment.action !== 'prepare') { await this.text(s.assessment.message); return; }
    if (!s.description || !s.category) {
      await this.text(this.draft ? 'Send a photo or describe the issue. You can use /draft to try again.' : 'Add a description with /describe and choose a category with /categories and /category.'); return;
    }
    const suggestion = showDraft ? `Suggested category: ${s.category}\n\n${s.description}\n\n` : '';
    if (!s.point && s.gps) {
      if (suggestion) await this.text(suggestion.trim());
      await this.location(s.gps, 'Photo location — please verify the issue point'); return;
    }
    if (!s.point || !s.locationConfirmed) {
      await this.text(`${suggestion}${s.point ? 'Confirm the exact issue location on the map above, or share a new pin.' : 'Share the exact issue location using a Telegram pin or /address.'}`); return;
    }
    if (!s.email) { s.awaitingContact = 'email'; await this.text(`${suggestion}What email should the city use for this report? You can type it here.`); return; }
    if (s.requirements?.[s.category]?.phone_required && !s.phone) {
      s.awaitingContact = 'phone'; await this.text(`${suggestion}This category requires a contact phone number. You can type it here.`); return;
    }
    await this.preview();
  }
  private async preview() {
    const s = this.session;
    if (s.submissionAttempted) { await this.nextStep(); return; }
    if (s.assessment && s.assessment.action !== 'prepare') { await this.text(s.assessment.message); return; }
    if (!s.point || !s.locationConfirmed) throw new Error('Share and confirm the exact issue location first.');
    if (!s.email || !s.category || !s.description) throw new Error('Provide /email, /category and /describe (or /draft) first.');
    this.change();
    const prepared = await this.tool('prepare_report', { ...s.point, location_label: s.label, location_confirmed: true,
      email: s.email, name: s.name, phone: s.phone, category: s.category, description: s.description,
      photo_ids: s.photos.map(p => p.id), extra_fields: {} });
    const { data, images } = await this.tool('get_preview', { preview_id: prepared.data.preview_id });
    for (const image of images) await this.messenger.sendPhoto(this.userId, image.data);
    const nearby = prepared.data.nearby_reports;
    const duplicates = nearby.matches?.length ? `\nPossible duplicates:\n${nearby.matches.slice(0, 5).map((r: any) => r.url).join('\n')}` : '\nNo duplicate matches returned. This does not establish that none exist.';
    const nonce = randomUUID();
    const content = `REPORT PREVIEW\n${s.category}\n\n${s.description}\n\nLocation: ${s.label}\n${data.map_url}\nEmail: ${s.email}${s.name ? `\nName: ${s.name}` : ''}${s.phone ? `\nPhone: ${s.phone}` : ''}\nPhotos: ${images.length}${duplicates}\n${nearby.coverage ?? ''}\n\nThe city may publish the description and photos. The displayed contact details go to the city. Verify everything above.\n\n${data.submission_enabled ? 'Press Send only to approve this exact report.' : 'Continue in the official form and attach photos/contact details there:'}`;
    const sent = await this.text(content, data.submission_enabled ? [[{ text: 'Send this report to the city', callback_data: `send:${nonce}` }]] : undefined);
    if (data.submission_enabled) s.preview = { id: data.preview_id, token: data.confirmation_token, nonce, messageId: sent.message_id };
    else await this.text(data.official_form_url);
  }
  async handle(update: any) {
    const callback = update.callback_query, message = callback?.message ?? update.message;
    const sender = callback?.from ?? message?.from;
    if (!message || message.chat?.type !== 'private' || message.chat.id !== this.userId || sender?.id !== this.userId || sender?.is_bot) return;
    if (this.now() - this.session.updated > 60 * 60 * 1000) this.session = this.fresh();
    try {
      if (callback) {
        await this.messenger.call('answerCallbackQuery', { callback_query_id: callback.id });
        const value: string = callback.data ?? '';
        if (value === `loc:${this.session.nonce}` && this.session.point && this.session.nonce) {
          this.change(); this.session.locationConfirmed = true; this.session.nonce = undefined;
          if (this.draft) await this.nextStep();
          else await this.text('Location confirmed. Add your contact email, then use /describe and /category. Finally, /preview.'); return;
        }
        const selected = /^pick:(\d+):(.+)$/.exec(value);
        if (selected && selected[2] === this.session.nonce) {
          const candidate = this.session.candidates?.[Number(selected[1])];
          if (candidate) await this.location({ latitude: candidate.latitude, longitude: candidate.longitude }, candidate.label);
          return;
        }
        const preview = this.session.preview;
        if (preview && value === `send:${preview.nonce}` && message.message_id === preview.messageId) {
          // Consume the button before any external operation. The MCP also persists an idempotency claim.
          this.session.preview = undefined; this.session.submissionAttempted = true;
          const { data } = await this.tool('submit_report', { preview_id: preview.id, confirmation_token: preview.token, human_confirmed: true });
          await this.text(`${data.state}: ${data.message}${data.url ? `\n${data.url}` : ''}`); return;
        }
        await this.text('That button is stale or already used. Use /preview to review the current report. Do not retry a submission with an uncertain result.'); return;
      }
      if (message.date && this.now() / 1000 - message.date > 15 * 60) return;
      const text = String(message.text ?? '').trim();
      const [command, ...parts] = text.split(/\s+/), arg = parts.join(' ');
      if (command === '/start' && this.draft) {
        await this.text('Send a photo and I’ll suggest the category and description. Then confirm the location and review the report. You can reply normally to clarify or correct it. Nothing is sent until you approve. Photos/text may become public if submitted. Telegram and the configured AI service process your photos and messages. Use /help for commands.'); return;
      }
      if (['/start', '/help'].includes(command)) { await this.text(HELP); return; }
      if (['/new', '/cancel'].includes(command)) { this.session = this.fresh(); await this.text('Chat draft cleared. Send a photo to start. Existing MCP submission receipts remain.'); return; }
      if (command === '/status') {
        const { data } = await this.tool('list_my_reports');
        await this.text(data.receipts.slice(0, 10).map((r: any) => `${r.created_at.slice(0, 10)} · ${RESULT[r.state] ?? 'Result uncertain'}\n${r.message}${r.url ? `\n${r.url}` : ''}`).join('\n\n') || 'No submission receipts on this installation.'); return;
      }
      if (command === '/email' || (text && !command.startsWith('/') && z.string().email().max(254).safeParse(text).success)) {
        this.session.email = z.string().email().max(254).parse(command === '/email' ? arg : text); this.change();
        if (this.draft) await this.nextStep(); else await this.text('Contact email updated.'); return;
      }
      if (this.session.awaitingContact === 'phone' && /^[+\d().\s-]{5,50}$/.test(text)) {
        this.session.phone = text; this.change(); await this.nextStep(); return;
      }
      if (command === '/name' || command === '/phone') {
        const value = z.string().max(command === '/name' ? 100 : 50).parse(arg);
        if (command === '/name') this.session.name = value; else this.session.phone = value;
        this.change(); if (this.draft) await this.nextStep(); else await this.text('Contact details updated.'); return;
      }
      if (command === '/address') {
        const { data } = await this.tool('resolve_location', { query: arg });
        this.change(); this.session.locationConfirmed = false; this.session.nonce = randomUUID(); this.session.candidates = data.candidates;
        await this.text('Choose the nearest address, then confirm the precise issue point on the map.', data.candidates.map((c: any, i: number) =>
          [{ text: c.label, callback_data: `pick:${i}:${this.session.nonce}` }])); return;
      }
      if (message.location) {
        const point = coordinates.parse(message.location);
        await this.location(point, `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} (user-selected pin)`); return;
      }
      if (message.photo?.length || message.document) {
        if (this.session.photos.length >= 3) throw new Error('Up to three photos per report. Use /new to start again.');
        const file = message.document ?? message.photo.at(-1);
        const bytes = await this.messenger.download(file.file_id);
        const result = await this.tool('inspect_photo', { base64: bytes.toString('base64') });
        this.change(); this.session.photos.push({ id: result.data.id, image: result.images[0].data });
        if (message.caption) this.session.caption = `${this.session.caption}\n${String(message.caption)}`.trim().slice(0, 3500);
        this.session.description = undefined; this.session.category = undefined;
        this.session.assessment = undefined; this.session.awaitingContact = undefined;
        if (result.data.gps && !this.session.point) this.session.gps = result.data.gps;
        if (this.draft) { await this.suggest(); return; }
        await this.text(`Photo ${this.session.photos.length} received. Check faces, plates and private details before proceeding. ${result.data.gps ? 'GPS was found; confirm the suggested point below.' : 'Share the exact issue location using a Telegram pin or /address.'}`);
        if (result.data.gps && !this.session.point) await this.location(result.data.gps, 'GPS extracted from photo — verify the issue point');
        return;
      }
      if (command === '/categories') {
        const { data } = await this.tool('list_categories');
        await this.text(data.categories.map((c: any) => c.service_code).join('\n')); return;
      }
      if (command === '/category') {
        const { data } = await this.tool('list_categories');
        if (!data.categories.some((c: any) => c.service_code === arg)) throw new Error('Use an exact category from /categories.');
        this.change(); this.session.category = arg;
        if (this.draft) await this.nextStep(); else await this.text('Category updated. Use /preview when ready.'); return;
      }
      if (this.draft && text && !command.startsWith('/')) {
        this.session.caption = `${this.session.caption}\n${text}`.trim().slice(-3500);
        await this.suggest(); return;
      }
      if (command === '/describe' || (text && !command.startsWith('/'))) {
        this.change(); this.session.description = z.string().min(10).max(3500).parse(command === '/describe' ? arg : text);
        this.session.caption = this.session.description; this.session.assessment = undefined;
        if (this.draft) await this.nextStep(); else await this.text('Description updated. Set /category, then /preview.'); return;
      }
      if (command === '/draft') {
        await this.suggest(); return;
      }
      if (command === '/preview') {
        if (this.draft) await this.nextStep(); else await this.preview(); return;
      }
      await this.text('Use /help for the reporting workflow.');
    } catch (error) { await this.text(error instanceof Error ? error.message : 'Operation failed.'); }
  }
}
