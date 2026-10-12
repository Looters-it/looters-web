import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { EmpireLabel, MapUnit } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { empirePalette } from '@/features/map/theme'
import { UnitCard } from '@/features/map/UnitCard'
import { cn } from '@/lib/utils'

import { atlasApi, type AtlasArea } from './api'
import { areaColors } from './colors'

/**
 * `/atlas`: the whole map, with every area a match can be played on. Each area has
 * a colour of its own, never the one of an area it touches; the list beside the map
 * names them under the geographic area they belong to, and brings the map onto the
 * one that is chosen. Open to guests too: it is what the game is played on.
 */
export function AtlasPage() {
  const { t } = useTranslation()
  const atlas = useQuery({ queryKey: ['geo', 'atlas'], queryFn: atlasApi.atlas })
  const units = useQuery({
    queryKey: ['geo', 'atlas', 'units'],
    queryFn: atlasApi.units,
    staleTime: Infinity,
  })
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<MapUnit | null>(null)

  const areas = atlas.data?.areas
  const colorOf = useMemo(() => areaColors(areas ?? [], empirePalette()), [areas])
  // The colour of every municipality, and the area each belongs to.
  const { colors, areaOf } = useMemo(() => {
    const colors = new Map<number, string>()
    const areaOf = new Map<number, string>()
    for (const [areaId, ids] of Object.entries(units.data ?? {})) {
      const color = colorOf.get(areaId)
      for (const id of ids) {
        areaOf.set(id, areaId)
        if (color) colors.set(id, color)
      }
    }
    return { colors, areaOf }
  }, [units.data, colorOf])
  const labels = useMemo<EmpireLabel[]>(
    () =>
      (areas ?? []).map((area) => ({
        id: area.id,
        name: area.name,
        lon: area.lon,
        lat: area.lat,
        size: area.unitCount,
      })),
    [areas],
  )
  // The areas under the geographic area they are part of, in the order they came.
  const groups = useMemo(() => {
    const byRoot = new Map<string, { id: string; name: string; areas: AtlasArea[] }>()
    for (const area of areas ?? []) {
      const group = byRoot.get(area.rootId) ?? { id: area.rootId, name: area.rootName, areas: [] }
      group.areas.push(area)
      byRoot.set(area.rootId, group)
    }
    return [...byRoot.values()]
  }, [areas])
  const chosen = areas?.find((area) => area.id === chosenId) ?? null

  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-8"
      aria-labelledby="atlas-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="atlas-title" className="text-3xl sm:text-4xl">
          {t('atlas.title')}
        </h1>
        <p className="text-muted-foreground max-w-prose">{t('atlas.intro')}</p>
      </div>

      {atlas.error && (
        <p role="alert" className="text-danger">
          {t('atlas.error')}
        </p>
      )}
      {areas?.length === 0 && <p className="text-muted-foreground">{t('atlas.empty')}</p>}

      {atlas.data && areas && areas.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <LazyGameMap
            area={atlas.data.map}
            embedded
            colors={colors}
            empireLabels={labels}
            frame={chosen?.bounds ?? null}
            selected={selected}
            onSelect={(unit) => {
              setSelected(unit)
              // The area of the municipality is marked in the list, without moving the map.
              if (unit) setChosenId(null)
            }}
            renderInfo={(unit) => {
              const area = areas.find((candidate) => candidate.id === areaOf.get(unit.id))
              return (
                <UnitCard name={unit.name}>
                  {area && (
                    <p className="text-muted-foreground">
                      {area.rootId === area.id ? area.name : `${area.rootName} › ${area.name}`}
                    </p>
                  )}
                </UnitCard>
              )
            }}
            className="h-[60dvh] min-h-[22rem] rounded-md border lg:h-[75dvh]"
          />

          <div className="flex flex-col gap-4 lg:max-h-[75dvh] lg:overflow-y-auto lg:pr-1">
            <p role="status">
              {t('atlas.summary', {
                areas: areas.length,
                count: atlas.data.map.unitCount,
              })}
            </p>
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <h2 className="flex items-baseline justify-between gap-3 text-xl">
                  {group.name}
                  <span className="text-muted-foreground font-sans text-base">
                    {t('atlas.units', {
                      count: group.areas.reduce((sum, area) => sum + area.unitCount, 0),
                    })}
                  </span>
                </h2>
                <ul className="flex flex-col">
                  {group.areas.map((area) => {
                    const marked =
                      area.id === chosenId ||
                      (selected !== null && areaOf.get(selected.id) === area.id)
                    return (
                      <li key={area.id}>
                        <button
                          type="button"
                          aria-pressed={area.id === chosenId}
                          onClick={() => {
                            setSelected(null)
                            setChosenId(area.id === chosenId ? null : area.id)
                          }}
                          className={cn(
                            'focus-visible:outline-ring flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left focus-visible:outline-2',
                            marked ? 'bg-muted' : 'hover:bg-muted/60',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="size-4 shrink-0 rounded-sm border"
                            style={{ backgroundColor: colorOf.get(area.id) }}
                          />
                          <span className="min-w-0 flex-1 truncate">{area.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {t('atlas.units', { count: area.unitCount })}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
