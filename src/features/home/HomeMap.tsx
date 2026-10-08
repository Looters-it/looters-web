import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { mapApi } from '@/features/map/api'
import type { MapUnit } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { UnitCard } from '@/features/map/UnitCard'

/**
 * The map on the homepage. Until matches exist it shows the municipalities
 * of the largest geographic area, all free.
 */
export function HomeMap() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<MapUnit | null>(null)

  const areas = useQuery({ queryKey: ['geo', 'areas'], queryFn: mapApi.areas })
  const areaId = areas.data?.[0]?.id
  const area = useQuery({
    queryKey: ['geo', 'map', areaId],
    queryFn: () => mapApi.areaMap(areaId ?? ''),
    enabled: areaId !== undefined,
  })

  const frame = 'h-[60vh] min-h-80 rounded-lg border md:h-[calc(100vh-9rem)]'
  if (areas.data?.length === 0 || areas.error || area.error) {
    return (
      <div className={`${frame} flex items-center justify-center p-6 text-center`}>
        <p className="text-muted-foreground">
          {areas.data?.length === 0 ? t('home.map.empty') : t('home.map.error')}
        </p>
      </div>
    )
  }
  if (!area.data) return <div className={frame} aria-busy="true" />

  return (
    <section aria-label={t('home.map.label', { name: area.data.name })}>
      <LazyGameMap
        area={area.data}
        embedded
        selected={selected}
        onSelect={setSelected}
        renderInfo={(unit) => (
          <UnitCard name={unit.name}>
            <p className="text-muted-foreground">{t('home.map.free')}</p>
          </UnitCard>
        )}
        className={frame}
      />
    </section>
  )
}
