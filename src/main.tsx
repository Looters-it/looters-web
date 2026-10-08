import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { preferredLanguage, setLanguage } from './i18n'
import './index.css'
import { routes } from './app/routes'
import { reportUncaughtErrors } from './lib/report'

reportUncaughtErrors()

// Before the first render, so that the page does not appear in one language and turn into another.
await setLanguage(preferredLanguage()).catch(() => undefined)

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
