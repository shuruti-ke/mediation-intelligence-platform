import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import sw from './locales/sw.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, sw, fr, ar },
    fallbackLng: 'en',
    supportedLngs: ['en', 'sw', 'fr', 'ar'],
    interpolation: { escapeValue: false },
  });

export default i18n;
