import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'

import { Sidebar } from '@/components/layout/Sidebar'
import { SessionProvider } from '@/features/auth/SessionProvider'

/** Brings into view the part of the page an address points at (`/#partite`). */
function useScrollToHash() {
  const { hash, pathname } = useLocation()
  useEffect(() => {
    if (!hash) return
    // The section may still be loading: a few tries, then it is given up.
    let tries = 0
    const timer = setInterval(() => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (target ?? ++tries > 20) clearInterval(timer)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearInterval(timer)
  }, [hash, pathname])
}

function Frame() {
  const { t } = useTranslation()
  useScrollToHash()
  return (
    <div className="min-h-full">
      {/* The first stop of the Tab key: past the sidebar, straight to the page. */}
      <a
        href="#contenuto"
        className="bg-background text-foreground sr-only z-50 rounded-md border px-3 py-2 font-bold focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t('nav.skip')}
      </a>
      <Sidebar />
      {/* Beside the sidebar on a wide screen; under the floating button on a narrow one. */}
      <main id="contenuto" tabIndex={-1} className="min-h-dvh outline-none max-lg:pt-14 lg:pl-60">
        <Outlet />
      </main>
    </div>
  )
}

export function Layout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Frame />
      </SessionProvider>
    </QueryClientProvider>
  )
}
