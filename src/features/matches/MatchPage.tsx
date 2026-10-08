import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { NotFoundPage } from '@/app/NotFoundPage'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AttackPanel } from '@/features/game/AttackPanel'
import { BattleAlert } from '@/features/game/BattleAlert'
import { BattlesPage } from '@/features/game/BattlesPage'
import { Board } from '@/features/game/Board'
import { AlliancePage } from '@/features/game/AlliancePage'
import { BuildPage } from '@/features/game/BuildPage'
import { historyQuery, turnQuery } from '@/features/game/history'
import { HistoryPage } from '@/features/game/HistoryPage'
import { colorsFor, type MapView } from '@/features/game/map-views'
import { empireTags } from '@/features/game/tags'
import { UnitSearch } from '@/features/game/UnitSearch'
import { Leaderboard } from '@/features/game/Leaderboard'
import { MatchBar } from '@/features/game/MatchBar'
import { MergePage } from '@/features/game/MergePage'
import { ResourcesPage } from '@/features/game/ResourcesPage'
import { UnitPanel } from '@/features/game/UnitPanel'
import { useMatchLive } from '@/features/game/useMatchLive'
import type { EmpireLabel, MapMarker, MapUnit, OwnerTag } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { UnitCard } from '@/features/map/UnitCard'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

import { matchApi, type MatchState, type UnitCardData } from './api'
import { EmpireShield } from './Emblem'
import { useMatchFormat, useNow } from './format'
import { JoinPanel } from './JoinPanel'
import { MyEmpire } from './MyEmpire'
import { OwnerPanel } from './OwnerPanel'

/** What the panel shows. Inside an entry the menu gives way to a single "Menu" button. */
type View =
  | 'menu'
  | 'match'
  | 'leaderboard'
  | 'resources'
  | 'merge'
  | 'build'
  | 'alliance'
  | 'battles'
  | 'history'
  | 'unit'
  | 'attack'

/** The pages of the empire, which share a bar with their links. */
const EMPIRE_PAGES = ['resources', 'merge', 'build', 'alliance'] as const

const NOTHING: never[] = []
const MAP_VIEWS: MapView[] = ['political', 'alliances', 'resources']
/** Map paint needs literal colours: the neutral tone and the scale of the resources view. */
const MAP_TONES = {
  neutral: '#d5dbe6',
  scale: ['#e3ebf7', '#c9d7ee', '#afc3e5', '#99b2dd', '#6f8fc0', '#466b9c', '#234f78', '#0b3954'],
}

