import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { mapApi } from '@/features/map/api'
import type { EmpireLabel, MapMarker, MapUnit } from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { UnitCard } from '@/features/map/UnitCard'
import { EmpireShield } from '@/features/matches/Emblem'

import { Demo, boundsOf, demoStage, type DemoEvent } from './demo'

/** Municipalities on the stage, time between two moves, and lines of chronicle kept. */
const STAGE_SIZE = 320
const STEP_MS = 1100
const LOG_SIZE = 4

interface LogLine {
  id: number
  event: DemoEvent
}

/**
 * The map on the homepage: a made-up match that plays itself on the real
 * municipalities, to show at a glance what the game is. It can be moved and
 * tapped like the map of a match; it stands still for who asked for less motion.
 */
export function HeroMap({
  className,
  fitPadding,
}: {
  className?: string
  /** Room to leave around the stage: the part of the hero that is covered by its text. */
  fitPadding?: { top: number; right: number; bottom: number; left: number }
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<MapUnit | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  // Bumped at every move: what the map shows is read again from the demonstration.
  const [move, setMove] = useState(0)
  const [flash, setFlash] = useState<number[]>([])
  const nextId = useRef(0)

  const areas = useQuery({ queryKey: ['geo', 'areas'], queryFn: mapApi.areas })
  const areaId = areas.data?.[0]?.id
  const area = useQuery({
    queryKey: ['geo', 'map', areaId],
    queryFn: () => mapApi.areaMap(areaId ?? ''),
    enabled: areaId !== undefined,
  })
  const units = useQuery({
    queryKey: ['geo', 'units', areaId],
    queryFn: () => mapApi.units(areaId ?? ''),
    enabled: areaId !== undefined,
    staleTime: Infinity,
  })

  // The stage and its empires are chosen once for the visit.
  const demo = useMemo(() => {
    if (!units.data || units.data.length === 0) return null
    const stage = demoStage(units.data, STAGE_SIZE, Math.random)
    return { game: new Demo(stage, Math.random), bounds: boundsOf(stage) }
  }, [units.data])
  // The map opens on the stage, not on the whole area.
  const staged = useMemo(
    () => (area.data && demo ? { ...area.data, bounds: demo.bounds ?? area.data.bounds } : null),
    [area.data, demo],
  )

  useEffect(() => {
    if (!demo) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      if (document.hidden) return
      const event = demo.game.step()
      if (!event) return
      setMove((value) => value + 1)
      setFlash([event.unitId])
      setLog((lines) => [{ id: nextId.current++, event }, ...lines].slice(0, LOG_SIZE))
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [demo])

  const view = useMemo(() => {
    const colors = new Map<number, string>()
    if (!demo) return { colors, labels: [] as EmpireLabel[], markers: [] as MapMarker[] }
    const { game } = demo
    for (const [unitId, empire] of game.owner) colors.set(unitId, game.empires[empire]!.color)
    const sizes = game.sizes()
    const capitals = game.empires.flatMap((empire, index) => {
      const unit = game.unit(empire.capitalId)
      return unit ? [{ empire, index, unit }] : []
    })
    return {
      colors,
      labels: capitals.map(({ empire, index, unit }) => ({
        id: String(index),
        name: empire.name,
        lon: unit.lon,
        lat: unit.lat,
        size: sizes[index] ?? 1,
      })),
      markers: capitals.map(({ empire, index, unit }) => ({
        id: `capital:${String(index)}`,
        kind: 'capital' as const,
        color: empire.color,
        emblem: empire.emblem,
        lon: unit.lon,
        lat: unit.lat,
      })),
    }
    // `move` is what changes: the demonstration itself is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, move])

  const frame = `relative overflow-hidden ${className ?? ''}`
  if (areas.data?.length === 0 || areas.error || area.error) {
    return (
      <div className={`${frame} flex items-center justify-center p-6 text-center`}>
        <p className="text-muted-foreground">
          {areas.data?.length === 0 ? t('home.map.empty') : t('home.map.error')}
        </p>
      </div>
    )
  }
  if (!staged || !demo) return <div className={frame} aria-busy="true" />

  const sentence = ({ event }: LogLine) => {
    const empire = demo.game.empires[event.empire]?.name ?? ''
    const name = demo.game.unit(event.unitId)?.name ?? ''
    if (event.type === 'annexed') return t('home.demo.annexed', { empire, name })
    const other = demo.game.empires[event.other]?.name ?? ''
    return t(`home.demo.${event.type}`, { empire, other, name })
  }

  return (
    <section className={frame} aria-label={t('home.demo.label')}>
      <LazyGameMap
        area={staged}
        embedded
        fitPadding={fitPadding}
        colors={view.colors}
        empireLabels={view.labels}
        markers={view.markers}
        highlightedIds={flash}
        selected={selected}
        onSelect={setSelected}
        renderInfo={(unit) => {
          const empire = demo.game.empires[demo.game.owner.get(unit.id) ?? -1]
          return (
            <UnitCard name={unit.name}>
              {empire ? (
                <p className="flex items-center gap-2">
                  <EmpireShield color={empire.color} emblem={empire.emblem} className="size-6" />
                  {t('match.unit.owned', { name: empire.name })}
                </p>
              ) : (
                <p className="text-muted-foreground">{t('home.map.free')}</p>
              )}
              <p className="text-muted-foreground text-base">{t('home.demo.note')}</p>
            </UnitCard>
          )
        }}
        className="h-full w-full"
      />
      {/* Said on the map itself: nobody should take this for a match being played. */}
      <p className="bg-background rounded-pill absolute top-16 left-3 z-10 border px-3 py-1 text-sm lg:top-3">
        {t('home.demo.badge')}
      </p>
      {/* The chronicle of the demonstration: decoration, not news to be announced. */}
      {log.length > 0 && (
        <ol
          aria-label={t('home.demo.log')}
          aria-live="off"
          className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[min(26rem,calc(100%-1.5rem))] flex-col-reverse gap-1.5"
        >
          {log.map((line, index) => (
            <li
              key={line.id}
              className="bg-background/95 animate-in fade-in slide-in-from-bottom-2 rounded-md border px-3 py-1.5 text-base shadow-sm duration-300"
              style={{ opacity: 1 - index * 0.22 }}
            >
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-2.5 rounded-full align-middle"
                style={{ backgroundColor: demo.game.empires[line.event.empire]?.color }}
              />
              {sentence(line)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
