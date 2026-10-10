import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

/** How long the announcement of a new turn stays, and from which second the end is counted. */
const NEW_TURN_MS = 2600
const COUNT_FROM = 10

/**
 * What is said about the passing of the turns, among the announcements at the top
 * of the map: the last ten seconds of a turn counted one by one, and the number of
 * the new turn when it begins. It goes by itself.
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

  if (announced === null && !counting) return null

  return (
    // With the other announcements, at the top of the map: nothing in the middle of
    // it, where the player is pointing.
    <p
      role="status"
      // The count is read out once, when it starts: ten announcements in ten seconds are noise.
      aria-live={counting && left !== COUNT_FROM ? 'off' : 'polite'}
      className="bg-background animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-3 rounded-lg px-4 py-2 shadow-lg duration-300"
    >
      {announced !== null ? (
        <span className="font-display pt-1 text-2xl">
          {t('game.turn.begins', { turn: announced })}
        </span>
      ) : (
        <>
          <span className="font-bold">{t('game.turn.endingShort')}</span>
          <span
            key={left}
            className="animate-in zoom-in-150 font-display text-secondary w-10 pt-1 text-center text-3xl leading-none duration-300"
          >
            {left}
          </span>
        </>
      )}
    </p>
  )
}
