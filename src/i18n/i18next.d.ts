import 'i18next'

import type it from './locales/it.json'

// Translation keys are checked at compile time against the Italian file.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof it }
  }
}
