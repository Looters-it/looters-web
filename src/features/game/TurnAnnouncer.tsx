import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

import { usePhase } from './phase'
import { tick, turnSound } from './tick'

/** How long the announcement of a new turn stays, and from which second the end is counted. */
const NEW_TURN_MS = 2600
const COUNT_FROM = 10

/**
 * What is said about the passing of the turns, in two places: the last ten seconds
 * of a turn counted one by one among the announcements at the top of the map, and
 * the number of the new turn, for a moment, in the middle of it. Each part is
 * mounted where it shows; both go by themselves.
 */
export function TurnAnnouncer({
  part,
  match,
  sound,
}: {
  /** Which of the two it shows: the turn that begins, or the count of its last seconds. */
  part: 'turn' | 'count'
  match: MatchState['match']
  /** Whether the last seconds are also heard: the tick of a clock, one a second. */
  sound: boolean
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  // The turn the page opened on is not news: only the ones that begin while it is watched.
  const [seenTurn, setSeenTurn] = useState(match.currentTurn)
  // What is announced: the number of a turn that begins or, with 'action', its second part.
  const [announced, setAnnounced] = useState<number | 'action' | null>(null)
  // A paused match counts nothing down.
  const running = match.status === 'ONGOING' && !match.pausedAt
  const phase = usePhase(match)
  const [seenPhase, setSeenPhase] = useState(phase)
  if (phase !== seenPhase) {
    setSeenPhase(phase)
    // The preliminary part gave way to the action within the turn being watched.
    if (seenPhase === 'PRELIMINARY' && phase === 'ACTION' && match.currentTurn === seenTurn) {
      setAnnounced('action')
    }
  }
  // Read when a sound is due, without making the sound itself depend on the switch.
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
  }, [sound])

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
    // A sound of its own for the turn that begins, unlike the ticking and the warnings.
    if (part === 'turn' && soundRef.current && announced !== 'action') turnSound()
    const timer = setTimeout(() => setAnnounced(null), NEW_TURN_MS)
    return () => clearTimeout(timer)
  }, [announced, part])

  const left =
    running && match.turnEndsAt
      ? Math.ceil((new Date(match.turnEndsAt).getTime() - now) / 1000)
      : null
  const counting = announced === null && left !== null && left >= 1 && left <= COUNT_FROM

  // The clock ticks once for every second counted: tic on the even ones, tac on the odd.
  const second = counting ? left : null
  useEffect(() => {
    if (part === 'count' && sound && second !== null) tick(second % 2 === 0)
  }, [part, sound, second])

  if (part === 'turn') {
    if (announced === null) return null
    return (
      // In the middle of the map, in large, for a moment; it takes no click, so the
      // map under it stays the player's.
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <p
          key={announced}
          role="status"
          className="bg-background/90 animate-in fade-in zoom-in-75 font-display rounded-2xl px-10 pt-6 pb-4 text-5xl shadow-lg duration-300 sm:text-7xl"
        >
          {announced === 'action'
            ? t('game.phase.actionBegins')
            : t('game.turn.begins', { turn: announced })}
          {announced !== 'action' && phase === 'PRELIMINARY' && (
            <span className="text-muted-foreground block text-center font-sans text-xl sm:text-2xl">
              {t('game.phase.PRELIMINARY')}
            </span>
          )}
        </p>
      </div>
    )
  }

  if (!counting) return null
  return (
    // With the other announcements, at the top of the map: nothing that lasts stands
    // in the middle of it, where the player is pointing.
    <p
      role="status"
      // The count is read out once, when it starts: ten announcements in ten seconds are noise.
      aria-live={left !== COUNT_FROM ? 'off' : 'polite'}
      className="bg-background animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-3 rounded-lg px-4 py-2 shadow-lg duration-300"
    >
      <span className="font-bold">{t('game.turn.endingShort')}</span>
      <span
        key={left}
        className="animate-in zoom-in-150 font-display text-secondary w-10 pt-1 text-center text-3xl leading-none duration-300"
      >
        {left}
      </span>
    </p>
  )
}
