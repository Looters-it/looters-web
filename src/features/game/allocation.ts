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
