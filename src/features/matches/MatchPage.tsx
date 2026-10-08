import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { NotFoundPage } from '@/app/NotFoundPage'
import { Button } from '@/components/ui/button'
import { Leaderboard } from '@/features/game/Leaderboard'
import { MatchBar } from '@/features/game/MatchBar'
import { ResourcesPage } from '@/features/game/ResourcesPage'
import { UnitPanel } from '@/features/game/UnitPanel'
import { useMatchLive } from '@/features/game/useMatchLive'
import type { EmpireLabel, MapUnit } from '@/features/map/GameMap'
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
type View = 'menu' | 'match' | 'leaderboard' | 'resources' | 'unit'

function MatchInfo({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  const { match } = state
  const now = useNow()
  const overdue = match.status === 'OPEN' && new Date(match.startAt).getTime() < now

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
  const [card, setCard] = useState<UnitCardData | null>(null)
  const [focus, setFocus] = useState<{ lon: number; lat: number } | null>(null)
  const [phoneTab, setPhoneTab] = useState<'map' | 'panel'>('map')

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

  // Who owns each municipality, for the map and for the box of the selected one.
  const ownership = useMemo(() => {
    const empires = new Map(state?.empires.map((empire) => [empire.id, empire]))
    const byUnit = new Map<number, MatchState['territories'][number]>()
    const colors = new Map<number, string>()
    for (const territory of state?.territories ?? []) {
      const empire = empires.get(territory.ownerEmpireId)
      for (const unitId of territory.geoUnitIds) {
        byUnit.set(unitId, territory)
        if (empire) colors.set(unitId, empire.color)
      }
    }
    return { empires, byUnit, colors }
  }, [state])

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

  const mineId = state?.me?.empireId
  // What is lit on the map: the empire pointed at in the ranking, or the free
  // neighbours of the player's own municipality that is selected.
  const highlighted = useMemo(() => {
    if (hoveredEmpire) {
      return (state?.territories ?? [])
        .filter((territory) => territory.ownerEmpireId === hoveredEmpire)
        .flatMap((territory) => territory.geoUnitIds)
    }
    if (card && selected?.id === card.geoUnitId && card.territory.ownerEmpireId === mineId) {
      return card.neighbours.filter((n) => n.ownerEmpireId === null).map((n) => n.geoUnitId)
    }
    return []
  }, [card, hoveredEmpire, mineId, selected?.id, state?.territories])

  const selectFromList = useCallback(
    (unit: MapUnit) => {
      setSelected(unit)
      const point = units.data?.find((candidate) => candidate.id === unit.id)
      if (point) setFocus({ lon: point.lon, lat: point.lat })
    },
    [units.data],
  )

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
  }
  const onMapSelect = (unit: MapUnit | null) => {
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
      {mine && (
        <>
          <p className="font-display mt-3 px-3 text-base">{t('game.menu.empire')}</p>
          <MenuButton indented onClick={() => open('resources')}>
            {t('game.menu.resources')}
          </MenuButton>
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
      <MatchBar state={state} connected={connected} />

      {hasMap && area.data ? (
        <LazyGameMap
          area={area.data}
          colors={ownership.colors}
          empireLabels={labels}
          selected={selected}
          highlightedIds={highlighted}
          focus={focus}
          onSelect={onMapSelect}
          renderInfo={(unit) => {
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
                        className="size-6"
                      />
                      {t('match.unit.owned', { name: empire.name })}
                    </p>
                    <p className="text-muted-foreground">
                      {territory.resources === null
                        ? t('match.unit.hidden')
                        : t('match.unit.resources', { count: territory.resources })}
                    </p>
                    {empire.capitalTerritoryId === territory.id && <p>{t('match.unit.capital')}</p>}
                    {territory.protected && <p>{t('match.unit.protected')}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('match.unit.free')}</p>
                )}
              </UnitCard>
            )
          }}
          className={cn(
            'h-[calc(100dvh-7rem)] flex-none md:h-auto md:flex-1',
            phoneTab !== 'map' && 'hidden md:block',
          )}
        />
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
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="quiet" size="sm" onClick={() => open('menu')}>
                {t('game.menu.back')}
              </Button>
              {/* The pages of the empire share a bar with their links. */}
              {view === 'resources' && (
                <span className="rounded-pill border-foreground border px-3 py-0.5 text-base">
                  {t('game.menu.resources')}
                </span>
              )}
            </div>
            {view === 'match' && (
              <>
                <MatchInfo state={state} />
                {matchView}
              </>
            )}
            {view === 'leaderboard' && <Leaderboard state={state} onHover={setHoveredEmpire} />}
            {view === 'resources' && <ResourcesPage state={state} />}
            {view === 'unit' && selected && (
              <UnitPanel
                key={selected.id}
                state={state}
                unit={selected}
                onSelect={selectFromList}
                onCard={setCard}
              />
            )}
          </>
        )}
      </aside>

      {/* On a phone the map and the panel take the whole screen in turn. */}
      {hasMap && (
        <div
          role="tablist"
          aria-label={t('game.menu.tabs')}
          className="bg-background fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t md:hidden"
        >
          {(['map', 'panel'] as const).map((tab) => (
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
              {t(tab === 'map' ? 'game.menu.phoneMap' : 'game.menu.phonePanel')}
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
