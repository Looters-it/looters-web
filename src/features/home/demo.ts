import type { UnitPoint } from '@/features/map/api'

/** A number in [0, 1): `Math.random` on the page, fixed in tests. */
export type Random = () => number

export interface DemoEmpire {
  name: string
  color: string
  emblem: string
  capitalId: number
}

/** What just happened in the demonstration, for the map and for the chronicle. */
export type DemoEvent =
  | { type: 'annexed'; empire: number; unitId: number }
  | { type: 'conquered' | 'defended'; empire: number; other: number; unitId: number }

const COLORS = ['#9c1c1c', '#1c5c9c', '#1c9c3c', '#c8a641', '#7011d0', '#d07011']
const EMBLEMS = ['torre', 'stella', 'corona', 'croce', 'scudo', 'monte']
const TITLES = ['Ducato', 'Repubblica', 'Contea', 'Signoria', 'Marca', 'Lega']

const distance2 = (a: UnitPoint, b: UnitPoint) => (a.lon - b.lon) ** 2 + (a.lat - b.lat) ** 2

/**
 * The stage of the demonstration: the municipalities closest to one of them,
 * few enough for a change of owner to be seen from where the map stands.
 */
export function demoStage(units: readonly UnitPoint[], size: number, random: Random): UnitPoint[] {
  if (units.length <= size) return [...units]
  const centre = units[Math.floor(random() * units.length)]!
  return [...units].sort((a, b) => distance2(a, centre) - distance2(b, centre)).slice(0, size)
}

/** [west, south, east, north] around some municipalities. */
export function boundsOf(units: readonly UnitPoint[]): [number, number, number, number] | null {
  if (units.length === 0) return null
  const lons = units.map((unit) => unit.lon)
  const lats = units.map((unit) => unit.lat)
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

/**
 * A made-up match that plays itself on the homepage: a handful of empires
 * that annex the free municipalities around them and fight over the others.
 * It only looks like the game: no rule is applied, nobody plays it, and
 * neighbours are simply the municipalities nearest to each other.
 */
export class Demo {
  readonly empires: DemoEmpire[]
  /** Municipality id → index of the empire that holds it. */
  readonly owner = new Map<number, number>()
  private readonly units: Map<number, UnitPoint>
  private readonly near = new Map<number, number[]>()
  private readonly capitals: Set<number>

  private readonly random: Random

  constructor(stage: readonly UnitPoint[], random: Random, empires = 6) {
    this.random = random
    this.units = new Map(stage.map((unit) => [unit.id, unit]))
    for (const unit of stage) {
      this.near.set(
        unit.id,
        stage
          .filter((other) => other.id !== unit.id)
          .sort((a, b) => distance2(a, unit) - distance2(b, unit))
          .slice(0, 6)
          .map((other) => other.id),
      )
    }
    // Capitals apart from each other but inside the stage, not on its edges (the farthest
    // points would be islands and corners): taken at random among the municipalities
    // that keep a distance from those already chosen, a distance that shrinks if needed.
    const capitals: UnitPoint[] = []
    const count = Math.min(empires, COLORS.length, stage.length)
    const box = boundsOf(stage) ?? [0, 0, 0, 0]
    const centre = { lon: (box[0] + box[2]) / 2, lat: (box[1] + box[3]) / 2 }
    const span = Math.hypot(box[2] - box[0], box[3] - box[1])
    // The inner part of the stage, where every capital has land on all sides.
    const inner = [...stage]
      .sort((a, b) => distance2(a, centre as UnitPoint) - distance2(b, centre as UnitPoint))
      .slice(0, Math.max(count, Math.ceil(stage.length * 0.6)))
    for (let apart = span / 4; capitals.length < count; apart *= 0.8) {
      for (let tries = 0; tries < 40 && capitals.length < count; tries++) {
        const candidate = inner[Math.floor(random() * inner.length)]!
        if (
          capitals.every((c) => c.id !== candidate.id && distance2(c, candidate) >= apart * apart)
        ) {
          capitals.push(candidate)
        }
      }
    }
    this.empires = capitals.map((capital, index) => ({
      name: `${TITLES[index % TITLES.length]!} di ${capital.name}`,
      color: COLORS[index]!,
      emblem: EMBLEMS[index % EMBLEMS.length]!,
      capitalId: capital.id,
    }))
    this.capitals = new Set(capitals.map((capital) => capital.id))
    this.restart()
  }

  /** Back to the beginning: every empire on its capital alone. */
  restart(): void {
    this.owner.clear()
    this.empires.forEach((empire, index) => this.owner.set(empire.capitalId, index))
  }

  unit(id: number): UnitPoint | undefined {
    return this.units.get(id)
  }

  /** How many municipalities each empire holds. */
  sizes(): number[] {
    const sizes = this.empires.map(() => 0)
    for (const empire of this.owner.values()) sizes[empire]! += 1
    return sizes
  }

  /**
   * One move: an empire reaches for a municipality next to its own. A free
   * one is annexed; another empire's is fought over, and the attacker wins
   * about two times in five. Capitals are never taken, so nobody leaves the
   * stage. Returns null when there was nothing to do.
   */
  step(): DemoEvent | null {
    // When the map is nearly full the story starts again.
    if (this.owner.size >= this.units.size * 0.92) this.restart()
    for (let tries = 0; tries < 12; tries++) {
      const empire = Math.floor(this.random() * this.empires.length)
      const held = [...this.owner].filter(([, owner]) => owner === empire).map(([id]) => id)
      const from = held[Math.floor(this.random() * held.length)]
      const around = from === undefined ? [] : (this.near.get(from) ?? [])
      const targets = around.filter((id) => this.owner.get(id) !== empire && !this.capitals.has(id))
      // Free municipalities first: empires grow before they fight.
      const free = targets.filter((id) => !this.owner.has(id))
      const pool = free.length > 0 ? free : targets
      const unitId = pool[Math.floor(this.random() * pool.length)]
      if (unitId === undefined) continue
      const other = this.owner.get(unitId)
      if (other === undefined) {
        this.owner.set(unitId, empire)
        return { type: 'annexed', empire, unitId }
      }
      if (this.random() < 0.4) {
        this.owner.set(unitId, empire)
        return { type: 'conquered', empire, other, unitId }
      }
      return { type: 'defended', empire, other, unitId }
    }
    return null
  }
}
