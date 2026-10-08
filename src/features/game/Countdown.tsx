import { useEffect, useState } from 'react'

import { formatRemaining } from './remaining'

/** A clock counting down to the end of the turn. */
export function Countdown({ until, label }: { until: string; label: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <time dateTime={until} aria-label={label} className="font-mono font-bold tabular-nums">
      {formatRemaining(new Date(until).getTime() - now)}
    </time>
  )
}
