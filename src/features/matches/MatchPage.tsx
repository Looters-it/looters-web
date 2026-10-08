import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { NotFoundPage } from '@/app/NotFoundPage'
import { Button } from '@/components/ui/button'
import type { EmpireLabel, MapUnit } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { UnitCard } from '@/features/map/UnitCard'
import { ApiError } from '@/lib/api'

import { matchApi, type MatchState } from './api'
import { EmpireShield } from './Emblem'
import { useMatchFormat, useNow } from './format'
import { JoinPanel } from './JoinPanel'
import { MyEmpire } from './MyEmpire'
import { OwnerPanel } from './OwnerPanel'

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

function Players({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2" aria-labelledby="players-title">
      <h2 id="players-title" className="text-lg">
        {t('match.players.title')}
      </h2>
      {state.empires.length === 0 && (
        <p className="text-muted-foreground">{t('match.players.none')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {state.empires.map((empire) => (
          <li key={empire.id} className="flex items-center gap-3">
            <EmpireShield color={empire.color} emblem={empire.emblem} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{empire.name}</p>
              <p className="text-muted-foreground truncate text-base">{empire.username}</p>
            </div>
            <span className="font-mono text-sm">
              {t('match.players.units', { count: empire.units })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The page of a match: the map on one side, the panel on the other. */
export function MatchPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const [selected, setSelected] = useState<MapUnit | null>(null)

  const stateQuery = useQuery({
    queryKey: ['matches', 'state', id],
    queryFn: () => matchApi.state(id),
    // Until live updates arrive (milestone 6) the page asks again every few seconds.
    refetchInterval: 5000,
    retry: false,
  })
  const state = stateQuery.data
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
    const byUnit = new Map<
      number,
      { territory: MatchState['territories'][number]; empireId: string }
    >()
    const colors = new Map<number, string>()
    for (const territory of state?.territories ?? []) {
      const empire = empires.get(territory.ownerEmpireId)
      for (const unitId of territory.geoUnitIds) {
        byUnit.set(unitId, { territory, empireId: territory.ownerEmpireId })
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
  const mine = state.empires.find((empire) => empire.id === state.me?.empireId) ?? null
  const joining = !mine && match.status !== 'DRAFT'
  const selectedOwner = selected ? ownership.byUnit.get(selected.id) : undefined
  // While registering, a free municipality picked on the map is the chosen start.
  const start = joining && selected && !selectedOwner ? selected : null

  return (
    <div className="flex flex-col md:h-[calc(100vh-3.5rem)] md:flex-row">
      {hasMap && area.data ? (
        <LazyGameMap
          area={area.data}
          colors={ownership.colors}
          empireLabels={labels}
          selected={selected}
          onSelect={setSelected}
          renderInfo={(unit) => {
            const owner = ownership.byUnit.get(unit.id)
            const empire = owner && ownership.empires.get(owner.empireId)
            return (
              <UnitCard name={unit.name}>
                {empire && owner ? (
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
                      {owner.territory.resources === null
                        ? t('match.unit.hidden')
                        : t('match.unit.resources', { count: owner.territory.resources })}
                    </p>
                    {empire.capitalTerritoryId === owner.territory.id && (
                      <p>{t('match.unit.capital')}</p>
                    )}
                    {owner.territory.protected && <p>{t('match.unit.protected')}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('match.unit.free')}</p>
                )}
              </UnitCard>
            )
          }}
          className="h-[55vh] flex-none md:h-auto md:flex-1"
        />
      ) : (
        <div className="bg-muted hidden flex-1 border-r md:block" />
      )}

      <aside className="flex w-full flex-col gap-6 overflow-y-auto border-t p-4 md:w-[26rem] md:flex-none md:border-t-0 md:border-l">
        <MatchInfo state={state} />
        {mine && <MyEmpire state={state} empire={mine} />}
        {joining && (
          <>
            {selected && selectedOwner && (
              <p role="status" className="text-danger">
                {t('match.join.placeTaken', { name: selected.name })}
              </p>
            )}
            <JoinPanel state={state} start={start} />
          </>
        )}
        {match.status !== 'DRAFT' && <Players state={state} />}
        {match.isOwner && <OwnerPanel key={match.status} match={match} />}
        {match.status === 'DRAFT' && !match.isOwner && (
          <Button variant="quiet" disabled>
            {t('match.status.DRAFT')}
          </Button>
        )}
      </aside>
    </div>
  )
}
