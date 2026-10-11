'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import itDict from '@/lib/i18n/locales/it.json';
import enDict from '@/lib/i18n/locales/en.json';

// Use Italian as the type definition base
export type Dictionary = typeof itDict;

interface TranslationContextProps {
  t: Dictionary;
  locale: string;
  setLocale: (locale: 'it' | 'en') => void;
}

const TranslationContext = createContext<TranslationContextProps | undefined>(undefined);

export const TranslationProvider = ({
  children,
  dictionary,
  locale,
}: {
  children: ReactNode;
  dictionary: Dictionary;
  locale: string;
}) => {
  const [activeLocale, setActiveLocale] = useState<'it' | 'en'>(locale === 'en' ? 'en' : 'it');
  const [activeDictionary, setActiveDictionary] = useState<Dictionary>(dictionary);

  useEffect(() => {
    const normalizedLocale = locale === 'en' ? 'en' : 'it';
    setActiveLocale(normalizedLocale);
    setActiveDictionary(dictionary);

    // Respect the browser language for first-time visitors while keeping the
    // server-rendered Italian default stable until hydration completes.
    if (!document.cookie.includes('NEXT_LOCALE=') && normalizedLocale === 'it') {
      const browserLocale = navigator.language.toLowerCase().split(/[-_]/)[0];
      if (browserLocale === 'en') {
        setActiveLocale('en');
        setActiveDictionary(enDict);
      }
    }
  }, [dictionary, locale]);

  const setLocale = useCallback((nextLocale: 'it' | 'en') => {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    setActiveLocale(nextLocale);
    setActiveDictionary(nextLocale === 'en' ? enDict : itDict);
  }, []);

  return (
    <TranslationContext.Provider value={{ t: activeDictionary, locale: activeLocale, setLocale }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
