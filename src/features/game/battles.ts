import type { MatchState } from '@/features/matches/api'

/** Attacks on the player that still wait for an answer. */
export const pendingAttacks = (state: MatchState) =>
  state.battles.filter(
    (battle) => battle.role === 'defender' && battle.status === 'OPEN' && !battle.response,
  )
