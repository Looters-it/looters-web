import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import './i18n'
import './index.css'
import { routes } from './app/routes'
import { reportUncaughtErrors } from './lib/report'

reportUncaughtErrors()

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
