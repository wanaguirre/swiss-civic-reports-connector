import fs from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { coordinates, reportInput, type Photo, type Prepared, type Receipt, type ReceiptSummary, type ReportInput, type Translation } from './model.js';
import type { Language } from './language.js';
import { hash, TTL_MS } from './photos.js';
import { initializeDirectory, syncDirectory } from './durable-files.js';
import { StorageBudget, withStorageLock, type StorageLimits } from './storage-budget.js';

const metadata = z.object({ id: z.string().uuid(), created_at: z.string().datetime(), expires_at: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), width: z.number().int().positive(), height: z.number().int().positive(), gps: coordinates.optional(),
  capture_location: coordinates.optional() });
const legacyPhoto = metadata.extend({ jpeg: z.string() });
const storedPhoto = metadata.extend({ format: z.literal('civic-photo-v2') });
const storedPreview = z.object({ format: z.literal('civic-preview-v2'), id: z.string().uuid(), created_at: z.string().datetime(),
  expires_at: z.string().datetime(), confirmation_token: z.string().uuid(), input: reportInput, photos: z.array(metadata).max(3), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
const legacyPreview = storedPreview.omit({ format: true }).extend({ photos: z.array(legacyPhoto).max(3) });
type PhotoMetadata = z.infer<typeof metadata>;

export function fingerprint(input: ReportInput, photos: Photo[]) {
  // Contact and public content are frozen together. Photo IDs/time do not change the identity of identical content.
  const { photo_ids: _, ...fields } = input;
  const ordered = { ...fields, extra_fields: Object.fromEntries(Object.entries(fields.extra_fields).sort(([a], [b]) => a.localeCompare(b))) };
  return hash(JSON.stringify({ input: ordered, photos: photos.map(p => p.sha256) }));
}

export class Store {
  private initialization?: Promise<void>;
  private readonly budget: StorageBudget;
  constructor(readonly directory: string, readonly now: () => number = Date.now, limits: StorageLimits = {}) {
    this.budget = new StorageBudget(directory, limits);
  }
  private file(kind: string, id: string) {
    if (!/^[a-f0-9-]{36}$|^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid stored record identifier.');
    return join(this.directory, `${kind}-${id}.json`);
  }
  async initialize() {
    if (!this.initialization) {
      this.initialization = initializeDirectory(this.directory).catch(error => {
        this.initialization = undefined;
        throw error;
      });
    }
    await this.initialization;
  }
  private async write(kind: string, id: string, record: unknown) {
    await this.publish(this.file(kind, id), Buffer.from(JSON.stringify(record)));
  }
  private async publish(target: string, body: Buffer) {
    await this.initialize();
    const temporary = `${target}.${randomUUID()}.tmp`;
    let created = false;
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      created = true;
      try { await handle.writeFile(body); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, target);
      await syncDirectory(this.directory);
    } finally {
      if (created) await fs.unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
    }
  }
  private async read<T>(kind: string, id: string): Promise<T> {
    try { return JSON.parse(await fs.readFile(this.file(kind, id), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Record not found or expired. Prepare it again.');
      throw error;
    }
  }
  private mediaFile(sha256: string) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid photo reference.');
    return join(this.directory, `media-${sha256}.jpg`);
  }
  private async hydrate(photo: PhotoMetadata): Promise<Photo> {
    let bytes: Buffer;
    try { bytes = await fs.readFile(this.mediaFile(photo.sha256)); }
    catch { throw new Error('Stored photo is unavailable. Prepare a new preview; check any existing submission receipt first.'); }
    if (hash(bytes) !== photo.sha256) throw new Error('Stored photo failed integrity verification.');
    return { ...photo, jpeg: bytes.toString('base64') };
  }
  private async locked<T>(action: () => Promise<T>) {
    await this.initialize();
    return withStorageLock(this.budget.root, action);
  }
  private async clean() {
    const names = await fs.readdir(this.directory), referenced = new Set<string>(), expired: string[] = [];
    for (const name of names) {
      if (!/^(photo|preview)-[a-f0-9-]{36}\.json$/.test(name)) continue;
      const record = JSON.parse(await fs.readFile(join(this.directory, name), 'utf8'));
      if (!Number.isFinite(Date.parse(record.expires_at))) throw new Error('Invalid stored expiry. Contact the operator.');
      if (Date.parse(record.expires_at) <= this.now()) { expired.push(name); continue; }
      if (name.startsWith('photo-') && record.format === 'civic-photo-v2') referenced.add(storedPhoto.parse(record).sha256);
      else if (name.startsWith('preview-') && record.format === 'civic-preview-v2') {
        for (const photo of storedPreview.parse(record).photos) referenced.add(photo.sha256);
      } else if (record.format !== undefined) throw new Error('Unknown storage format. Contact the operator.');
      else if (name.startsWith('photo-')) legacyPhoto.parse(record);
      else legacyPreview.parse(record);
    }
    // Determine all live references before deleting any media. Legacy records
    // remain embedded and need no media reference. Receipts are never collected.
    const abandoned = names.filter(name => /^(?:(?:photo|preview)-[a-f0-9-]{36}\.json|media-[a-f0-9]{64}\.jpg)\.[a-f0-9-]{36}\.tmp$/.test(name));
    const remove = [...expired, ...abandoned, ...names.filter(name => /^media-[a-f0-9]{64}\.jpg$/.test(name) && !referenced.has(name.slice(6, -4)))];
    for (const name of remove) await fs.unlink(join(this.directory, name));
    if (remove.length) await syncDirectory(this.directory);
  }
  async cleanup(_enforceLimit = true) { await this.locked(() => this.clean()); }
  private async media(photos: Photo[], files: Map<string, Buffer>) {
    for (const photo of photos) {
      metadata.parse(photo);
      const bytes = Buffer.from(photo.jpeg, 'base64');
      if (hash(bytes) !== photo.sha256) throw new Error('Stored photo failed integrity verification.');
      const path = this.mediaFile(photo.sha256);
      try {
        if (hash(await fs.readFile(path)) !== photo.sha256) throw new Error('Stored photo failed integrity verification.');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        files.set(`media-${photo.sha256}.jpg`, bytes);
      }
    }
  }
  private async publishTransient(files: Map<string, Buffer>) {
    await this.budget.admit(files);
    // Media comes first; a failed publication may leave an orphan, but never a
    // successful preview referencing unpublished bytes. Cleanup reclaims it.
    for (const [name, bytes] of files) await this.publish(join(this.directory, name), bytes);
  }
  async savePhoto(photo: Photo) {
    await this.locked(async () => {
      await this.clean();
      try {
        await fs.lstat(this.file('photo', photo.id));
        throw new Error('Photo is already stored. Import a new photo instead.');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const files = new Map<string, Buffer>();
      await this.media([photo], files);
      const record = { format: 'civic-photo-v2', ...metadata.parse(photo) };
      files.set(`photo-${photo.id}.json`, Buffer.from(JSON.stringify(record)));
      await this.publishTransient(files);
    });
  }
  async photo(id: string) {
    const record = await this.read<Photo & { format?: string }>('photo', id);
    if (Date.parse(record.expires_at) <= this.now()) throw new Error('Photo expired; import it again.');
    const photo = record.format === 'civic-photo-v2' ? await this.hydrate(metadata.parse(storedPhoto.parse(record))) : legacyPhoto.parse(record);
    if (record.format !== undefined && record.format !== 'civic-photo-v2') throw new Error('Unknown photo format.');
    if (photo.id !== id || hash(Buffer.from(photo.jpeg, 'base64')) !== photo.sha256) throw new Error('Stored photo failed integrity verification.');
    return photo;
  }
  async prepare(input: ReportInput, photos: Photo[]): Promise<Prepared> {
    return this.locked(async () => {
      await this.clean();
      const prepared: Prepared = { id: randomUUID(), created_at: new Date(this.now()).toISOString(),
        expires_at: new Date(this.now() + TTL_MS).toISOString(), confirmation_token: randomUUID(),
        input, photos, fingerprint: fingerprint(input, photos) };
      const files = new Map<string, Buffer>();
      await this.media(photos, files);
      const record = storedPreview.parse({ ...prepared, format: 'civic-preview-v2', photos: photos.map(photo => metadata.parse(photo)) });
      files.set(`preview-${prepared.id}.json`, Buffer.from(JSON.stringify(record)));
      await this.publishTransient(files);
      return prepared;
    });
  }
  async preview(id: string) {
    const record = await this.read<Prepared & { format?: string }>('preview', id);
    if (Date.parse(record.expires_at) <= this.now()) throw new Error('Preview expired. Prepare a new preview and obtain new confirmation.');
    let preview: Prepared;
    if (record.format === 'civic-preview-v2') {
      const stored = storedPreview.parse(record);
      preview = { ...stored, photos: await Promise.all(stored.photos.map(photo => this.hydrate(photo))) };
    } else if (record.format !== undefined) throw new Error('Unknown preview format.');
    else preview = legacyPreview.parse(record);
    if (preview.id !== id || fingerprint(preview.input, preview.photos) !== preview.fingerprint ||
        preview.photos.some(p => hash(Buffer.from(p.jpeg, 'base64')) !== p.sha256)) throw new Error('Preview integrity check failed.');
    return preview;
  }
  async confirmed(id: string, token: string) {
    const preview = await this.preview(id);
    const expected = Buffer.from(preview.confirmation_token), actual = Buffer.from(token);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Confirmation token does not match this preview.');
    return preview;
  }
  async claim(preview: Prepared, summary?: ReceiptSummary): Promise<{ owned: boolean; receipt: Receipt }> {
    await this.initialize();
    const receipt: Receipt = { fingerprint: preview.fingerprint, preview_id: preview.id,
      created_at: new Date(this.now()).toISOString(), state: 'sending',
      message: 'Submission is in progress or its result is uncertain. Do not resend; check the receipt, email and city website.',
      ...(summary ? { summary } : {}) };
    try {
      await fs.writeFile(this.file('receipt', preview.fingerprint), JSON.stringify(receipt), { flag: 'wx', mode: 0o600, flush: true });
      await syncDirectory(this.directory);
      return { owned: true, receipt };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Another process may still be completing its first atomic claim write. Never resend even if unreadable.
      try { return { owned: false, receipt: await this.read<Receipt>('receipt', preview.fingerprint) }; }
      catch { return { owned: false, receipt }; }
    }
  }
  async saveReceipt(receipt: Receipt) {
    return this.locked(async () => {
      // A public lookup may have started before the resident acknowledged email,
      // added the report number or read a translation. Preserve them all when
      // the lookup finishes.
      let current: Receipt | undefined;
      try { current = JSON.parse(await fs.readFile(this.file('receipt', receipt.fingerprint), 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const saved = { ...receipt, ...(current?.email_confirmed_at ? { email_confirmed_at: current.email_confirmed_at } : {}),
        ...(current?.report_id && !receipt.report_id ? { report_id: current.report_id, ...(current.url ? { url: current.url } : {}) } : {}),
        ...(current?.translations ? { translations: current.translations } : {}) };
      await this.write('receipt', receipt.fingerprint, saved);
      return saved;
    });
  }
  async confirmReceiptEmail(fingerprint: string) {
    return this.locked(async () => {
      let receipt: Receipt;
      try { receipt = JSON.parse(await fs.readFile(this.file('receipt', fingerprint), 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Object.assign(new Error('Report not found.'), { status: 404 });
        throw error;
      }
      if (receipt.report_id || receipt.tracking?.status) return receipt;
      if (receipt.state !== 'confirmation_pending') throw Object.assign(new Error('This report is not waiting for email confirmation.'), { status: 409 });
      if (!receipt.email_confirmed_at) {
        receipt.email_confirmed_at = new Date(this.now()).toISOString();
        await this.write('receipt', fingerprint, receipt);
      }
      return receipt;
    });
  }
  async saveTranslation(fingerprint: string, target: Language, field: 'reply' | 'description', translation: Translation) {
    return this.locked(async () => {
      let receipt: Receipt;
      try { receipt = JSON.parse(await fs.readFile(this.file('receipt', fingerprint), 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Object.assign(new Error('Report not found.'), { status: 404 });
        throw error;
      }
      receipt.translations = { ...receipt.translations, [target]: { ...receipt.translations?.[target], [field]: translation } };
      await this.write('receipt', fingerprint, receipt);
      return receipt;
    });
  }
  // A report number links one receipt only. Earlier lookups are dropped so the
  // number is checked at the next refresh.
  async linkReport(fingerprint: string, id: string, url: string) {
    return this.locked(async () => {
      let receipt: Receipt;
      try { receipt = JSON.parse(await fs.readFile(this.file('receipt', fingerprint), 'utf8')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Object.assign(new Error('Report not found.'), { status: 404 });
        throw error;
      }
      if (receipt.report_id === id) return receipt;
      if (receipt.report_id) throw Object.assign(new Error('This report already has its city number.'), { status: 409 });
      if (receipt.state === 'rejected') throw Object.assign(new Error('This report was not accepted, so it has no city number.'), { status: 409 });
      for (const name of (await fs.readdir(this.directory)).filter(n => /^receipt-[a-f0-9]{64}\.json$/.test(n) && n !== `receipt-${fingerprint}.json`)) {
        let other: Receipt | undefined;
        try { other = JSON.parse(await fs.readFile(join(this.directory, name), 'utf8')); } catch { /* An unreadable claim holds no number. */ }
        if (other?.report_id === id) throw Object.assign(new Error('That number already belongs to another sent report.'), { status: 409 });
      }
      const { tracking: _earlier, ...rest } = receipt;
      const linked: Receipt = { ...rest, report_id: id, url };
      await this.write('receipt', fingerprint, linked);
      return linked;
    });
  }
  async receipts() {
    await this.initialize();
    const names = (await fs.readdir(this.directory)).filter(n => /^receipt-[a-f0-9]{64}\.json$/.test(n));
    const records: Receipt[] = [];
    for (const name of names) {
      try { records.push(JSON.parse(await fs.readFile(join(this.directory, name), 'utf8'))); }
      catch { /* A partially written claim is not safe to retry; surface this explicitly. */
        records.push({ fingerprint: name.slice(8, -5), preview_id: '', created_at: '', state: 'unknown', message: 'Unreadable receipt; do not resend automatically.' });
      }
    }
    return records.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}
