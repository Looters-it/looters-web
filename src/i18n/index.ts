import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import it from './locales/it.json'

export const DEFAULT_LANGUAGE = 'it'

// Italian is the first language; add a locale file and a `resources` entry for each new one.
void i18n.use(initReactI18next).init({
  resources: { it: { translation: it } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

export default i18n
