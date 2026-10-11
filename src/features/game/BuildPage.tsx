import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { matchApi, type CatalogueEntry, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'
import { cn } from '@/lib/utils'

import { usePhase } from './phase'

/** Names and descriptions of a structure; one the interface does not know yet shows its key. */
function useStructureText() {
  const { t, i18n } = useTranslation()
  return {
    name: (type: string) => {
      const key = `game.structures.types.${type}`
      return i18n.exists(key) ? t(key as 'game.structures.types.BLOCK') : type
    },
    description: (entry: CatalogueEntry) => {
      const key = `game.structures.descriptions.${entry.type}`
      const values = { turns: entry.durationTurns ?? 0, cooldown: entry.cooldownTurns }
      return i18n.exists(key)
        ? t(key as 'game.structures.descriptions.BLOCK', values)
        : entry.durationTurns === null
          ? t('game.structures.permanent')
          : t('game.structures.unknownDescription', values)
    },
  }
}

/** What is being dragged: a structure of the catalogue to build, or one that stands to move. */
type Dragged =
  | { kind: 'build'; type: string; x: number; y: number }
  | { kind: 'move'; type: string; structureId: string; x: number; y: number }

/** The first letters of the name of a structure: what stands for it while it is carried. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

/**
 * The structures of an empire, placed by hand: each structure of the catalogue is a
 * piece taken from this menu and carried onto the map of the game, dropped on one of
 * the player's territories to build it there. A structure that can change territory is
 * moved the same way, from the list of what stands. Whatever the api lists is shown: a
 * structure added to the catalogue appears here without a change.
 */
export function BuildPage(props: {
  state: MatchState
  /** The territory of the map under a point of the screen, if any. */
  territoryAt: (clientX: number, clientY: number) => string | null
  /** While something is carried: the territories it can be dropped on. Null when nothing is. */
  onSites: (territoryIds: string[] | null) => void
}) {
  const { t } = useTranslation()
  const text = useStructureText()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state } = props
  const matchId = state.match.id
  const phase = usePhase(state.match)
  const editable = phase === 'PRELIMINARY'
  const catalogue = useQuery({
    queryKey: ['matches', 'catalogue', matchId, state.match.currentTurn],
    queryFn: () => matchApi.catalogue(matchId),
  })
  const own = state.territories.filter(
    (territory) => territory.ownerEmpireId === state.me?.empireId,
  )
  const mine = state.structures.filter((structure) => structure.empireId === state.me?.empireId)
  const capital = state.empires.find(
    (empire) => empire.id === state.me?.empireId,
  )?.capitalTerritoryId
  const nameOf = (territoryId: string) =>
    state.territories.find((territory) => territory.id === territoryId)?.name ?? ''

  const [dragged, setDragged] = useState<Dragged | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)

  const done = (next: MatchState) => {
    queryClient.setQueryData(['matches', 'state', matchId], next)
    return queryClient.invalidateQueries({ queryKey: ['matches', 'catalogue', matchId] })
  }
  const build = useMutation({
    mutationFn: (body: { type: string; territoryId: string }) =>
      matchApi.build(matchId, { ...body, turn: state.match.currentTurn }),
    onSuccess: done,
  })
  const move = useMutation({
    mutationFn: (body: { structureId: string; territoryId: string }) =>
      matchApi.moveStructure(matchId, body.structureId, {
        territoryId: body.territoryId,
        turn: state.match.currentTurn,
      }),
    onSuccess: done,
  })

  /** Why what is dragged cannot go on a territory, or null when it can. */
  const blockedOn = (piece: Dragged, territoryId: string): string | null => {
    if (piece.kind === 'build') {
      const site = catalogue.data
        ?.find((entry) => entry.type === piece.type)
        ?.sites.find((candidate) => candidate.territoryId === territoryId)
      return site ? site.blocked : 'NOT_A_SITE'
    }
    const territory = own.find((candidate) => candidate.id === territoryId)
    if (!territory) return 'NOT_A_SITE'
    if (territory.id === capital) return 'ON_CAPITAL'
    if (territory.battleId !== null) return 'IN_BATTLE'
    return mine.some(
      (structure) => structure.territoryId === territoryId && structure.type === piece.type,
    )
      ? 'ALREADY_HERE'
      : null
  }
  const reasonText = (reason: string) =>
    reason === 'NOT_A_SITE'
      ? t('game.structures.notHere')
      : t(`game.structures.blocked.${reason}` as 'game.structures.blocked.IN_BATTLE')

  const { territoryAt, onSites } = props
  // Nothing is left lit on the map when the menu closes with a piece in the hand.
  useEffect(() => () => onSites(null), [onSites])

  // What is dragged follows the pointer wherever it goes, and is dropped where it lifts.
  useEffect(() => {
    if (!dragged) return
    const onMove = (event: globalThis.PointerEvent) => {
      setDragged((piece) => piece && { ...piece, x: event.clientX, y: event.clientY })
      setOver(territoryAt(event.clientX, event.clientY))
    }
    const onUp = (event: globalThis.PointerEvent) => {
      const territoryId = territoryAt(event.clientX, event.clientY)
      setDragged(null)
      setOver(null)
      onSites(null)
      if (!territoryId) return
      const reason = blockedOn(dragged, territoryId)
      if (reason) {
        setRefused(reasonText(reason))
        return
      }
      if (dragged.kind === 'build') build.mutate({ type: dragged.type, territoryId })
      else move.mutate({ structureId: dragged.structureId, territoryId })
    }
    const onCancel = () => {
      setDragged(null)
      setOver(null)
      onSites(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // Bound once for each drag: it reads what is dragged, which stays the same piece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragged?.kind, dragged?.type])

  const take = (
    event: PointerEvent,
    piece: { kind: 'build'; type: string } | { kind: 'move'; type: string; structureId: string },
  ) => {
    if (!editable) return
    event.preventDefault()
    build.reset()
    move.reset()
    setRefused(null)
    const carried = { ...piece, x: event.clientX, y: event.clientY }
    setDragged(carried)
    onSites(own.filter((territory) => blockedOn(carried, territory.id) === null).map((t) => t.id))
  }
  const error = build.error ?? move.error

  return (
    <section className="flex flex-col gap-4" aria-labelledby="build-title">
      <h2 id="build-title" className="sr-only">
        {t('game.structures.title')}
      </h2>
      <p className={editable ? 'text-muted-foreground text-base' : 'text-danger text-base'}>
        {t(editable ? 'game.structures.dragIntro' : 'game.phase.onlyPreliminary')}
      </p>

      {/* The pieces: one for each structure of the catalogue, taken and carried to the map. */}
      <ul className="flex flex-col gap-3">
        {catalogue.data?.map((entry) => {
          const anywhere = entry.sites.some((site) => site.blocked === null)
          return (
            <li
              key={entry.type}
              className={cn(
                'flex touch-none flex-col gap-1 rounded-md border p-3 select-none',
                editable && anywhere ? 'cursor-grab' : 'opacity-60',
                dragged?.kind === 'build' && dragged.type === entry.type && 'border-foreground',
              )}
              onPointerDown={(event) =>
                anywhere && take(event, { kind: 'build', type: entry.type })
              }
            >
              <h3 className="flex items-center gap-2 text-base">
                <span
                  aria-hidden="true"
                  className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
                >
                  {initials(text.name(entry.type))}
                </span>
                {text.name(entry.type)}
              </h3>
              <p className="text-muted-foreground text-base">{text.description(entry)}</p>
              <p className="font-bold">{t('game.structures.cost', { count: entry.cost })}</p>
            </li>
          )
        })}
      </ul>

      {/* The territory under the piece, and why it cannot go there when it cannot. */}
      <p role="status" className="min-h-6 text-base">
        {dragged && over
          ? (() => {
              const reason = blockedOn(dragged, over)
              return reason ? `${nameOf(over)}: ${reasonText(reason)}` : nameOf(over)
            })()
          : (refused ?? '')}
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {errorText(error)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-base">{t('game.structures.active')}</h3>
        {mine.length === 0 && <p className="text-muted-foreground">{t('game.structures.none')}</p>}
        <ul className="flex flex-col gap-1">
          {mine.map((structure) => (
            <li
              key={structure.id}
              className={cn(
                'flex flex-wrap justify-between gap-x-3',
                editable &&
                  structure.moveInTurns === 0 &&
                  'cursor-grab touch-none rounded-md border p-2 select-none',
              )}
              onPointerDown={(event) =>
                structure.moveInTurns === 0 &&
                take(event, { kind: 'move', type: structure.type, structureId: structure.id })
              }
            >
              <span>
                {t('game.structures.activeItem', {
                  type: text.name(structure.type),
                  name: nameOf(structure.territoryId),
                })}
              </span>
              <span className="text-muted-foreground">
                {structure.turnsLeft === null
                  ? t('game.structures.permanent')
                  : t('game.structures.turnsLeft', { count: structure.turnsLeft })}
                {structure.moveInTurns != null &&
                  ` · ${
                    structure.moveInTurns > 0
                      ? t('game.structures.moveWait', { count: structure.moveInTurns })
                      : t('game.structures.moveDrag')
                  }`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* The piece in the hand, over everything. */}
      {dragged && (
        <span
          aria-hidden="true"
          className="bg-secondary pointer-events-none fixed z-50 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-sm font-bold text-white shadow-lg"
          style={{ left: dragged.x, top: dragged.y }}
        >
          {initials(text.name(dragged.type))}
        </span>
      )}
    </section>
  )
}
