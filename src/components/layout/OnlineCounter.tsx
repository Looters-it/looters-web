import { useTranslation } from 'react-i18next'

import { RollingNumber } from '@/components/RollingNumber'
import { useSession } from '@/features/auth/session-context'

/** Players connected right now across the platform, pushed over WebSocket. */
export function OnlineCounter() {
  const { t } = useTranslation()
  const { online } = useSession()
  if (online === null) return null

  return (
    <p className="flex items-center gap-2 whitespace-nowrap" aria-live="polite">
      <span className="bg-hunter-green-300 size-2 rounded-full" aria-hidden="true" />
      <RollingNumber value={online} className="text-lg font-bold" />
      <span className="hidden sm:inline">{t('nav.online', { count: online })}</span>
    </p>
  )
}
