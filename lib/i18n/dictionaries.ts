import 'server-only';

const dictionaries = {
  it: () => import('./locales/it.json').then((module) => module.default),
  en: () => import('./locales/en.json').then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;

export const normalizeLocale = (locale: string | undefined): Locale =>
  locale === 'en' ? 'en' : 'it';

export const getDictionary = async (locale: string) => {
  return dictionaries[normalizeLocale(locale)]();
};
