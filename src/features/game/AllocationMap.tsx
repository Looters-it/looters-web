import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { TerritoryShape } from '@/features/matches/api'
import { cn } from '@/lib/utils'

import type { Amounts } from './allocation'

export interface AllocationPlace {
  id: string
  name: string
  /** In a battle: it can neither give nor receive, so its bubble does not move. */
  locked: boolean
}

const WIDTH = 480
const HEIGHT = 380
/** Room around the territories, for the bubbles of the ones at the edge. */
const MARGIN = 32
/** The bubble of a territory with nothing, and of one that holds the whole scale. */
const SMALLEST = 6.5
const LARGEST = 30

/**
 * The resources of an empire on the map of its own territories: on each one a bubble
 * as large as its share of the whole. Pulling the edge of a bubble outwards gives that
 * territory more, pushing it in gives it less, and the others give way in proportion,
 * so the total is always assigned. No name to read: the territory is where it is.
 */
export function AllocationMap(props: {
  places: AllocationPlace[]
  shapes: TerritoryShape[]
  amounts: Amounts
  total: number
  /** While a bubble is dragged, or moved with the keys. */
  onChange: (id: string, wanted: number) => void
  /** When the gesture ends: the moment to save. */
  onCommit: () => void
}) {
  const { t } = useTranslation()
  const { places, shapes, amounts, total } = props
  const svg = useRef<SVGSVGElement>(null)
  const [held, setHeld] = useState<string | null>(null)
  // How far from the edge of the bubble it was taken: the edge follows the finger from there.
  const grip = useRef(0)
  const share = (id: string) => (total > 0 ? (amounts[id] ?? 0) / total : 0)

  // The largest bubble is a share that leaves room to grow: twice an equal part, or a
  // little more than the largest. It stays still while a bubble is held, so the edge
  // follows the finger instead of running from it.
  const wantedScale = Math.min(
    1,
    Math.max(
      2 / Math.max(places.length, 1),
      Math.max(0, ...places.map((place) => share(place.id))) * 1.25,
    ),
  )
  const frozenScale = useRef(wantedScale)
  if (held === null) frozenScale.current = wantedScale
  const scale = frozenScale.current
  const radiusOf = (id: string) =>
    SMALLEST + (LARGEST - SMALLEST) * Math.sqrt(Math.min(1, share(id) / scale))

  // The territories, drawn to fill the chart: flat enough at this size to be laid out
  // by their coordinates, narrowed by the latitude.
  const drawn = useMemo(() => {
    const rings = shapes.flatMap((shape) =>
      shape.geometry.type === 'Polygon'
        ? shape.geometry.coordinates
        : shape.geometry.coordinates.flat(),
    )
    const points = rings.flat()
    if (points.length === 0) return null
    const lats = points.map((point) => point[1] ?? 0)
    const narrow = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180)
    const xs = points.map((point) => (point[0] ?? 0) * narrow)
    const [left, right] = [Math.min(...xs), Math.max(...xs)]
    const [bottom, top] = [Math.min(...lats), Math.max(...lats)]
    const zoom = Math.min(
      (WIDTH - MARGIN * 2) / Math.max(right - left, 1e-9),
      (HEIGHT - MARGIN * 2) / Math.max(top - bottom, 1e-9),
    )
    const place = (lon: number, lat: number) => ({
      x: WIDTH / 2 + (lon * narrow - (left + right) / 2) * zoom,
      y: HEIGHT / 2 - (lat - (bottom + top) / 2) * zoom,
    })
    const pathOf = (ring: number[][]) =>
      ring
        .map((point, index) => {
          const { x, y } = place(point[0] ?? 0, point[1] ?? 0)
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join('') + 'Z'
    return new Map(
      shapes.map((shape) => [
        shape.id,
        {
          path: (shape.geometry.type === 'Polygon'
            ? shape.geometry.coordinates
            : shape.geometry.coordinates.flat()
          )
            .map(pathOf)
            .join(''),
          centre: place(shape.lon, shape.lat),
        },
      ]),
    )
  }, [shapes])

  const drag = (event: PointerEvent<SVGCircleElement>, place: AllocationPlace, taking: boolean) => {
    const box = svg.current?.getBoundingClientRect()
    const centre = drawn?.get(place.id)?.centre
    if (!box || !centre) return
    const x = ((event.clientX - box.left) / box.width) * WIDTH - centre.x
    const y = ((event.clientY - box.top) / box.height) * HEIGHT - centre.y
    const distance = Math.hypot(x, y)
    if (taking) {
      grip.current = distance - radiusOf(place.id)
      return
    }
    const size = Math.max(
      0,
      Math.min(1, (distance - grip.current - SMALLEST) / (LARGEST - SMALLEST)),
    )
    props.onChange(place.id, Math.round(size * size * scale * total))
  }
  const onKey = (event: KeyboardEvent<SVGCircleElement>, place: AllocationPlace) => {
    const step = Math.max(1, Math.round(total / 100)) * (event.shiftKey ? 5 : 1)
    const move =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? step
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -step
          : 0
    if (move === 0) return
    event.preventDefault()
    props.onChange(place.id, (amounts[place.id] ?? 0) + move)
    props.onCommit()
  }

  if (!drawn) return null
  const percent = (id: string) => Math.round(share(id) * 100)
  // The small ones last, on top: a large bubble never hides the one of a neighbour.
  const bysize = places
    .filter((place) => drawn.has(place.id))
    .sort((a, b) => radiusOf(b.id) - radiusOf(a.id))
    // The one being moved above them all, so that what it holds stays in sight.
    .sort((a, b) => Number(a.id === held) - Number(b.id === held))
  const heldPlace = places.find((place) => place.id === held)
  const heldCentre = heldPlace ? drawn.get(heldPlace.id)?.centre : undefined

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      role="group"
      aria-label={t('game.resources.radar')}
      className="w-full touch-none select-none"
    >
      {places.map((place) => (
        <path
          key={place.id}
          d={drawn.get(place.id)?.path}
          fillRule="evenodd"
          className={cn(
            'stroke-foreground/60',
            held === place.id ? 'fill-secondary/45' : 'fill-secondary/20',
          )}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}
      {bysize.map((place) => {
        const centre = drawn.get(place.id)?.centre ?? { x: 0, y: 0 }
        const radius = radiusOf(place.id)
        return (
          <g key={place.id}>
            <circle
              cx={centre.x}
              cy={centre.y}
              r={radius}
              role="slider"
              tabIndex={place.locked ? -1 : 0}
              aria-label={t('game.resources.sliderOf', { name: place.name })}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={amounts[place.id] ?? 0}
              aria-valuetext={`${String(amounts[place.id] ?? 0)} (${String(percent(place.id))}%)`}
              aria-disabled={place.locked}
              className={cn(
                'stroke-background focus-visible:stroke-foreground outline-none',
                place.locked ? 'fill-muted-foreground/80' : 'fill-secondary/75 cursor-grab',
                held === place.id && 'cursor-grabbing',
              )}
              strokeWidth={1.5}
              onPointerDown={(event) => {
                if (place.locked) return
                event.currentTarget.setPointerCapture(event.pointerId)
                setHeld(place.id)
                drag(event, place, true)
              }}
              onPointerMove={(event) => held === place.id && drag(event, place, false)}
              onPointerUp={() => {
                if (held !== place.id) return
                setHeld(null)
                props.onCommit()
              }}
              onPointerCancel={() => setHeld(null)}
              onKeyDown={(event) => !place.locked && onKey(event, place)}
            />
            {/* What it holds, inside the bubble once there is room for the figure. */}
            {radius >= 10 && (
              <text
                x={centre.x}
                y={centre.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none fill-white font-mono text-[9px] font-bold"
              >
                {amounts[place.id] ?? 0}
              </text>
            )}
          </g>
        )
      })}
      {/* The one being moved says its name and its share, above the bubble. */}
      {heldPlace && heldCentre && (
        <text
          x={Math.max(70, Math.min(WIDTH - 70, heldCentre.x))}
          y={Math.max(14, heldCentre.y - radiusOf(heldPlace.id) - 8)}
          textAnchor="middle"
          className="fill-foreground stroke-background pointer-events-none text-[11px] font-bold [paint-order:stroke]"
          strokeWidth={3}
        >
          {heldPlace.name} · {amounts[heldPlace.id] ?? 0} ({percent(heldPlace.id)}%)
        </text>
      )}
    </svg>
  )
}
