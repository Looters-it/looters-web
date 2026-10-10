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
