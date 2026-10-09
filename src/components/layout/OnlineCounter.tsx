import { useTranslation } from 'react-i18next'

import { RollingNumber } from '@/components/RollingNumber'
import { useSession } from '@/features/auth/session-context'

/** Players connected right now across the platform, pushed over WebSocket. */
export function OnlineCounter() {
  const { t } = useTranslation()
  const { online } = useSession()
  if (online === null) return null

  return (
    // Set like an entry of the menu it sits above: same font, same size, centred.
    <p
      className="font-display flex items-center justify-center gap-2 px-3 py-1 text-base tracking-[0.02em] whitespace-nowrap"
      aria-live="polite"
    >
      <span className="bg-hunter-green-300 size-2 rounded-full" aria-hidden="true" />
      <RollingNumber value={online} className="font-display" />
      <span>{t('nav.online', { count: online })}</span>
    </p>
  )
}
