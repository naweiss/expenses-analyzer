import { Locale } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { Language } from './translations';

export const getDateLocale = (language: Language): Locale => {
  return language === 'he' ? he : enUS;
};
