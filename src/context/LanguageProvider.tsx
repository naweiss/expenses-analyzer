import React, { useState, useEffect, useMemo } from 'react';
import { translations } from '../utils/translations';
import { LanguageContext } from './LanguageContext';
import { Language } from '../utils/translations';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('he');

  const isRightToLeft = currentLanguage === 'he';
  const translation = translations[currentLanguage];

  useEffect(() => {
    document.documentElement.dir = isRightToLeft ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
  }, [isRightToLeft, currentLanguage]);

  const value = useMemo(
    () => ({
      currentLanguage,
      setLanguage: setCurrentLanguage,
      translation,
      isRightToLeft,
    }),
    [currentLanguage, translation, isRightToLeft],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
