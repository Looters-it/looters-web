import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * What stands where a map will be while it is on its way: the curtain of signing in
 * and out (SessionCurtain) in the frame the map will fill. It names the game, says
 * what is coming, and fills its bar again and again until the map is there.
 */
export function MapLoader({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={cn(
        'bg-background flex flex-col items-center justify-center gap-4 px-6 text-center',
        className,
      )}
    >
      <b aria-hidden="true" className="font-display text-4xl font-normal sm:text-5xl">
        {t('app.name')}
      </b>
      <p className="text-lg">{t('game.map.loading')}</p>
      <div
        aria-hidden="true"
        className="bg-key-soft rounded-pill h-2 w-56 max-w-full overflow-hidden"
      >
        <div className="bg-secondary curtain-fill curtain-fill-again h-full origin-left" />
      </div>
    </div>
  )
}
