import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeWebSocket, guest, stubApi } from '@/test/fakes'
import { renderApp } from '@/test/render'

import i18n, {
  DEFAULT_LANGUAGE,
  availableLanguages,
  languageName,
  preferredLanguage,
  registerLanguage,
  setLanguage,
} from '.'
import italian from './locales/it.json'

type Tree = { [key: string]: string | Tree }

/** Every key of a locale with its text, flattened: `a.b.c` → text. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(prefix + key, value)
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v)
  }
  return out
}
const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()
/** A key without its plural ending: `found_one` and `found_other` are the same message. */
const message = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '')

const locales = import.meta.glob<Tree>('./locales/*.json', { eager: true, import: 'default' })
const reference = flatten(italian)

describe('locale files', () => {
  // With Italian alone this checks nothing: it is here for the day a second file arrives.
  const others = Object.entries(locales).filter(([path]) => !path.endsWith('/it.json'))

  it('finds the Italian file, the reference for all the others', () => {
    expect(Object.keys(locales)).toContain('./locales/it.json')
    expect(reference.size).toBeGreaterThan(300)
  })

  it.each(others)('%s says everything the Italian one says, and nothing else', (_path, tree) => {
    const translated = flatten(tree)
    const wanted = new Set([...reference.keys()].map(message))
    const given = new Set([...translated.keys()].map(message))
    expect(
      [...wanted].filter((key) => !given.has(key)),
      'missing',
    ).toEqual([])
    expect(
      [...given].filter((key) => !wanted.has(key)),
      'unknown',
    ).toEqual([])
  })

  it.each(others)('%s keeps the placeholders of every message', (_path, tree) => {
    const wrong: string[] = []
    for (const [key, text] of flatten(tree)) {
      const original =
        reference.get(key) ?? [...reference].find(([k]) => message(k) === message(key))?.[1] ?? ''
      // A plural form may leave the count out ("one more"), never add a name.
      const allowed = new Set(placeholders(original))
      if (placeholders(text).some((name) => !allowed.has(name))) wrong.push(key)
    }
    expect(wrong).toEqual([])
  })

  it('checks a second language the same way', () => {
    // The rule itself, on a made-up locale: one key missing, one placeholder invented.
    const made = flatten({ nav: { skip: 'Skip {{where}}' } })
    expect(placeholders(made.get('nav.skip') ?? '')).not.toEqual(
      placeholders(reference.get('nav.skip') ?? ''),
    )
    expect(reference.has('nav.language')).toBe(true)
    expect(made.has('nav.language')).toBe(false)
  })
})

describe('choosing the language', () => {
  const english = {
    ...italian,
    nav: { ...italian.nav, language: 'Language', skip: 'Skip to content' },
  }
  beforeEach(() => {
    FakeWebSocket.install()
    localStorage.clear()
  })
  afterEach(async () => {
    await setLanguage(DEFAULT_LANGUAGE)
    localStorage.clear()
  })

  // Holds until a second locale file is added; from then on the choice is always offered.
  const single = Object.keys(locales).length === 1
  it.runIf(single)(
    'starts in Italian and offers no choice while there is one language only',
    async () => {
      expect(availableLanguages()).toEqual(['it'])
      expect(preferredLanguage()).toBe('it')
      stubApi({ ...guest })
      renderApp()
      await userEvent.click(await screen.findByRole('button', { name: 'Accesso e registrazione' }))
      await screen.findByRole('dialog')
      expect(screen.queryByRole('combobox', { name: 'Lingua' })).not.toBeInTheDocument()
    },
  )

  it('offers a second language once it exists, loads it when chosen and remembers it', async () => {
    let loaded = 0
    registerLanguage('en', () => {
      loaded += 1
      return Promise.resolve(english)
    })
    expect(availableLanguages()).toContain('en')
    expect(availableLanguages()[0]).toBe('it')
    expect(languageName('en')).toBe('English')
    expect(languageName('it')).toBe('Italiano')
    expect(loaded).toBe(0)

    stubApi({ ...guest })
    renderApp()
    expect(screen.getByRole('link', { name: 'Vai al contenuto' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Accesso e registrazione' }))
    await userEvent.click(await screen.findByRole('combobox', { name: 'Lingua' }))
    await userEvent.click(await screen.findByRole('option', { name: 'English' }))

    expect(await screen.findByRole('link', { name: 'Skip to content' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    expect(loaded).toBe(1)
    expect(localStorage.getItem('lang')).toBe('en')
    // The choice made on this device wins over the language of the browser.
    expect(preferredLanguage()).toBe('en')
    // What the second language does not say yet is shown in Italian, never as a key.
    expect(i18n.t('notFound.title')).toBe('Pagina non trovata')
  })

  it('falls back to Italian for a language it does not have', async () => {
    await setLanguage('zz')
    expect(i18n.language).toBe('it')
    const browser = vi.spyOn(navigator, 'languages', 'get')
    browser.mockReturnValue(['fr-FR', 'fr'])
    localStorage.setItem('lang', 'zz')
    expect(preferredLanguage()).toBe('it')
    // Without a choice made here, the browser's language is taken when the interface has it.
    registerLanguage('en', () => Promise.resolve(italian))
    browser.mockReturnValue(['de', 'en-GB', 'it'])
    expect(preferredLanguage()).toBe('en')
    browser.mockRestore()
  })
})
