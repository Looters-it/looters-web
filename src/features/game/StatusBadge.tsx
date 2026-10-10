import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/** How a municipality stands: nobody's, owned and quiet, or the target or source of a battle. */
export type UnitStatus = 'neutral' | 'peace' | 'war'

// Literal colours, the same on every surface: the status is read by its colour first.
const TONES: Record<UnitStatus, string> = {
  neutral: 'bg-[#7f8ea3] text-white',
  peace: 'bg-[#1f9d55] text-white',
  war: 'bg-[#e11d2e] text-white',
}

export const unitStatus = (owned: boolean, inBattle: boolean): UnitStatus =>
  !owned ? 'neutral' : inBattle ? 'war' : 'peace'

/** The status of a municipality as a coloured badge. */
export function StatusBadge({ status, className }: { status: UnitStatus; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'rounded-pill inline-flex h-7 items-center px-3 text-sm font-bold whitespace-nowrap',
        TONES[status],
        className,
      )}
    >
      {t(`game.unit.${status}`)}
    </span>
  )
}
