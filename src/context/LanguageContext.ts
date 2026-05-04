import { createContext, useContext } from 'react';
import { translations } from '../utils/translations';
import { Language } from '../utils/translations';

export interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  translation: typeof translations.en;
  isRightToLeft: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
