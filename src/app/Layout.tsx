import { Outlet } from 'react-router'

import { Navbar } from '@/components/layout/Navbar'
import { SessionProvider } from '@/features/auth/SessionProvider'

export function Layout() {
  return (
    <SessionProvider>
      <div className="flex min-h-full flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </SessionProvider>
  )
}
