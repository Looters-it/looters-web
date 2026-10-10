import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { Amounts } from './allocation'

export interface RadarAxis {
  id: string
  name: string
  /** In a battle: it can neither give nor receive, so its point does not move. */
  locked: boolean
}

/** Wider than tall: the names stand at the sides of the chart. */
const WIDTH = 480
const HEIGHT = 320
const CENTRE_X = WIDTH / 2
const CENTRE_Y = HEIGHT / 2
const RADIUS = 112
/** Above this many territories the names would run into each other: only the held one is named. */
const NAMED_UP_TO = 12

/**
 * The resources of an empire as a radar: one axis for each territory, its point as
 * far from the centre as its share of the whole. Dragging a point changes that share
 * and the others give way in proportion, so the total is always assigned: one
 * gesture rebalances the empire.
 */
export function AllocationRadar(props: {
  axes: RadarAxis[]
  amounts: Amounts
  total: number
  /** While a point is dragged, or moved with the keys. */
  onChange: (id: string, wanted: number) => void
  /** When the gesture ends: the moment to save. */
  onCommit: () => void
}) {
  const { t } = useTranslation()
  const { axes, amounts, total } = props
  const svg = useRef<SVGSVGElement>(null)
  const [held, setHeld] = useState<string | null>(null)
  const share = (id: string) => (total > 0 ? (amounts[id] ?? 0) / total : 0)

  // The edge of the chart is a share that leaves room to grow: twice an equal part, or
  // a little more than the largest. It stays still while a point is held, so the point
  // follows the finger instead of running from it.
  const wantedEdge = Math.min(
    1,
    Math.max(
      2 / Math.max(axes.length, 1),
      Math.max(0, ...axes.map((axis) => share(axis.id))) * 1.25,
    ),
  )
  const frozenEdge = useRef(wantedEdge)
  if (held === null) frozenEdge.current = wantedEdge
  const edge = frozenEdge.current

  const angle = (index: number) => (index / axes.length) * Math.PI * 2 - Math.PI / 2
  const at = (index: number, fraction: number) => ({
    x: CENTRE_X + Math.cos(angle(index)) * RADIUS * fraction,
    y: CENTRE_Y + Math.sin(angle(index)) * RADIUS * fraction,
  })
  const pointOf = (index: number) => at(index, Math.min(1, share(axes[index]?.id ?? '') / edge))

  const drag = (event: PointerEvent<SVGCircleElement>, index: number) => {
    const box = svg.current?.getBoundingClientRect()
    const axis = axes[index]
    if (!box || !axis) return
    const x = ((event.clientX - box.left) / box.width) * WIDTH - CENTRE_X
    const y = ((event.clientY - box.top) / box.height) * HEIGHT - CENTRE_Y
    // How far along its own axis the finger is, whatever its distance from it.
    const along = (x * Math.cos(angle(index)) + y * Math.sin(angle(index))) / RADIUS
    props.onChange(axis.id, Math.round(Math.max(0, Math.min(1, along)) * edge * total))
  }
  const onKey = (event: KeyboardEvent<SVGCircleElement>, axis: RadarAxis) => {
    const step = Math.max(1, Math.round(total / 100)) * (event.shiftKey ? 5 : 1)
    const move =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? step
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -step
          : 0
    if (move === 0) return
    event.preventDefault()
    props.onChange(axis.id, (amounts[axis.id] ?? 0) + move)
    props.onCommit()
  }

  const outline = axes.map((_, index) => pointOf(index))
  const percent = (id: string) => Math.round(share(id) * 100)

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      role="group"
      aria-label={t('game.resources.radar')}
      className="mx-auto w-full max-w-xl touch-none select-none"
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, index) => `${String(at(index, ring).x)},${String(at(index, ring).y)}`)
            .join(' ')}
          className="stroke-border fill-none"
          strokeWidth={ring === 1 ? 1.5 : 0.75}
        />
      ))}
      {axes.map((axis, index) => (
        <line
          key={axis.id}
          x1={CENTRE_X}
          y1={CENTRE_Y}
          x2={at(index, 1).x}
          y2={at(index, 1).y}
          className="stroke-border"
          strokeWidth={0.75}
        />
      ))}
      <polygon
        points={outline.map((point) => `${String(point.x)},${String(point.y)}`).join(' ')}
        className="fill-secondary/30 stroke-secondary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {axes.map((axis, index) => {
        const label = at(index, 1.17)
        const named = axes.length <= NAMED_UP_TO || held === axis.id
        return (
          named && (
            <text
              key={axis.id}
              x={label.x}
              y={label.y}
              textAnchor={
                Math.abs(label.x - CENTRE_X) < 12 ? 'middle' : label.x > CENTRE_X ? 'start' : 'end'
              }
              dominantBaseline="middle"
              className={cn('fill-current text-[11px]', axis.locked && 'opacity-60')}
            >
              <tspan className="font-bold">{percent(axis.id)}%</tspan>{' '}
              {axis.name.length > 14 ? `${axis.name.slice(0, 13)}…` : axis.name}
            </text>
          )
        )
      })}
      {axes.map((axis, index) => {
        const point = pointOf(index)
        return (
          <circle
            key={axis.id}
            cx={point.x}
            cy={point.y}
            r={held === axis.id ? 11 : 8}
            role="slider"
            tabIndex={axis.locked ? -1 : 0}
            aria-label={t('game.resources.sliderOf', { name: axis.name })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={amounts[axis.id] ?? 0}
            aria-valuetext={`${String(amounts[axis.id] ?? 0)} (${String(percent(axis.id))}%)`}
            aria-disabled={axis.locked}
            className={cn(
              'stroke-background focus-visible:stroke-foreground outline-none',
              axis.locked ? 'fill-muted-foreground' : 'fill-secondary cursor-grab',
              held === axis.id && 'cursor-grabbing',
            )}
            strokeWidth={2}
            onPointerDown={(event) => {
              if (axis.locked) return
              event.currentTarget.setPointerCapture(event.pointerId)
              setHeld(axis.id)
              drag(event, index)
            }}
            onPointerMove={(event) => held === axis.id && drag(event, index)}
            onPointerUp={() => {
              if (held !== axis.id) return
              setHeld(null)
              props.onCommit()
            }}
            onPointerCancel={() => setHeld(null)}
            onKeyDown={(event) => !axis.locked && onKey(event, axis)}
          />
        )
      })}
    </svg>
  )
}
