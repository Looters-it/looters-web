import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { RollingNumber } from '@/components/RollingNumber'
import { useSession } from '@/features/auth/session-context'

/** Real-time count of connected players, set like an entry of the menu it sits above. */
export function OnlineCounter() {
  const { t } = useTranslation()
  const { online } = useSession()
  const number = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)

  // When the count changes the digits roll and the number swells for a moment,
  // so that someone arriving or leaving is noticed. Not on the first count.
  useEffect(() => {
    const before = shown.current
    shown.current = online
    if (before === null || online === null || before === online) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    number.current?.animate?.([{ scale: 1 }, { scale: 1.5 }, { scale: 1 }], {
      duration: 600,
      easing: 'ease-in-out',
    })
  }, [online])

  if (online === null) return null

  return (
    <p
      className="font-display flex items-center justify-center gap-2 px-3 py-1 text-base tracking-[0.02em] whitespace-nowrap"
      aria-live="polite"
    >
      <span ref={number} className="inline-flex">
        <RollingNumber value={online} className="font-display" />
      </span>
      <span>{t('nav.online', { count: online })}</span>
    </p>
  )
}
