import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { matchApi, type MatchState } from '@/features/matches/api'
import type { MapBag } from '@/features/map/GameMap'

import {
  joinPoint,
  loadFocus,
  movePoint,
  pointsOf,
  splitPoint,
  saveFocus,
  tidied,
  watchFocus,
  type Focus,
  type Point,
} from './focus'
import type { TurnPhase } from './phase'
import { spreadByFocus } from './useFocusKeeper'

/** The focus the player left in a match, followed wherever it is moved from. */
export function useStoredFocus(matchId: string): Focus | null {
  return useSyncExternalStore(watchFocus, () => loadFocus(matchId))
}

/**
 * The focus of the resources as bags of money on the map of the game: a bag gives all
 * it carries to the territory it is left on, and to no other. A bag is split
 * in two, each carrying half of what it did while the others keep theirs, and two are
 * put back together by dropping one on the other. The bags are there only in the preliminary
 * part of a turn, when the resources move at once: during the action nothing can be moved,
 * so there is nothing to take. The focus is kept, and the next turn begins by it.
 */
export function useFocusBags(state: MatchState | undefined, phase: TurnPhase | null) {
  const queryClient = useQueryClient()
  const matchId = state?.match.id ?? ''
  const turn = state?.match.currentTurn
  const focus = useStoredFocus(matchId)
  const playing = state?.match.status === 'ONGOING' && state.me?.status === 'ACTIVE'
  const empireId = state?.me?.empireId
  const territories = state?.territories

  // Before any focus is set the bag waits on the capital: there to be taken.
  const capitalId = state?.empires.find((empire) => empire.id === empireId)?.capitalTerritoryId
  const owned = (territories ?? [])
    .filter((territory) => territory.ownerEmpireId === empireId)
    .map((territory) => `${territory.id}:${String(territory.geoUnitIds.length)}`)
    .join()
  const many = playing && owned.includes(',')
  // Where the player's territories lie: asked again when the empire changes.
  const shapes = useQuery({
    queryKey: ['matches', 'shapes', matchId, owned],
    queryFn: () => matchApi.shapes(matchId),
    placeholderData: keepPreviousData,
    enabled: many,
  })
  const start = useMemo<Point | null>(() => {
    const places = shapes.data?.territories ?? []
    const capital = places.find((place) => place.id === capitalId) ?? places[0]
    return many && capital ? { lon: capital.lon, lat: capital.lat } : null
  }, [shapes.data, capitalId, many])
  const movable = useMemo(
    () =>
      (territories ?? [])
        .filter((territory) => territory.ownerEmpireId === empireId && territory.battleId === null)
        .reduce((sum, territory) => sum + (territory.resources ?? 0), 0),
    [territories, empireId],
  )

  const bags = useMemo<MapBag[]>(() => {
    // No moving during the action: no bags, the focus waits for the next turn.
    if (!start || phase !== 'PRELIMINARY') return []
    // The one still waiting can be split too: it is placed on the capital by that.
    if (!focus) return [{ id: 'at', ...start, text: '', idle: true, later: false, split: true }]
    const points = pointsOf(focus)
    // A bag carries its share of what can move: splitting one leaves the others as they are.
    const whole = points.reduce((sum, point) => sum + point.share, 0)
    return points.map((point) => ({
      ...point,
      // The second end of a line carries the same part as the first: said once.
      text: point.id === 'to' ? '' : String(Math.round((movable * point.share) / whole)),
      idle: false,
      later: false,
      split: true,
    }))
  }, [focus, start, movable, phase])

  const keep = useCallback(
    (next: Focus | null) => {
      if (phase !== 'PRELIMINARY') return
      saveFocus(matchId, next)
      if (!next || turn === undefined) return
      void spreadByFocus(queryClient, matchId, turn, next).catch(() => {
        // Refused (the phase ended, a battle began): the resources stay as they are.
      })
    },
    [matchId, turn, phase, queryClient],
  )

  /**
   * A bag let go: put on the territory it was left on (the player's own under it, or
   * the nearest of them), or put together with the bag it was dropped on.
   */
  const places = shapes.data?.territories
  const drop = useCallback(
    (id: string, here: Point, onto: string | null, unitId: number | null) => {
      const mine = (territories ?? []).filter((territory) => territory.ownerEmpireId === empireId)
      const under = mine.find(
        (territory) => unitId !== null && territory.geoUnitIds.includes(unitId),
      )
      const own = (places ?? []).filter((place) =>
        mine.some((territory) => territory.id === place.id),
      )
      const far = (place: Point) => Math.hypot(place.lon - here.lon, place.lat - here.lat)
      const on =
        own.find((place) => place.id === under?.id) ??
        own.reduce<(typeof own)[number] | null>(
          (best, place) => (best && far(best) <= far(place) ? best : place),
          null,
        )
      const there = on ? { lon: on.lon, lat: on.lat } : here
      // A bag is all for one territory, whatever the focus was set to elsewhere.
      const { to: _, ...now } = loadFocus(matchId) ?? { mode: 'point' as const, ...there }
      const whole: Focus = { ...now, mode: 'point' }
      // Left on a territory that has a bag already, it joins it: one bag for a territory.
      keep(
        onto === null
          ? tidied(movePoint(whole, id === 'to' ? 'at' : id, there))
          : joinPoint(whole, id, onto),
      )
    },
    [matchId, keep, territories, empireId, places],
  )
  /** A bag split in two: the new one beside it. */
  const split = useCallback(
    (id: string, here: Point) => {
      const now = loadFocus(matchId) ?? (start ? { mode: 'point' as const, ...start } : null)
      if (now) keep(splitPoint(now, id === 'to' ? 'at' : id, here))
    },
    [matchId, start, keep],
  )

  return { bags, drop, split }
}
