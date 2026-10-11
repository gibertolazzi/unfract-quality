export type Locale = 'it' | 'en';

export const normalizeLocale = (locale: string | undefined): Locale => {
  const primaryLanguage = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return primaryLanguage === 'en' ? 'en' : 'it';
};
