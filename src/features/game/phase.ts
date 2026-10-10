import { useEffect, useState } from 'react'

import type { MatchState } from '@/features/matches/api'

/**
 * The two parts of a turn: the preliminary one, for putting the empire in order
 * (resources, structures, merges, the capital), then the one for acting on the
 * others (annexations and attacks).
 */
export type TurnPhase = 'PRELIMINARY' | 'ACTION'

type Clock = Pick<MatchState['match'], 'status' | 'preliminaryEndsAt'>

const phaseAt = (match: Clock, now: number): TurnPhase | null =>
  match.status !== 'ONGOING'
    ? null
    : match.preliminaryEndsAt && now < new Date(match.preliminaryEndsAt).getTime()
      ? 'PRELIMINARY'
      : 'ACTION'

/** The part of the turn the match is in now, kept up to date when it changes; null out of play. */
export function usePhase(match: Clock): TurnPhase | null {
  const [now, setNow] = useState(() => Date.now())
  const { status, preliminaryEndsAt } = match
  useEffect(() => {
    if (status !== 'ONGOING' || !preliminaryEndsAt) return
    const left = new Date(preliminaryEndsAt).getTime() - Date.now()
    // A new turn moved the end forward: read the clock again, now and when it is reached.
    const timers = [setTimeout(() => setNow(Date.now()), 0)]
    if (left > 0) timers.push(setTimeout(() => setNow(Date.now()), left + 30))
    return () => timers.forEach(clearTimeout)
  }, [status, preliminaryEndsAt])
  return phaseAt(match, now)
}
