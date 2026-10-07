import { Outlet } from 'react-router'

import { Navbar } from '@/components/layout/Navbar'

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
