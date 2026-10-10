import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CircleDot, Crosshair, FlipHorizontal2, Spline, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { TerritoryShape } from '@/features/matches/api'
import { cn } from '@/lib/utils'

import type { Amounts } from './allocation'
import { drawEmpire } from './empire-map'
import {
  focusWeights,
  lineEndOf,
  loadFocus,
  middleOf,
  oppositeOf,
  saveFocus,
  type Focus,
  type FocusMode,
} from './focus'

export interface AllocationPlace {
  id: string
  name: string
  /** In a battle: it can neither give nor receive, so its bubble does not move. */
  locked: boolean
}

const FOCUS_MODES: readonly [FocusMode, LucideIcon][] = [
  ['area', Crosshair],
  ['mirror', FlipHorizontal2],
  ['radial', CircleDot],
  ['line', Spline],
]

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
  /** The match the focus is remembered for. */
  matchId: string
  places: AllocationPlace[]
  shapes: TerritoryShape[]
  amounts: Amounts
  total: number
  /** While a bubble is dragged, or moved with the keys. */
  onChange: (id: string, wanted: number) => void
  /** While the focus is dragged: how much each territory that can move should weigh. */
  onSpread: (weights: Record<string, number>) => void
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
  const view = useMemo(() => drawEmpire(shapes, WIDTH, HEIGHT, MARGIN), [shapes])
  const drawn = view?.byId ?? null

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
  // The focus: a point dragged over the empire, the resources gathering where it says.
  // It is remembered with the match, where the map is and not where it is drawn.
  const [focus, setFocus] = useState<Focus | null>(() => loadFocus(props.matchId))
  const [mode, setMode] = useState<FocusMode>(focus?.mode ?? 'area')
  const [aiming, setAiming] = useState(false)
  const movable = shapes.filter((shape) =>
    places.some((place) => place.id === shape.id && !place.locked),
  )
  const spread = (next: Focus) => props.onSpread(focusWeights(movable, next))
  // Which end of a line is being dragged: the one that was nearer when it was taken.
  const end = useRef<'from' | 'to'>('from')
  const aim = (event: PointerEvent<SVGGElement>, taking = false) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box || !view) return
    const x = Math.max(0, Math.min(WIDTH, ((event.clientX - box.left) / box.width) * WIDTH))
    const y = Math.max(0, Math.min(HEIGHT, ((event.clientY - box.top) / box.height) * HEIGHT))
    const here = view.unplace(x, y)
    if (taking) {
      end.current =
        mode === 'line' &&
        focus &&
        Math.hypot(x - far.x, y - far.y) < Math.hypot(x - at.x, y - at.y)
          ? 'to'
          : 'from'
    }
    let next: Focus = { ...focus, mode, ...here }
    if (mode === 'line') {
      next =
        end.current === 'to' && focus
          ? { ...focus, mode, to: here }
          : // The other end stays where it is; the first time, opposite to this one.
            { mode, ...here, to: focus ? lineEndOf(movable, focus) : oppositeOf(movable, here) }
    }
    setFocus(next)
    spread(next)
  }
  const editable = movable.length >= 2
  const xy = (point: { lon: number; lat: number }) =>
    view?.place(point.lon, point.lat) ?? { x: WIDTH / 2, y: HEIGHT / 2 }
  const middle = xy(middleOf(movable))
  const at = focus ? xy(focus) : middle
  const opposite = focus ? xy(oppositeOf(movable, focus)) : middle
  const far = focus ? xy(lineEndOf(movable, focus)) : middle

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
    <div className="flex flex-col gap-2">
      {editable && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div
            role="group"
            aria-label={t('game.resources.focus.label')}
            className="bg-background rounded-pill flex border p-0.5"
          >
            {FOCUS_MODES.map(([option, Icon]) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                title={t(`game.resources.focus.${option}`)}
                aria-label={t(`game.resources.focus.${option}`)}
                className={cn(
                  'rounded-pill flex size-9 cursor-pointer items-center justify-center transition-colors [&_svg]:size-5',
                  mode === option ? 'bg-secondary text-white' : 'hover:bg-accent',
                )}
                onClick={() => {
                  setMode(option)
                  // The focus already placed spreads again, the new way, and is saved.
                  if (focus) {
                    const next = { ...focus, mode: option }
                    setFocus(next)
                    saveFocus(props.matchId, next)
                    spread(next)
                    props.onCommit()
                  }
                }}
              >
                <Icon aria-hidden="true" />
              </button>
            ))}
          </div>
          {focus && (
            <button
              type="button"
              title={t('game.resources.focus.clear')}
              aria-label={t('game.resources.focus.clear')}
              className="hover:bg-accent rounded-pill flex size-9 cursor-pointer items-center justify-center border transition-colors [&_svg]:size-5"
              onClick={() => {
                setFocus(null)
                saveFocus(props.matchId, null)
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
          <p className="text-muted-foreground text-base">
            {focus && !aiming
              ? t('game.resources.focus.kept')
              : t(`game.resources.focus.${mode}Hint`)}
          </p>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="group"
        aria-label={t('game.resources.radar')}
        // Never taller than what is left of the screen: the whole empire stays in sight.
        className="max-h-[calc(100dvh-29rem)] min-h-64 w-full touch-none select-none"
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
        {/* The focus, above everything: a sight to drag where the resources should gather. */}
        {editable && (
          <g
            role="slider"
            tabIndex={-1}
            aria-label={t('game.resources.focus.handle')}
            aria-valuenow={Math.round(Math.hypot(at.x - middle.x, at.y - middle.y))}
            className={cn(
              'text-foreground outline-none',
              aiming ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setAiming(true)
              aim(event, true)
            }}
            onPointerMove={(event) => aiming && aim(event)}
            onPointerUp={() => {
              if (!aiming) return
              setAiming(false)
              saveFocus(props.matchId, focus)
              props.onCommit()
            }}
            onPointerCancel={() => setAiming(false)}
          >
            {mode === 'radial' && (
              <circle
                cx={middle.x}
                cy={middle.y}
                r={Math.hypot(at.x - middle.x, at.y - middle.y)}
                className="pointer-events-none fill-none stroke-current opacity-70"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            )}
            {mode === 'mirror' && (
              <>
                <line
                  x1={at.x}
                  y1={at.y}
                  x2={opposite.x}
                  y2={opposite.y}
                  className="pointer-events-none stroke-current opacity-50"
                  strokeWidth={1}
                  strokeDasharray="5 4"
                />
                <circle
                  cx={opposite.x}
                  cy={opposite.y}
                  r={7}
                  className="fill-background pointer-events-none stroke-current opacity-80"
                  strokeWidth={2}
                />
              </>
            )}
            {mode === 'line' && (
              <>
                <line
                  x1={at.x}
                  y1={at.y}
                  x2={far.x}
                  y2={far.y}
                  className="pointer-events-none stroke-current opacity-80"
                  strokeWidth={2}
                />
                <circle cx={far.x} cy={far.y} r={16} className="fill-transparent" />
                <circle
                  cx={far.x}
                  cy={far.y}
                  r={aiming && end.current === 'to' ? 11 : 9}
                  className="fill-background stroke-current"
                  strokeWidth={2.5}
                />
                <circle
                  cx={far.x}
                  cy={far.y}
                  r={2.5}
                  className="fill-secondary pointer-events-none"
                />
              </>
            )}
            <circle cx={at.x} cy={at.y} r={16} className="fill-transparent" />
            <circle
              cx={at.x}
              cy={at.y}
              r={aiming ? 11 : 9}
              className="fill-background stroke-current"
              strokeWidth={2.5}
            />
            <path
              d={`M${String(at.x - 14)} ${String(at.y)}h8m12 0h8M${String(at.x)} ${String(at.y - 14)}v8m0 12v8`}
              className="pointer-events-none stroke-current"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={at.x} cy={at.y} r={2.5} className="fill-secondary pointer-events-none" />
          </g>
        )}
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
    </div>
  )
}
