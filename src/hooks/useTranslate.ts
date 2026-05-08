import { useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

export const useTranslate = () => {
  const { translation } = useLanguage();

  const translateIndustry = useCallback(
    (industry: string | undefined): string => {
      if (!industry) return '';
      if (industry.toLowerCase() === 'unknown') return translation.unknown;
      if (industry.toLowerCase() === 'other') return translation.other;
      return industry;
    },
    [translation],
  );

  return {
    translateIndustry,
    translation,
  };
};
