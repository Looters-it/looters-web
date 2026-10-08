import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import it from './locales/it.json'

type Translation = typeof it

export const DEFAULT_LANGUAGE = 'it'
const STORAGE_KEY = 'lang'

/**
 * The other languages: every `locales/<code>.json` next to the Italian one,
 * found at build time and loaded only when chosen. Adding a language is
 * adding that file (docs/ARCHITECTURE.md, "Languages"): nothing here changes.
 */
const loaders = new Map<string, () => Promise<Translation>>()
for (const [path, load] of Object.entries(
  import.meta.glob<Translation>('./locales/*.json', { import: 'default' }),
)) {
  const code = /\/([\w-]+)\.json$/.exec(path)?.[1]
  if (code && code !== DEFAULT_LANGUAGE) loaders.set(code, load)
}

// Italian is the first language and the fallback: a key missing elsewhere shows in Italian.
void i18n.use(initReactI18next).init({
  resources: { [DEFAULT_LANGUAGE]: { translation: it } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

/** The languages the interface can be shown in, the default first. */
export function availableLanguages(): string[] {
  return [DEFAULT_LANGUAGE, ...[...loaders.keys()].sort()]
}

/** A language under its own name: "Italiano", "English". */
export function languageName(code: string): string {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
}

/** Makes a language available without a file: for tests. */
export function registerLanguage(code: string, load: () => Promise<Translation>): void {
  loaders.set(code, load)
}

/** Shows the interface in a language, loading it first, and remembers the choice. */
export async function setLanguage(code: string): Promise<void> {
  const language = availableLanguages().includes(code) ? code : DEFAULT_LANGUAGE
  const load = loaders.get(language)
  if (load && !i18n.hasResourceBundle(language, 'translation')) {
    i18n.addResourceBundle(language, 'translation', await load())
  }
  await i18n.changeLanguage(language)
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not remembered, that is all.
  }
}

/**
 * The language to start in: the one chosen before on this device, otherwise
 * the first language of the browser that the interface has, otherwise Italian.
 */
export function preferredLanguage(): string {
  const available = availableLanguages()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // No storage: go by the browser.
  }
  if (saved && available.includes(saved)) return saved
  for (const wanted of navigator.languages) {
    const match = available.find((code) => code === wanted || code === wanted.split('-')[0])
    if (match) return match
  }
  return DEFAULT_LANGUAGE
}

export default i18n
