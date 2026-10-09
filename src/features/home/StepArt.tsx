import type { HowStep } from './HowItWorks'

const COLS = 6
const ROWS = 5
const R = 30
const W = R * Math.sqrt(3)

type Cell = readonly [col: number, row: number]

function centre([col, row]: Cell) {
  return { x: W * (col + 0.5 * (row % 2)) + W / 2, y: R * 1.5 * row + R }
}

function hexagon(cell: Cell) {
  const { x, y } = centre(cell)
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 3) * corner - Math.PI / 2
    return `${(x + (R - 2) * Math.cos(angle)).toFixed(1)},${(y + (R - 2) * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

const key = (cell: Cell) => cell.join(',')
const cells = (...list: Cell[]) => new Set(list.map(key))

const MINE: Cell = [1, 2]
const THEIRS: Cell = [4, 2]

/** What the little map looks like at each step: whose cells, and who strikes whom. */
const SCENES: Record<HowStep, { mine: Set<string>; theirs: Set<string>; strike?: [Cell, Cell] }> = {
  start: { mine: cells(MINE), theirs: cells() },
  grow: { mine: cells(MINE, [0, 2], [1, 1], [1, 3], [2, 2], [2, 1]), theirs: cells() },
  fight: {
    mine: cells(MINE, [0, 2], [1, 1], [1, 3], [2, 2], [2, 1]),
    theirs: cells(THEIRS, [3, 1], [4, 1], [5, 2], [3, 3], [4, 3], [3, 2]),
    strike: [
      [2, 2],
      [3, 2],
    ],
  },
  win: {
    mine: cells(
      ...Array.from({ length: COLS * ROWS }, (_, index): Cell => [
        index % COLS,
        Math.floor(index / COLS),
      ]),
    ),
    theirs: cells(),
  },
}

/**
 * The picture beside a step of "Come funziona": a map of invented cells, drawn
 * in the colours of the page, that tells the step without words.
 */
export function StepArt(props: { step: HowStep; className?: string }) {
  const scene = SCENES[props.step]
  const grid = Array.from({ length: COLS * ROWS }, (_, index): Cell => [
    index % COLS,
    Math.floor(index / COLS),
  ])
  const capitals = [MINE, ...(scene.theirs.size > 0 ? [THEIRS] : [])]
  return (
    <svg
      viewBox={`0 0 ${W * (COLS + 0.5)} ${R * 1.5 * (ROWS - 1) + R * 2}`}
      aria-hidden="true"
      className={props.className}
    >
      {grid.map((cell) => (
        <polygon
          key={key(cell)}
          points={hexagon(cell)}
          fill={
            scene.mine.has(key(cell))
              ? 'var(--color-secondary)'
              : scene.theirs.has(key(cell))
                ? 'var(--color-powder-blue)'
                : 'var(--color-key-soft)'
          }
        />
      ))}
      {capitals.map((cell) => {
        const { x, y } = centre(cell)
        return <circle key={key(cell)} cx={x} cy={y} r={7} fill="var(--color-ground)" />
      })}
      {scene.strike &&
        (() => {
          const from = centre(scene.strike[0])
          const to = centre(scene.strike[1])
          return (
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-ink)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="2 12"
            />
          )
        })()}
    </svg>
  )
}
