import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/** How long the curtain takes to cover the page and to lift. */
export const CURTAIN_MS = { cover: 250, lift: 350 } as const
/** How long it stays: a welcome is read, a goodbye is quick. */
export const CURTAIN_STAY_MS = { in: 1000, new: 1000, out: 350 } as const

export interface Curtain {
  /** Coming back in, in for the first time, or going out. */
  kind: 'in' | 'new' | 'out'
  name: string
  /** True while it fades away over the page that is now behind it. */
  lifting: boolean
}

/**
 * What covers the whole screen for a moment while a session begins or ends:
 * signing in and out take an instant, and without it the page would simply
 * be another one. It names the game, greets the player, and fills a bar.
 */
export function SessionCurtain({ curtain }: { curtain: Curtain }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={cn(
        'bg-background animate-in fade-in fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 text-center duration-200',
        curtain.lifting && 'opacity-0 transition-opacity duration-300',
      )}
    >
      <b aria-hidden="true" className="font-display text-5xl font-normal sm:text-7xl">
        {t('app.name')}
      </b>
      <p className="text-xl">{t(`auth.curtain.${curtain.kind}`, { name: curtain.name })}</p>
      <div aria-hidden="true" className="bg-key-soft rounded-pill h-2 w-56 overflow-hidden">
        <div
          className="bg-secondary curtain-fill h-full origin-left"
          style={{
            animationDuration: `${String(CURTAIN_MS.cover + CURTAIN_STAY_MS[curtain.kind])}ms`,
          }}
        />
      </div>
    </div>
  )
}
