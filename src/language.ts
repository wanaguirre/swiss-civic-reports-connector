import { z } from 'zod';

export const language = z.enum(['en', 'de', 'fr', 'it', 'es']);
export type Language = z.infer<typeof language>;
export const languageNames: Record<Language, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish',
};
