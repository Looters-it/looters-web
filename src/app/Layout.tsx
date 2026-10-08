import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { Navbar } from '@/components/layout/Navbar'
import { SessionProvider } from '@/features/auth/SessionProvider'

export function Layout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <div className="flex min-h-full flex-col">
          <Navbar />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </SessionProvider>
    </QueryClientProvider>
  )
}
