import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

/** How long the announcement of a new turn stays, and from which second the end is counted. */
const NEW_TURN_MS = 2600
const COUNT_FROM = 10

/**
 * What is said over the map, in large, about the passing of the turns: the last
 * ten seconds of a turn counted one by one, and the number of the new turn when
 * it begins. It gets in nobody's way: it takes no click and goes by itself.
 */
export function TurnAnnouncer({ match }: { match: MatchState['match'] }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  // The turn the page opened on is not news: only the ones that begin while it is watched.
  const [seenTurn, setSeenTurn] = useState(match.currentTurn)
  const [announced, setAnnounced] = useState<number | null>(null)
  const running = match.status === 'ONGOING'

  if (running && match.currentTurn !== seenTurn) {
    setSeenTurn(match.currentTurn)
    setAnnounced(match.currentTurn)
  }

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (announced === null) return
    const timer = setTimeout(() => setAnnounced(null), NEW_TURN_MS)
    return () => clearTimeout(timer)
  }, [announced])

  if (!running) return null
  const left = match.turnEndsAt
    ? Math.ceil((new Date(match.turnEndsAt).getTime() - now) / 1000)
    : null
  const counting = announced === null && left !== null && left >= 1 && left <= COUNT_FROM

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {announced !== null && (
        <p
          key={announced}
          role="status"
          className="bg-background/90 animate-in fade-in zoom-in-75 font-display rounded-2xl px-10 pt-6 pb-4 text-5xl shadow-lg duration-300 sm:text-7xl"
        >
          {t('game.turn.begins', { turn: announced })}
        </p>
      )}
      {counting && (
        // Read out once, when the count starts: ten announcements in ten seconds would be noise.
        <p className="flex flex-col items-center gap-1 text-center">
          <span className="sr-only" role="status">
            {t('game.turn.ending', { count: COUNT_FROM })}
          </span>
          <span
            key={left}
            aria-hidden="true"
            className="animate-in fade-in zoom-in-150 font-display text-secondary text-[9rem] leading-none drop-shadow-[0_4px_12px_rgb(0_0_0/0.6)] duration-300 sm:text-[13rem]"
          >
            {left}
          </span>
          <span
            aria-hidden="true"
            className="bg-background/90 rounded-pill px-4 py-1 text-base shadow-md"
          >
            {t('game.turn.endingShort')}
          </span>
        </p>
      )}
    </div>
  )
}
