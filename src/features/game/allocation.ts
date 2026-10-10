/** Pure helpers for the "resources per municipality" editor. */

export type Amounts = Record<string, number>

export const totalOf = (amounts: Amounts) =>
  Object.values(amounts).reduce((sum, amount) => sum + amount, 0)

/**
 * Moves one slider. The total never grows: a territory can rise only by
 * what has been freed from the others and not yet assigned.
 */
export function setAmount(amounts: Amounts, total: number, id: string, wanted: number): Amounts {
  const unallocated = total - totalOf(amounts)
  const ceiling = (amounts[id] ?? 0) + unallocated
  return { ...amounts, [id]: Math.max(0, Math.min(Math.round(wanted), ceiling)) }
}

/** Equal parts; what the division leaves over goes to the capital (or the first territory). */
export function splitEqually(ids: string[], total: number, capitalId: string | null): Amounts {
  if (ids.length === 0) return {}
  const each = Math.floor(total / ids.length)
  const amounts = Object.fromEntries(ids.map((id) => [id, each]))
  const extra = capitalId && ids.includes(capitalId) ? capitalId : ids[0]!
  amounts[extra]! += total - each * ids.length
  return amounts
}

export const sameAmounts = (a: Amounts, b: Amounts) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([id, amount]) => b[id] === amount)

/**
 * Gives one territory what is wanted and lets the others give way in proportion to
 * what they hold, so that the total stays assigned to the last unit. Territories that
 * cannot move (in a battle) keep what they have, and bound what the one can take.
 */
export function rebalance(
  amounts: Amounts,
  id: string,
  wanted: number,
  fixedIds: readonly string[] = [],
): Amounts {
  const others = Object.keys(amounts).filter((other) => other !== id && !fixedIds.includes(other))
  if (fixedIds.includes(id) || others.length === 0) return amounts
  const movable = (amounts[id] ?? 0) + others.reduce((sum, other) => sum + (amounts[other] ?? 0), 0)
  const mine = Math.max(0, Math.min(Math.round(wanted), movable))
  const rest = movable - mine
  const held = others.reduce((sum, other) => sum + (amounts[other] ?? 0), 0)
  // In proportion to what each holds; when the others hold nothing, in equal parts.
  const exact = others.map((other) =>
    held > 0 ? ((amounts[other] ?? 0) / held) * rest : rest / others.length,
  )
  const next: Amounts = { ...amounts, [id]: mine }
  let given = 0
  others.forEach((other, index) => {
    next[other] = Math.floor(exact[index] ?? 0)
    given += next[other]
  })
  // What the rounding left over goes, a unit each, to those that lost the largest fraction.
  others
    .map((other, index) => ({ other, lost: (exact[index] ?? 0) - Math.floor(exact[index] ?? 0) }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, rest - given)
    .forEach(({ other }) => {
      next[other] = (next[other] ?? 0) + 1
    })
  return next
}

/** Where a preset puts the resources: one side of the empire, two opposite ones, its edge, everywhere. */
export type AllocationPreset =
  'equal' | 'frontier' | 'north' | 'south' | 'east' | 'west' | 'eastWest' | 'northSouth'

export const ALLOCATION_PRESETS: readonly AllocationPreset[] = [
  'equal',
  'frontier',
  'north',
  'south',
  'west',
  'east',
  'eastWest',
  'northSouth',
]

interface Placed {
  id: string
  lon: number
  lat: number
  frontier: boolean
}

/**
 * The territories a preset gives the resources to. Sides are halves of the empire as
 * it lies on the map, and two opposite sides are its outer thirds; a choice that
 * would leave nobody (an empire all in one place) takes them all.
 */
export function presetIds(preset: AllocationPreset, places: readonly Placed[]): string[] {
  if (places.length === 0) return []
  const span = (values: number[]) => {
    const low = Math.min(...values)
    const width = Math.max(...values) - low
    return (value: number) => (width > 0 ? (value - low) / width : 0.5)
  }
  const across = span(places.map((place) => place.lon))
  const up = span(places.map((place) => place.lat))
  const chosen = places.filter((place) => {
    const x = across(place.lon)
    const y = up(place.lat)
    switch (preset) {
      case 'equal':
        return true
      case 'frontier':
        return place.frontier
      case 'north':
        return y > 0.5
      case 'south':
        return y < 0.5
      case 'east':
        return x > 0.5
      case 'west':
        return x < 0.5
      case 'eastWest':
        return x <= 1 / 3 || x >= 2 / 3
      case 'northSouth':
        return y <= 1 / 3 || y >= 2 / 3
    }
  })
  return (chosen.length > 0 ? chosen : places).map((place) => place.id)
}
