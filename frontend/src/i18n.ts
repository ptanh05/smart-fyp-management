import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import vi from './locales/vi.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    fallbackLng: 'vi',
    supportedLngs: ['en', 'vi'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      // Only honor an explicit user language selection saved in localStorage;
      // default to Vietnamese so English-locale browsers do not flash English.
      order: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

if (typeof document !== 'undefined') {
  const initialLng = (i18n.resolvedLanguage || i18n.language || 'vi').startsWith('en') ? 'en' : 'vi';
  document.documentElement.lang = initialLng;
}

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = (lng || 'vi').startsWith('en') ? 'en' : 'vi';
  }
});

export default i18n;
