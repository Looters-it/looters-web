import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Says in words why a municipality has no neighbours: it is an island, or an exclave. */
export function IsolationBadge({ kind }: { kind: 'island' | 'exclave' }) {
  const { t } = useTranslation()
  return (
    <span
      title={t(`game.unit.${kind}Hint`)}
      className="rounded-pill border px-2 font-sans text-sm font-normal whitespace-nowrap"
    >
      {t(`game.unit.${kind}`)}
    </span>
  )
}

/** The box shown for a selected municipality: its name, then whatever the page adds. */
export function UnitCard({
  name,
  isolation,
  children,
}: {
  name: string
  isolation?: 'island' | 'exclave'
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex flex-wrap items-center gap-2 text-lg leading-tight">
        {name}
        {isolation && <IsolationBadge kind={isolation} />}
      </h3>
      {children}
    </div>
  )
}
