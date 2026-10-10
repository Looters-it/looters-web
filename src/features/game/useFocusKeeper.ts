import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { matchApi, type MatchState } from '@/features/matches/api'

import { distribute, sameAmounts, type Amounts } from './allocation'
import { focusWeights, loadFocus } from './focus'
import type { TurnPhase } from './phase'

/**
 * Keeps the focus the player left: when the preliminary part of a turn begins, the
 * resources of the empire, the new income with them, are spread by it once more.
 * Once a turn, so that what the player then adjusts by hand stays as they left it.
 */
export function useFocusKeeper(state: MatchState | undefined, phase: TurnPhase | null): void {
  const queryClient = useQueryClient()
  const kept = useRef<string | null>(null)
  const matchId = state?.match.id
  const turn = state?.match.currentTurn
  const playing = state?.match.status === 'ONGOING' && state.me?.status === 'ACTIVE'

  useEffect(() => {
    if (!matchId || turn === undefined || !playing || phase !== 'PRELIMINARY') return
    const focus = loadFocus(matchId)
    const key = `${matchId}:${String(turn)}`
    if (!focus || kept.current === key) return
    kept.current = key
    void (async () => {
      const shapes = await matchApi.shapes(matchId)
      const now = queryClient.getQueryData<MatchState>(['matches', 'state', matchId])
      if (!now || now.match.currentTurn !== turn) return
      // What can move: the player's own territories that are not in a battle.
      const free = now.territories.filter(
        (territory) =>
          territory.ownerEmpireId === now.me?.empireId &&
          territory.battleId === null &&
          territory.resources !== null,
      )
      const placed = shapes.territories.filter((shape) =>
        free.some((territory) => territory.id === shape.id),
      )
      if (free.length < 2 || placed.length !== free.length) return
      const held: Amounts = Object.fromEntries(
        free.map((territory) => [territory.id, territory.resources ?? 0]),
      )
      const total = Object.values(held).reduce((sum, amount) => sum + amount, 0)
      const wanted = distribute(total, focusWeights(placed, focus))
      if (sameAmounts(wanted, held)) return
      const next = await matchApi.allocate(matchId, { amounts: wanted, turn })
      queryClient.setQueryData(['matches', 'state', matchId], next)
    })().catch(() => {
      // Refused (the phase ended, a battle began): the resources stay as they are.
    })
  }, [matchId, turn, playing, phase, queryClient])
}
