import { z } from 'zod';
import type { Language } from './language.js';

export const coordinates = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const reportInput = z
  .object({
    ...coordinates.shape,
    location_label: z.string().trim().min(3).max(250),
    location_confirmed: z
      .literal(true)
      .describe('The user has confirmed the exact issue location, not just the nearest address.'),
    category: z.string().trim().min(1).max(100),
    description: z.string().trim().min(10).max(5000),
    email: z.string().email().max(254),
    name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(50).optional(),
    photo_ids: z.array(z.string().uuid()).max(3).default([]),
    extra_fields: z.record(z.string().max(100), z.string().max(500)).default({}),
  })
  .strict();
export type ReportInput = z.infer<typeof reportInput>;
export type Point = z.infer<typeof coordinates>;
export type Photo = {
  id: string;
  created_at: string;
  expires_at: string;
  jpeg: string;
  sha256: string;
  width: number;
  height: number;
  gps?: Point;
  capture_location?: Point;
};
export const destination = z
  .object({ bfs_id: z.number().int().positive(), service_id: z.string().min(1).max(100) })
  .strict();
export type Destination = z.infer<typeof destination>;
export type Prepared = {
  approval_fingerprint?: string;
  destination?: Destination;
  terms_url?: string;
  id: string;
  created_at: string;
  expires_at: string;
  confirmation_token: string;
  input: ReportInput;
  photos: Photo[];
  fingerprint: string;
};
// What the resident's history shows and what tracking matches against. The sent
// description is kept so the resident can see what was reported; contact details
// and photos are never kept. Receipts from before this change have only the hash.
// An older receipt the resident links by number takes its details from the city's
// public record instead (source 'public'; the street label is then empty).
export type ReceiptSummary = {
  municipality: { bfs_id: number; name: string; reporting_service: string };
  category: string;
  location_label: string;
  latitude: number;
  longitude: number;
  text_sha256: string;
  description?: string;
  source?: 'public';
};
// The latest public state of the report in the municipality's own list.
export type Tracking = {
  checked_at: string;
  status?: string;
  published_at?: string;
  updated_at?: string;
  forwarded_at?: string;
  reply?: string;
  matched_by?: 'id' | 'text' | 'place';
};
// A translation records the exact text it translates, so a changed reply is
// translated again rather than shown stale.
export type Translation = { source_sha256: string; text: string };
export type Receipt = {
  destination?: Destination;
  terms_url?: string;
  tracking_available?: boolean;
  fingerprint: string;
  preview_id: string;
  created_at: string;
  state: 'sending' | 'accepted' | 'confirmation_pending' | 'rejected' | 'unknown';
  report_id?: string;
  url?: string;
  message: string;
  summary?: ReceiptSummary;
  tracking?: Tracking;
  // Resident acknowledgement, separate from evidence published by the city.
  email_confirmed_at?: string;
  // The sent text and the city's reply in the languages the resident has read
  // them in; each language is added only when it is first viewed.
  translations?: Partial<Record<Language, { reply?: Translation; description?: Translation }>>;
};
export type Requirements = {
  photo_required: boolean;
  name_required?: boolean;
  max_photos?: number;
  phone_required: boolean;
  bodies: string[];
  extra_fields: {
    code: string;
    description: string;
    required: boolean;
    datatype?: string;
    max_length?: number;
    // Public report text that clients translate alongside the description.
    translate?: boolean;
    values?: unknown;
  }[];
};
export const CITY = 'https://www.zueriwieneu.ch';
export function mapUrl(point: Point): string {
  const url = new URL('/around', CITY);
  url.search = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
  }).toString();
  return url.href;
}
export function fallbackUrl(input: ReportInput): string {
  const url = new URL('/report/new', CITY);
  url.search = new URLSearchParams({
    skipped: '1',
    pc: input.location_label,
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    prefill_category: input.category,
    prefill_description: input.description,
  }).toString();
  return url.href;
}
