import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { Navbar } from '@/components/layout/Navbar'
import { SessionProvider } from '@/features/auth/SessionProvider'

export function Layout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )

  const { t } = useTranslation()

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <div className="flex min-h-full flex-col">
          {/* The first stop of the Tab key: past the navbar, straight to the page. */}
          <a
            href="#contenuto"
            className="bg-background text-foreground sr-only z-50 rounded-md border px-3 py-2 font-bold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
          >
            {t('nav.skip')}
          </a>
          <Navbar />
          <main id="contenuto" tabIndex={-1} className="flex-1 outline-none">
            <Outlet />
          </main>
        </div>
      </SessionProvider>
    </QueryClientProvider>
  )
}