function MatchInfo({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  const { match } = state
  const now = useNow()
  const overdue = match.status === 'OPEN' && new Date(match.startAt).getTime() < now
  const winners = state.empires.filter((empire) => match.winnerEmpireIds.includes(empire.id))
  const iWon = winners.some((empire) => empire.id === state.me?.empireId)

  return (
    <section className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl leading-tight">{match.name}</h1>
        <span className="rounded-pill border px-2 text-base">
          {t(`match.status.${match.status}`)}
        </span>
      </div>
      <p className="text-muted-foreground">
        {match.areas.map((area) => area.name).join(', ')} ·{' '}
        {t('match.info.owner', { owner: match.owner })}
      </p>
      <ul className="text-base">
        <li>
          {match.status === 'RUNNING'
            ? t('match.info.turn', { turn: match.currentTurn })
            : t('match.info.starts', {
                date: format.dateTime(match.startAt),
                when: format.fromNow(match.startAt, now),
              })}
        </li>
        <li>{t('match.info.players', { players: match.players, max: match.maxPlayers })}</li>
        <li>
          {t('match.info.turnLength', { hours: match.turnHours })} ·{' '}
          {match.maxDays ? t('match.info.maxDays', { days: match.maxDays }) : t('match.info.noEnd')}
        </li>
      </ul>
      {overdue && (
        <p role="status" className="text-danger">
          {t('match.info.lateStart', { min: Number(match.config.minPlayersToStart ?? 2) })}
        </p>
      )}
      {match.status === 'FINISHED' && (
        <p role="status" className="border-foreground rounded-md border p-3 text-lg">
          {t('game.end.finished')}{' '}
          {winners.length === 0
            ? t('game.end.noWinner')
            : winners.length > 1
              ? t(iWon ? 'game.end.youTied' : 'game.end.tie', {
                  names: winners.map((empire) => empire.name).join(', '),
                })
              : iWon
                ? t('game.end.youWon')
                : t('game.end.winner', { name: winners[0]?.name ?? '' })}
        </p>
      )}
      {match.status !== 'FINISHED' && state.me?.status === 'FALLEN' && (
        <p role="status" className="border-danger text-danger rounded-md border p-3">
          {t('game.end.spectator')}
        </p>
      )}
    </section>
  )
}

/** The page of a match: the map on one side, the panel with its menu on the other. */
export function MatchPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { state: stateQuery, connected } = useMatchLive(id)
  const state = stateQuery.data

  const [selected, setSelected] = useState<MapUnit | null>(null)
  const [chosenView, setView] = useState<View | null>(null)
  const [hoveredEmpire, setHoveredEmpire] = useState<string | null>(null)
  const [mapView, setMapView] = useState<MapView>('political')
  // The closed turn shown on the map instead of the present, while the history is reviewed.
  const [review, setReview] = useState<number | null>(null)
  const [card, setCard] = useState<UnitCardData | null>(null)
  const [focus, setFocus] = useState<{ lon: number; lat: number } | null>(null)
  const [phoneTab, setPhoneTab] = useState<'map' | 'panel' | 'board'>('map')
  // The attack being prepared: its target and the own territories chosen so far.
  const [attack, setAttack] = useState<{ card: UnitCardData; from: string[] } | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  // Territories being chosen for a merge, and the structure a territory is being chosen for.
  const [merging, setMerging] = useState<string[]>([])
  const [building, setBuilding] = useState<{ type: string; territoryId: string | null } | null>(
    null,
  )

  const hasMap = state !== undefined && state.match.status !== 'DRAFT'
  const area = useQuery({
    queryKey: ['matches', 'map', id],
    queryFn: () => matchApi.map(id),
    enabled: hasMap,
    staleTime: Infinity,
  })
  const units = useQuery({
    queryKey: ['matches', 'units', id],
    queryFn: () => matchApi.units(id),
    enabled: hasMap,
    staleTime: Infinity,
  })

  const hasAreas = state?.territories.some((territory) => territory.isArea) ?? false
  const areas = useQuery({
    // Read again when the areas change: a merge, a rename, a conquest.
    queryKey: [
      'matches',
      'areas',
      id,
      state?.territories
        .filter((territory) => territory.isArea)
        .map((territory) => `${territory.id}:${territory.name}:${territory.geoUnitIds.length}`)
        .join('|'),
    ],
    queryFn: () => matchApi.areas(id),
    enabled: hasMap && hasAreas,
    placeholderData: (previous) => previous,
  })

  const closedTurns = useQuery({ ...historyQuery(id), enabled: review !== null })
  const past = useQuery({ ...turnQuery(id, review ?? 0), enabled: review !== null }).data
  const reviewing = review !== null && past?.turn === review ? past : null
  const reviewTurns = closedTurns.data?.map((entry) => entry.turn) ?? []
  const pastColors = useMemo(() => {
    const colorOf = new Map(state?.empires.map((empire) => [empire.id, empire.color]))
    const colors = new Map<number, string>()
    for (const [unitId, empireId] of Object.entries(reviewing?.ownership ?? {})) {
      const color = colorOf.get(empireId)
      if (color) colors.set(Number(unitId), color)
    }
    return colors
  }, [reviewing, state?.empires])

  // Who owns each municipality, for the map and for the box of the selected one.
  const ownership = useMemo(() => {
    const empires = new Map(state?.empires.map((empire) => [empire.id, empire]))
    const byUnit = new Map<number, MatchState['territories'][number]>()
    for (const territory of state?.territories ?? []) {
      for (const unitId of territory.geoUnitIds) byUnit.set(unitId, territory)
    }
    const colors = state ? colorsFor(state, mapView, MAP_TONES) : new Map<number, string>()
    return { empires, byUnit, colors }
  }, [state, mapView])

  // The tag of the owner on each municipality: ownership readable without colours.
  const tags = useMemo(() => empireTags(state?.empires ?? []), [state?.empires])
  const [showTags, setShowTags] = useState(() => {
    try {
      return localStorage.getItem('map.tags') !== 'off'
    } catch {
      return true
    }
  })
  const ownerTags = useMemo<OwnerTag[]>(() => {
    if (!showTags) return []
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    const owners: Record<string, string> =
      reviewing?.ownership ??
      Object.fromEntries(
        (state?.territories ?? []).flatMap((territory) =>
          territory.geoUnitIds.map((unitId) => [String(unitId), territory.ownerEmpireId]),
        ),
      )
    return Object.entries(owners).flatMap(([unitId, empireId]) => {
      const point = points.get(Number(unitId))
      const tag = tags.get(empireId)
      return point && tag ? [{ id: point.id, lon: point.lon, lat: point.lat, tag }] : []
    })
  }, [reviewing, showTags, state?.territories, tags, units.data])

  // Each empire is named at its capital.
  const labels = useMemo<EmpireLabel[]>(() => {
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    return (state?.empires ?? []).flatMap((empire) => {
      const capital = state?.territories.find((t) => t.id === empire.capitalTerritoryId)
      const point = capital && points.get(capital.geoUnitIds[0] ?? -1)
      return point
        ? [{ id: empire.id, name: empire.name, lon: point.lon, lat: point.lat, size: empire.units }]
        : []
    })
  }, [state, units.data])

  // Capitals (always visible to everyone) and accumulation alerts, drawn on the map.
  const markers = useMemo<MapMarker[]>(() => {
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    const empireOf = new Map(state?.empires.map((empire) => [empire.capitalTerritoryId, empire]))
    return (state?.territories ?? []).flatMap((territory) => {
      const point = points.get(territory.geoUnitIds[0] ?? -1)
      if (!point) return []
      const at = { lon: point.lon, lat: point.lat }
      const capitalOf = empireOf.get(territory.id)
      return [
        ...(capitalOf
          ? [
              {
                id: `capital:${territory.id}`,
                kind: 'capital' as const,
                color: capitalOf.color,
                emblem: capitalOf.emblem,
                logo: capitalOf.logoUrl,
                ...at,
              },
            ]
          : []),
        ...(territory.alert
          ? [{ id: `alert:${territory.id}`, kind: 'alert' as const, ...at }]
          : []),
        // Structures are read by their effects, so new ones with the same effects are drawn too.
        ...(state?.structures ?? [])
          .filter((structure) => structure.territoryId === territory.id)
          .flatMap((structure): MapMarker[] => [
            ...(structure.effects.includes('NO_ATTACK_ON')
              ? [
                  {
                    id: `block:${structure.id}`,
                    kind: 'block' as const,
                    text: structure.turnsLeft === null ? '' : String(structure.turnsLeft),
                    ...at,
                  },
                ]
              : []),
            ...(structure.effects.includes('BACKUP_CAPITAL')
              ? [
                  {
                    id: `second:${structure.id}`,
                    kind: 'second-capital' as const,
                    color: state?.empires.find((e) => e.id === structure.empireId)?.color,
                    ...at,
                  },
                ]
              : []),
          ]),
      ]
    })
  }, [state, units.data])

  const mineId = state?.me?.empireId
  const pickingOwn = chosenView === 'merge' || chosenView === 'build'
  // What is lit on the map: the empire pointed at in the ranking, or the free
  // neighbours of the player's own municipality that is selected.
  const highlighted = useMemo(() => {
    if (hoveredEmpire) {
      return (state?.territories ?? [])
        .filter((territory) => territory.ownerEmpireId === hoveredEmpire)
        .flatMap((territory) => territory.geoUnitIds)
    }
    // Choosing territories for a merge or a structure: the player's own are lit.
    if (pickingOwn) {
      return (state?.territories ?? [])
        .filter((territory) => territory.ownerEmpireId === mineId)
        .flatMap((territory) => territory.geoUnitIds)
    }
    // While an attack is prepared: the own territories that can join it.
    if (attack) {
      const usable = new Set(
        attack.card.attack?.from.filter((source) => source.usable).map((s) => s.territoryId),
      )
      return (state?.territories ?? [])
        .filter((territory) => usable.has(territory.id))
        .flatMap((territory) => territory.geoUnitIds)
    }
    if (card && selected?.id === card.geoUnitId && card.territory.ownerEmpireId === mineId) {
      return card.neighbours.filter((n) => n.ownerEmpireId === null).map((n) => n.geoUnitId)
    }
    return []
  }, [attack, card, hoveredEmpire, mineId, pickingOwn, selected?.id, state?.territories])

  // Territories that are the target of an open battle are marked for everyone.
  const attacked = useMemo(() => {
    const targets = new Set(
      state?.battles.filter((b) => b.status === 'OPEN').map((b) => b.targetTerritoryId),
    )
    return (state?.territories ?? [])
      .filter((territory) => targets.has(territory.id))
      .flatMap((territory) => territory.geoUnitIds)
  }, [state?.battles, state?.territories])

  const selectFromList = useCallback(
    (unit: MapUnit) => {
      setSelected(unit)
      const point = units.data?.find((candidate) => candidate.id === unit.id)
      if (point) setFocus({ lon: point.lon, lat: point.lat })
    },
    [units.data],
  )

  // An announcement names a municipality: select it and bring it into view.
  const goTo = (geoUnitId: number, name: string) => {
    selectFromList({ id: geoUnitId, name })
    setPhoneTab('map')
  }

  if (stateQuery.error) {
    const missing = stateQuery.error instanceof ApiError && stateQuery.error.status === 404
    return missing ? (
      <NotFoundPage />
    ) : (
      <p className="text-danger p-6">{t('match.errors.UNKNOWN')}</p>
    )
  }
  if (!state) return <p className="text-muted-foreground p-6">{t('match.loading')}</p>

  const { match } = state
  const mine = state.empires.find((empire) => empire.id === mineId) ?? null
  const joining = !mine && match.status !== 'DRAFT'
  const selectedTerritory = selected ? ownership.byUnit.get(selected.id) : undefined
  // While registering, a free municipality picked on the map is the chosen start.
  const start = joining && selected && !selectedTerritory ? selected : null

  // Registering and managing a draft happen in "La partita"; a player lands on the menu.
  const view: View = chosenView ?? (mine ? 'menu' : 'match')
  const open = (next: View) => {
    setView(next)
    setHoveredEmpire(null)
    if (next !== 'attack') setAttack(null)
    if (next !== 'merge') setMerging([])
    if (next !== 'build') setBuilding(null)
  }
  const onMapSelect = (unit: MapUnit | null) => {
    // Looking at the past: the box says who owned the municipality then, nothing else opens.
    if (reviewing) {
      setSelected(unit)
      return
    }
    // On the pages that choose own territories, a tap on the map chooses one.
    if (view === 'merge' || view === 'build') {
      const territory = unit ? ownership.byUnit.get(unit.id) : undefined
      if (!territory || territory.ownerEmpireId !== mineId) return
      if (view === 'merge') {
        if (territory.battleId !== null) return
        setMerging((chosen) =>
          chosen.includes(territory.id)
            ? chosen.filter((other) => other !== territory.id)
            : [...chosen, territory.id],
        )
      } else if (building) {
        setBuilding({ ...building, territoryId: territory.id })
      }
      return
    }
    // While an attack is prepared, tapping an own territory that can join it adds or
    // removes it; any other tap is ignored, so the target is not lost by mistake.
    if (attack) {
      const territory = unit ? ownership.byUnit.get(unit.id) : undefined
      const source = attack.card.attack?.from.find((s) => s.territoryId === territory?.id)
      if (source?.usable) {
        setAttack({
          ...attack,
          from: attack.from.includes(source.territoryId)
            ? attack.from.filter((id) => id !== source.territoryId)
            : [...attack.from, source.territoryId],
        })
      }
      return
    }
    setSelected(unit)
    // A player who taps a municipality gets its card; someone registering keeps the form.
    if (unit && !joining) setView('unit')
    if (!unit && view === 'unit') setView('menu')
  }

  const menu = (
    <nav className="flex flex-col gap-1" aria-label={t('game.menu.title')}>
      <MenuButton onClick={() => open('match')}>{t('game.menu.match')}</MenuButton>
      {hasMap && (
        <MenuButton onClick={() => open('leaderboard')}>{t('game.menu.leaderboard')}</MenuButton>
      )}
      {match.status === 'RUNNING' && (
        <MenuButton onClick={() => open('battles')}>{t('game.menu.battles')}</MenuButton>
      )}
      {(match.status === 'RUNNING' || match.status === 'FINISHED') && (
        <MenuButton onClick={() => open('history')}>{t('game.menu.history')}</MenuButton>
      )}
      {mine && (
        <>
          <p className="font-display mt-3 px-3 text-base">{t('game.menu.empire')}</p>
          {EMPIRE_PAGES.map((page) => (
            <MenuButton key={page} indented onClick={() => open(page)}>
              {t(`game.menu.${page}`)}
            </MenuButton>
          ))}
        </>
      )}
    </nav>
  )

  const matchView = (
    <div className="flex flex-col gap-6">
      {mine && <MyEmpire state={state} empire={mine} />}
      {joining && (
        <>
          {selected && selectedTerritory && (
            <p role="status" className="text-danger">
              {t('match.join.placeTaken', { name: selected.name })}
            </p>
          )}
          <JoinPanel state={state} start={start} />
        </>
      )}
      {match.isOwner && <OwnerPanel key={match.status} match={match} />}
    </div>
  )

  return (
    <div className="flex flex-col md:h-[calc(100vh-3.5rem)] md:flex-row">
      <MatchBar
        state={state}
        connected={connected}
        alert={<BattleAlert state={state} open={alertOpen} onOpenChange={setAlertOpen} />}
      />

      {hasMap && area.data ? (
        <div
          className={cn(
            'relative h-[calc(100dvh-7rem)] flex-none md:h-auto md:flex-1',
            phoneTab !== 'map' && 'hidden md:block',
          )}
        >
          <LazyGameMap
            area={area.data}
            colors={reviewing ? pastColors : ownership.colors}
            empireLabels={reviewing ? NOTHING : labels}
            markers={reviewing ? NOTHING : markers}
            ownerTags={ownerTags}
            areas={hasAreas && !reviewing ? (areas.data ?? null) : null}
            selected={selected}
            highlightedIds={reviewing ? NOTHING : highlighted}
            attackedIds={reviewing ? NOTHING : attacked}
            focus={focus}
            onSelect={onMapSelect}
            renderInfo={(unit) => {
              if (reviewing) {
                const then = ownership.empires.get(reviewing.ownership[String(unit.id)] ?? '')
                return (
                  <UnitCard name={unit.name}>
                    {then ? (
                      <p className="flex items-center gap-2">
                        <EmpireShield
                          color={then.color}
                          emblem={then.emblem}
                          logo={then.logoUrl}
                          className="size-6"
                        />
                        {t('match.unit.owned', { name: then.name })}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">{t('match.unit.free')}</p>
                    )}
                  </UnitCard>
                )
              }
              const territory = ownership.byUnit.get(unit.id)
              const empire = territory && ownership.empires.get(territory.ownerEmpireId)
              return (
                <UnitCard name={unit.name}>
                  {empire && territory ? (
                    <>
                      <p className="flex items-center gap-2">
                        <EmpireShield
                          color={empire.color}
                          emblem={empire.emblem}
                          logo={empire.logoUrl}
                          className="size-6"
                        />
                        {t('match.unit.owned', { name: empire.name })}
                      </p>
                      <p className="text-muted-foreground">
                        {territory.resources === null
                          ? t('match.unit.hidden')
                          : t('match.unit.resources', { count: territory.resources })}
                      </p>
                      {empire.capitalTerritoryId === territory.id && (
                        <p>{t('match.unit.capital')}</p>
                      )}
                      {territory.protected && <p>{t('match.unit.protected')}</p>}
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t('match.unit.free')}</p>
                  )}
                </UnitCard>
              )
            }}
            className="h-full"
          />
          {reviewing ? (
            <div
              role="group"
              aria-label={t('game.history.bar')}
              className="bg-background absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md border p-1.5"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('game.history.previous')}
                disabled={!reviewTurns.includes(reviewing.turn - 1)}
                onClick={() => setReview(reviewing.turn - 1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p role="status" className="font-bold">
                {t('game.history.reviewing', { turn: reviewing.turn })}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('game.history.next')}
                disabled={!reviewTurns.includes(reviewing.turn + 1)}
                onClick={() => setReview(reviewing.turn + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
              <Button size="sm" onClick={() => setReview(null)}>
                {t('game.history.present')}
              </Button>
            </div>
          ) : (
            <div
              role="group"
              aria-label={t('game.map.view')}
              className="bg-background absolute top-3 left-3 z-10 flex overflow-hidden rounded-md border"
            >
              {MAP_VIEWS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mapView === option}
                  onClick={() => setMapView(option)}
                  className={cn(
                    'cursor-pointer px-3 py-1.5 text-base font-bold transition-colors',
                    mapView === option ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                  )}
                >
                  {t(`game.map.${option}`)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-pressed={showTags}
            onClick={() => {
              const next = !showTags
              setShowTags(next)
              try {
                localStorage.setItem('map.tags', next ? 'on' : 'off')
              } catch {
                // Not remembered, that is all.
              }
            }}
            className={cn(
              'absolute top-14 left-3 z-10 cursor-pointer rounded-md border px-3 py-1.5 text-base font-bold transition-colors',
              showTags ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
            )}
          >
            {t('game.map.tags')}
          </button>
          {/* The board sits over the map, bottom left; on a phone it has its own tab. */}
          <Board
            state={state}
            onGoTo={goTo}
            className="absolute bottom-3 left-3 z-10 hidden md:flex"
          />
        </div>
      ) : (
        <div className="bg-muted hidden flex-1 border-r md:block" />
      )}

      <aside
        className={cn(
          'flex w-full flex-col gap-5 overflow-y-auto p-4 pb-20 md:w-[26rem] md:flex-none md:border-l md:pb-4',
          hasMap && phoneTab !== 'panel' && 'hidden md:flex',
        )}
      >
        {view === 'menu' ? (
          <>
            <MatchInfo state={state} />
            {menu}
            {hasMap && units.data && (
              <UnitSearch
                units={units.data}
                onSelect={(unit) => {
                  selectFromList(unit)
                  onMapSelect(unit)
                }}
              />
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {/* The way back: on a phone as tall as a fingertip needs. */}
              <Button
                variant="quiet"
                size="sm"
                className="max-md:h-10 max-md:px-4"
                onClick={() => open('menu')}
              >
                {t('game.menu.back')}
              </Button>
              {/* The pages of the empire share a bar with their links. */}
              {mine &&
                (EMPIRE_PAGES as readonly View[]).includes(view) &&
                EMPIRE_PAGES.map((page) => (
                  <button
                    key={page}
                    type="button"
                    aria-current={view === page ? 'page' : undefined}
                    onClick={() => open(page)}
                    className={cn(
                      'rounded-pill hover:bg-accent cursor-pointer border px-3 py-0.5 text-base',
                      view === page ? 'border-foreground font-bold' : 'border-border',
                    )}
                  >
                    {t(`game.menu.${page}`)}
                  </button>
                ))}
            </div>
            {view === 'match' && (
              <>
                <MatchInfo state={state} />
                {matchView}
              </>
            )}
            {view === 'leaderboard' && <Leaderboard state={state} onHover={setHoveredEmpire} />}
            {view === 'resources' && <ResourcesPage state={state} />}
            {view === 'merge' && <MergePage state={state} chosen={merging} onChoose={setMerging} />}
            {view === 'build' && (
              <BuildPage state={state} picking={building} onPicking={setBuilding} />
            )}
            {view === 'alliance' && <AlliancePage state={state} />}
            {view === 'history' && (
              <HistoryPage
                state={state}
                review={review}
                onReview={(turn) => {
                  setReview(turn)
                  setSelected(null)
                  if (turn !== null) setPhoneTab('map')
                }}
                onGoTo={goTo}
              />
            )}
            {view === 'unit' && selected && (
              <UnitPanel
                key={selected.id}
                state={state}
                unit={selected}
                onSelect={selectFromList}
                onCard={setCard}
                onPrepareAttack={(target) => {
                  // The strongest usable territory is proposed; the player adds or removes.
                  const first = target.attack?.from.find((source) => source.usable)
                  setAttack({ card: target, from: first ? [first.territoryId] : [] })
                  setView('attack')
                }}
              />
            )}
            {view === 'attack' && attack && (
              <AttackPanel
                state={state}
                card={attack.card}
                chosen={attack.from}
                onChoose={(from) => setAttack({ ...attack, from })}
                onDone={() => open('unit')}
              />
            )}
            {view === 'battles' && (
              <BattlesPage state={state} onRespond={() => setAlertOpen(true)} />
            )}
          </>
        )}
      </aside>

      {hasMap && phoneTab === 'board' && (
        <div className="h-[calc(100dvh-7rem)] md:hidden">
          <Board state={state} onGoTo={goTo} full />
        </div>
      )}

      {/* On a phone the map, the panel and the board take the whole screen in turn. */}
      {hasMap && (
        <div
          role="tablist"
          aria-label={t('game.menu.tabs')}
          className="bg-background fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t md:hidden"
        >
          {(['map', 'panel', 'board'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={phoneTab === tab}
              onClick={() => setPhoneTab(tab)}
              className={cn(
                'h-14 cursor-pointer font-bold tracking-[0.09em] uppercase',
                phoneTab === tab && 'bg-primary text-primary-foreground',
              )}
            >
              {t(
                tab === 'map'
                  ? 'game.menu.phoneMap'
                  : tab === 'panel'
                    ? 'game.menu.phonePanel'
                    : 'game.menu.phoneBoard',
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuButton(props: { onClick: () => void; indented?: boolean; children: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        'hover:bg-accent cursor-pointer rounded-md border px-3 py-2.5 text-left font-bold transition-colors',
        props.indented && 'ml-4',
      )}
    >
      {props.children}
    </button>
  )
}
