import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en.json';
import itDictionary from '@/lib/i18n/locales/it.json';
import { normalizeLocale } from '@/lib/i18n/locale';

function flatten(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object'
      ? flatten(child as Record<string, unknown>, path)
      : [path];
  });
}

describe('localization resources', () => {
  it('keep Italian and English dictionaries structurally complete', () => {
    expect(flatten(en).sort()).toEqual(flatten(itDictionary).sort());
  });

  it('normalizes regional English language tags', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en_GB')).toBe('en');
    expect(normalizeLocale('it-IT')).toBe('it');
    expect(normalizeLocale('fr-FR')).toBe('it');
  });
});
