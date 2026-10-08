import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import '@/i18n'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom lacks the pointer and scrolling APIs that the Select component uses.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => undefined
Element.prototype.releasePointerCapture ??= () => undefined
Element.prototype.scrollIntoView ??= () => undefined
