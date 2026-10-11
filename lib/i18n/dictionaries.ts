import 'server-only';
import { normalizeLocale, type Locale } from './locale';

export { normalizeLocale } from './locale';

const dictionaries = {
  it: () => import('./locales/it.json').then((module) => module.default),
  en: () => import('./locales/en.json').then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  return dictionaries[normalizeLocale(locale)]();
};
