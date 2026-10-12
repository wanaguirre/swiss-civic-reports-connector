import { z } from 'zod';

const draftSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare'), category: z.string().trim().min(1).max(100),
    description: z.string().trim().min(10).max(3500), message: z.literal('') }).strict(),
  z.object({ action: z.literal('clarify'), category: z.null(), description: z.null(),
    message: z.string().trim().min(1).max(600) }).strict(),
  z.object({ action: z.literal('redirect'), category: z.null(), description: z.null(),
    message: z.string().trim().min(1).max(600) }).strict(),
]);
export type DraftResult = z.infer<typeof draftSchema>;

export function parseDraftResult(raw: unknown, categories: string[]): DraftResult {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) throw new Error('The AI could not produce a usable draft. Try drafting again or write the report manually.');
  const result = parsed.data;
  if (result.action === 'prepare' && !categories.includes(result.category)) throw new Error('The model returned an unavailable category.');
  return result;
}
