import fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export type StorageLimits = { rootDirectory?: string; identityBytes?: number; totalBytes?: number; records?: number; freeBytes?: number };
export const DEFAULT_STORAGE_LIMITS = { identityBytes: 128 * 1024 ** 2, totalBytes: 512 * 1024 ** 2, records: 100, freeBytes: 64 * 1024 ** 2 };
export class StorageCapacityError extends Error { readonly status = 507; }

// One filesystem lock covers admission, publication and cleanup across Store
// instances AND processes. Never guess that a lock is stale or steal it: an
// interrupted holder needs operator recovery with every writer stopped.
export async function withStorageLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const path = join(root, '.transient-storage.lock');
  const deadline = Date.now() + 3000;
  let handle;
  for (;;) {
    try { handle = await fs.open(path, 'wx', 0o600); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('Private storage is unavailable. Contact the operator.');
      if (Date.now() >= deadline) throw new Error('Private storage is busy or needs recovery. Try later; contact the operator if this continues.');
      await setTimeout(20);
    }
  }
  try { return await action(); }
  finally { await handle.close(); await fs.unlink(path); }
}

export class StorageBudget {
  readonly root: string;
  readonly limits: typeof DEFAULT_STORAGE_LIMITS;
  constructor(readonly directory: string, options: StorageLimits) {
    this.root = resolve(options.rootDirectory ?? directory);
    this.limits = { identityBytes: options.identityBytes ?? DEFAULT_STORAGE_LIMITS.identityBytes,
      totalBytes: options.totalBytes ?? DEFAULT_STORAGE_LIMITS.totalBytes, records: options.records ?? DEFAULT_STORAGE_LIMITS.records,
      freeBytes: options.freeBytes ?? DEFAULT_STORAGE_LIMITS.freeBytes };
    for (const value of [this.limits.identityBytes, this.limits.totalBytes, this.limits.records, this.limits.freeBytes]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Storage limits must be positive safe integers.');
    }
    if (this.root !== resolve(directory) && !/^users\/[a-f0-9]{64}$/.test(resolve(directory).slice(this.root.length + 1))) {
      throw new Error('Storage identity must be under its configured root.');
    }
    if (this.root !== resolve(directory) && !resolve(directory).startsWith(`${this.root}/`)) throw new Error('Invalid storage root.');
  }
  private async usage(directory: string) {
    let bytes = 0, records = 0;
    for (const name of await fs.readdir(directory)) {
      if (/^receipt-[a-f0-9]{64}\.json(?:\.[a-f0-9-]{36}\.tmp)?$/.test(name) || name === '.transient-storage.lock') continue;
      const info = await fs.lstat(join(directory, name));
      if (!info.isFile()) throw new Error('Unexpected entry in private storage. Contact the operator.');
      bytes += info.size;
      if (/^(photo|preview)-[a-f0-9-]{36}\.json$/.test(name)) records++;
    }
    return { bytes, records };
  }
  async admit(files: Map<string, Buffer>) {
    const own = await this.usage(this.directory);
    let total = own.bytes;
    if (this.root !== resolve(this.directory)) {
      total = 0;
      for (const entry of await fs.readdir(join(this.root, 'users'), { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) throw new Error('Unexpected identity storage. Contact the operator.');
        total += (await this.usage(join(this.root, 'users', entry.name))).bytes;
      }
    }
    let bytes = 0, records = 0;
    for (const [name, data] of files) {
      bytes += data.length;
      if (/^(photo|preview)-/.test(name)) records++;
    }
    if (own.records + records > this.limits.records || own.bytes + bytes > this.limits.identityBytes) {
      throw new StorageCapacityError('Your temporary photo and preview storage is full. Wait for expiry before adding more.');
    }
    if (total + bytes > this.limits.totalBytes) throw new StorageCapacityError('Temporary report storage is full. Try later or contact the operator.');
    const space = await fs.statfs(this.directory);
    if (space.bavail * space.bsize - bytes < this.limits.freeBytes || space.ffree < 4096) throw new StorageCapacityError('Report storage is low on free space. Contact the operator.');
  }
}

// A process may die holding the conservative admission lock. Surface that state
// to the existing loopback health monitor instead of serving a false-ready result.
export async function storageHealthy(root: string): Promise<boolean> {
  try { return Date.now() - (await fs.lstat(join(root, '.transient-storage.lock'))).mtimeMs < 10_000; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT'; }
}
