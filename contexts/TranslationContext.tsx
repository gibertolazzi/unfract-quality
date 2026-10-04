'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import itDict from '@/lib/i18n/locales/it.json';

// Use Italian as the type definition base
export type Dictionary = typeof itDict;

interface TranslationContextProps {
  t: Dictionary;
  locale: string;
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
  return (
    <TranslationContext.Provider value={{ t: dictionary, locale }}>
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
