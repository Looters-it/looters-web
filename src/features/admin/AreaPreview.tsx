import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { mapApi } from '@/features/map/api'
import { demoEmpires } from '@/features/map/demo-empires'
import type { MapUnit } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { empirePalette } from '@/features/map/theme'
import { UnitCard } from '@/features/map/UnitCard'

import { adminApi } from './api'

const DEMO_EMPIRES = 100

/**
 * Shows the municipalities of a folder on the map. Clicking one lights up
 * its neighbours, to check adjacency by eye. "Trial empires" paints a
 * made-up match with a hundred empires, to judge how the map performs.
 */
export function AreaPreview({ areaId }: { areaId: string }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<MapUnit | null>(null)
  const [demo, setDemo] = useState(false)

  const area = useQuery({
    queryKey: ['admin', 'geo', 'map', areaId],
    queryFn: () => mapApi.areaMap(areaId),
  })
  const neighbours = useQuery({
    queryKey: ['admin', 'geo', 'neighbours', selected?.id],
    queryFn: () => adminApi.neighbours(selected?.id ?? 0),
    enabled: selected !== null,
  })
  const units = useQuery({
    queryKey: ['admin', 'geo', 'units', areaId],
    queryFn: () => mapApi.units(areaId),
    enabled: demo,
  })

  const highlighted = useMemo(
    () => (selected ? (neighbours.data ?? []).map((unit) => unit.id) : []),
    [neighbours.data, selected],
  )
  const empires = useMemo(
    () => (demo && units.data ? demoEmpires(units.data, DEMO_EMPIRES, empirePalette()) : null),
    [demo, units.data],
  )

  if (!area.data?.bounds) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{t('admin.preview.hint')}</p>
        <Button
          variant={demo ? 'default' : 'quiet'}
          size="sm"
          aria-pressed={demo}
          onClick={() => setDemo((value) => !value)}
        >
          {t('admin.preview.demo')}
        </Button>
      </div>
      <LazyGameMap
        area={area.data}
        embedded
        colors={empires?.colors}
        empireLabels={empires?.labels}
        selected={selected}
        highlightedIds={highlighted}
        onSelect={setSelected}
        renderInfo={(unit) => (
          <UnitCard name={unit.name} isolation={unit.isolation}>
            <p className="text-muted-foreground">
              {neighbours.data
                ? t('admin.preview.neighbours', { count: neighbours.data.length })
                : t('admin.loading')}
            </p>
            {neighbours.data && neighbours.data.length > 0 && (
              <p>{neighbours.data.map((neighbour) => neighbour.name).join(', ')}</p>
            )}
          </UnitCard>
        )}
        className="h-[32rem] rounded-md border"
      />
    </div>
  )
}
