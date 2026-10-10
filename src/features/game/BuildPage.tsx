import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { matchApi, type CatalogueEntry, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'
import { cn } from '@/lib/utils'

import { drawEmpire } from './empire-map'
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

const WIDTH = 480
const HEIGHT = 340
const MARGIN = 26

/** What is being dragged: a structure of the catalogue to build, or one that stands to move. */
type Dragged =
  | { kind: 'build'; type: string; x: number; y: number }
  | { kind: 'move'; type: string; structureId: string; x: number; y: number }

/** The first letters of the name of a structure: what stands for it on the small map. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

/**
 * The structures of an empire, placed by hand: each structure of the catalogue is a
 * piece that is dragged onto one of the player's territories on a small map of the
 * empire, and dropped there to build it. A structure that can change territory is
 * moved the same way, from where it stands. Whatever the api lists is shown: a
 * structure added to the catalogue appears here without a change.
 */
export function BuildPage(props: { state: MatchState }) {
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
  const shapes = useQuery({
    queryKey: [
      'matches',
      'shapes',
      matchId,
      own.map((territory) => `${territory.id}:${String(territory.geoUnitIds.length)}`).join(),
    ],
    queryFn: () => matchApi.shapes(matchId),
  })
  const drawn = useMemo(
    () => drawEmpire(shapes.data?.territories ?? [], WIDTH, HEIGHT, MARGIN),
    [shapes.data],
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

  /** The territory of the small map under a point of the screen, if any. */
  const territoryAt = (x: number, y: number) =>
    document
      .elementsFromPoint(x, y)
      .map((element) => element.getAttribute('data-territory'))
      .find((id) => id !== null) ?? null

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
    setDragged({ ...piece, x: event.clientX, y: event.clientY })
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
      <ul className="grid gap-3 sm:grid-cols-2">
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

      {/* The empire: where a piece is dropped, and where what is built stands. */}
      {drawn && (
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          role="group"
          aria-label={t('game.structures.map')}
          className="w-full touch-none select-none"
        >
          {own.map((territory) => {
            const reason = dragged ? blockedOn(dragged, territory.id) : null
            return (
              <path
                key={territory.id}
                data-territory={territory.id}
                d={drawn.byId.get(territory.id)?.path}
                fillRule="evenodd"
                className={cn(
                  'stroke-foreground/60 transition-colors',
                  !dragged
                    ? 'fill-secondary/20'
                    : reason
                      ? 'fill-foreground/5'
                      : over === territory.id
                        ? 'fill-[#1f9d55]'
                        : 'fill-[#1f9d55]/40',
                )}
                strokeWidth={1}
                strokeLinejoin="round"
              >
                <title>{territory.name}</title>
              </path>
            )
          })}
          {mine.map((structure, index) => {
            const centre = drawn.byId.get(structure.territoryId)?.centre
            if (!centre) return null
            // Two on the same territory stand side by side.
            const beside = mine
              .slice(0, index)
              .filter((other) => other.territoryId === structure.territoryId).length
            const movable = editable && structure.moveInTurns === 0
            return (
              <g
                key={structure.id}
                transform={`translate(${String(centre.x + beside * 20)} ${String(centre.y)})`}
                className={cn(movable ? 'cursor-grab' : 'pointer-events-none')}
                onPointerDown={(event) =>
                  movable &&
                  take(event, { kind: 'move', type: structure.type, structureId: structure.id })
                }
              >
                <circle r={11} className="fill-secondary stroke-background" strokeWidth={2} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none fill-white font-mono text-[9px] font-bold"
                >
                  {initials(text.name(structure.type))}
                </text>
                <title>
                  {t('game.structures.activeItem', {
                    type: text.name(structure.type),
                    name: nameOf(structure.territoryId),
                  })}
                </title>
              </g>
            )
          })}
        </svg>
      )}
      {/* The name of the territory under the piece: nothing else says which one it is. */}
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
            <li key={structure.id} className="flex flex-wrap justify-between gap-x-3">
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
