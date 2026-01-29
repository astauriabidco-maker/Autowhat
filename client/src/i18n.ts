import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';

const resources = {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'fr',
        supportedLngs: ['fr', 'en', 'es'],

        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng'
        },

        interpolation: {
            escapeValue: false // React already escapes
        },

        debug: false
    });

export default i18n;
