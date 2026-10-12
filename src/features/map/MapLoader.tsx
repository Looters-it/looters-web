import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * What stands where a map will be while it is on its way: the same turning circle
 * that signing in and out show, in the middle of the frame the map will fill.
 */
export function MapLoader({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={cn('text-muted-foreground flex items-center justify-center', className)}
    >
      <LoaderCircle aria-hidden="true" className="size-10 animate-spin" />
      <span className="sr-only">{t('game.map.loading')}</span>
    </div>
  )
}
