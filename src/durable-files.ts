import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';

// A flushed file can still lose its directory entry after a host crash. Keep
// directory persistence inside the storage boundary and never ignore failures.
export async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    throw new Error(
      'Private storage could not be synchronized. Check report status before trying again.',
    );
  }
}

export async function initializeDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  // Include ancestors even if mkdir found them already present: another process
  // may have stopped after creating them but before syncing their parent entry.
  // This runs once per Store, rather than on every photo or receipt write.
  let current = resolve(directory);
  for (;;) {
    await syncDirectory(current);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
