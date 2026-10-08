import type { ReactNode } from 'react'

/** The box shown for a selected municipality: its name, then whatever the page adds. */
export function UnitCard({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-lg leading-tight">{name}</h3>
      {children}
    </div>
  )
}
