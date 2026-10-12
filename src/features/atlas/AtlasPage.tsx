import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapLoader } from '@/features/map/MapLoader'
import { empirePalette } from '@/features/map/theme'
import { cn } from '@/lib/utils'

import { atlasApi, type AtlasArea } from './api'
import { areaColors } from './colors'

/** The countries of the world: the 193 members of the United Nations and its 2 observers. */
const WORLD_COUNTRIES = 195

/** A name as it is searched: without capitals or accents, so that "islanda" finds "Ísland". */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const MAP_FRAME = 'h-[60dvh] min-h-[22rem] rounded-md border lg:h-[75dvh]'

// MapLibre is most of the weight of the site: fetched only when the map is shown.
const AtlasMap = lazy(() => import('./AtlasMap').then((module) => ({ default: module.AtlasMap })))

/**
 * `/atlas`: the whole map, with every area a match can be played on. Each area is one
 * shape with a colour of its own, never the one of an area it touches: only the
 * outlines of the areas are loaded, not their municipalities. The list beside the map
 * names them under the geographic area they belong to; an area is chosen from the
 * list or on the map, and the map goes onto it. Open to guests too.
 */
export function AtlasPage() {
  const { t } = useTranslation()
  const atlas = useQuery({ queryKey: ['geo', 'atlas'], queryFn: atlasApi.atlas })
  const [chosenId, setChosenId] = useState<string | null>(null)

  const areas = atlas.data?.areas
  const colorOf = useMemo(() => areaColors(areas ?? [], empirePalette()), [areas])
  // The areas under the geographic area they are part of, in the order they came.
  const searchId = useId()
  const [search, setSearch] = useState('')
  const groups = useMemo(() => {
    const byRoot = new Map<string, { id: string; name: string; areas: AtlasArea[] }>()
    for (const area of areas ?? []) {
      const group = byRoot.get(area.rootId) ?? { id: area.rootId, name: area.rootName, areas: [] }
      group.areas.push(area)
      byRoot.set(area.rootId, group)
    }
    return [...byRoot.values()]
  }, [areas])
  // What the search leaves: a country by its name, with all its areas, or the areas by theirs.
  const found = useMemo(() => {
    const wanted = plain(search)
    if (wanted === '') return groups
    return groups.flatMap((group) => {
      if (plain(group.name).includes(wanted)) return [group]
      const matching = group.areas.filter((area) => plain(area.name).includes(wanted))
      return matching.length > 0 ? [{ ...group, areas: matching }] : []
    })
  }, [groups, search])

  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-8"
      aria-labelledby="atlas-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="atlas-title" className="text-3xl sm:text-4xl">
          {t('atlas.title')}
        </h1>
        <p className="text-muted-foreground max-w-prose">
          {t('atlas.intro')}{' '}
          <Link to="/credits" className="underline">
            {t('nav.credits')}
          </Link>
        </p>
      </div>

      {atlas.error && (
        <p role="alert" className="text-danger">
          {t('atlas.error')}
        </p>
      )}
      {atlas.isPending && <MapLoader className={MAP_FRAME} />}
      {areas?.length === 0 && <p className="text-muted-foreground">{t('atlas.empty')}</p>}

      {atlas.data && areas && areas.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Suspense fallback={<MapLoader className={MAP_FRAME} />}>
            <AtlasMap
              areas={areas}
              colors={colorOf}
              bounds={atlas.data.bounds}
              chosenId={chosenId}
              onChoose={setChosenId}
              className={MAP_FRAME}
            />
          </Suspense>

          <div className="flex flex-col gap-4 lg:max-h-[75dvh] lg:overflow-y-auto lg:pr-1">
            <div role="status" className="flex flex-col gap-1">
              <p>
                {t('atlas.summary', {
                  areas: areas.length,
                  count: atlas.data.unitCount,
                })}
              </p>
              {/* How much of the world can be played on. */}
              <p className="flex items-baseline gap-2">
                <span className="font-display text-3xl">
                  {groups.length} / {WORLD_COUNTRIES}
                </span>
                <span className="text-muted-foreground">{t('atlas.countries')}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={searchId}>{t('atlas.search')}</Label>
              <Input
                id={searchId}
                type="search"
                value={search}
                placeholder={t('atlas.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {found.length === 0 && <p className="text-muted-foreground">{t('atlas.noMatch')}</p>}
            {found.map((group) => (
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
                    const marked = area.id === chosenId
                    return (
                      <li key={area.id}>
                        <button
                          type="button"
                          aria-pressed={marked}
                          onClick={() => setChosenId(marked ? null : area.id)}
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
