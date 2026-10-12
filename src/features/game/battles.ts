import type { MatchState } from '@/features/matches/api'

/**
 * Attacks on the player that still wait for an answer. A siege whose round of this turn
 * was fought waits for the next turn instead.
 */
export const pendingAttacks = (state: MatchState) =>
  state.battles.filter(
    (battle) =>
      battle.role === 'defender' &&
      battle.status === 'OPEN' &&
      !battle.response &&
      !battle.foughtThisTurn,
  )

/** By how much a round went: the two parts of a hundred, the attacker's and the defender's. */
export const scoreOf = (share: number | null | undefined) => {
  if (share === null || share === undefined) return null
  const attack = Math.round(share * 100)
  return { attack, defense: 100 - attack }
}
