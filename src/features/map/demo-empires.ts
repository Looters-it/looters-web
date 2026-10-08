import type { UnitPoint } from './api'
import type { EmpireLabel } from './GameMap'

/** Deterministic pseudo-random numbers, so the same area always looks the same. */
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Made-up empires for trying the map before matches exist: `count` capitals
 * are drawn among the municipalities and each one takes the municipalities
 * closest to it, within `reach` degrees. The rest stay free.
 */
export function demoEmpires(
  units: readonly UnitPoint[],
  count: number,
  palette: readonly string[],
  reach = 0.35,
): { colors: Map<number, string>; labels: EmpireLabel[] } {
  const colors = new Map<number, string>()
  if (units.length === 0 || palette.length === 0) return { colors, labels: [] }

  const random = mulberry32(units.length)
  const capitals: UnitPoint[] = []
  const taken = new Set<number>()
  while (capitals.length < Math.min(count, units.length)) {
    const unit = units[Math.floor(random() * units.length)]!
    if (taken.has(unit.id)) continue
    taken.add(unit.id)
    capitals.push(unit)
  }

  const sizes = new Array<number>(capitals.length).fill(0)
  for (const unit of units) {
    let best = -1
    let bestDistance = reach * reach
    for (let i = 0; i < capitals.length; i++) {
      const capital = capitals[i]!
      const distance = (unit.lon - capital.lon) ** 2 + (unit.lat - capital.lat) ** 2
      if (distance < bestDistance) {
        best = i
        bestDistance = distance
      }
    }
    if (best >= 0) {
      colors.set(unit.id, palette[best % palette.length]!)
      sizes[best]! += 1
    }
  }

  const labels = capitals.map((capital, i) => ({
    id: String(capital.id),
    name: capital.name,
    lon: capital.lon,
    lat: capital.lat,
    size: sizes[i]!,
  }))
  return { colors, labels }
}
