import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { coordinates, type Photo } from './model.js';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const TTL_MS = 60 * 60 * 1000;
export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** Bound and normalize untrusted image bytes; preserve GPS only as an unconfirmed suggestion. */
export async function importPhoto(
  input: { path?: string; base64?: string },
  allowPaths: boolean,
  now = Date.now(),
): Promise<Photo> {
  if (!!input.path === !!input.base64)
    throw new Error('Provide exactly one photo path or base64 string.');
  let bytes: Buffer;
  if (input.path) {
    if (!allowPaths)
      throw new Error('File paths are disabled over HTTP. Send the image as base64.');
    const file = await open(
      input.path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > MAX_PHOTO_BYTES)
        throw new Error('Photo must be a regular file no larger than 15 MiB.');
      bytes = Buffer.alloc(info.size);
      const { bytesRead } = await file.read(bytes, 0, info.size, 0);
      bytes = bytes.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  } else {
    if (
      input.base64!.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 ||
      input.base64!.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64!)
    ) {
      throw new Error(
        'Invalid base64 or image larger than 15 MiB. Use raw base64, without a data URL prefix.',
      );
    }
    bytes = Buffer.from(input.base64!, 'base64');
    if (bytes.toString('base64') !== input.base64) throw new Error('Invalid base64 encoding.');
  }
  const raster = sharp(bytes, { limitInputPixels: 60_000_000, failOn: 'error' });
  const metadata = await raster.metadata();
  if (
    !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format ?? '') ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new Error(
      'Use a single JPEG, PNG or WebP photo. HEIC support depends on the installed image decoder; export JPEG if needed.',
    );
  }
  let gps: Photo['gps'];
  try {
    const raw = await exifr.gps(bytes);
    const parsed = coordinates.safeParse(raw);
    if (parsed.success) gps = parsed.data;
  } catch {
    /* A photo without GPS is normal. The agent must ask for its location. */
  }
  const { data, info } = await raster
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return {
    id: randomUUID(),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL_MS).toISOString(),
    jpeg: data.toString('base64'),
    sha256: hash(data),
    width: info.width,
    height: info.height,
    ...(gps ? { gps } : {}),
  };
}

export async function thumbnail(photo: Photo): Promise<string> {
  return (
    await sharp(Buffer.from(photo.jpeg, 'base64'))
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer()
  ).toString('base64');
}
