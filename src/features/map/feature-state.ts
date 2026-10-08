/** Changes that turn one assignment of values to municipalities into another. */
export interface StateDiff<T> {
  set: [id: number, value: T][]
  clear: number[]
}

/**
 * Compares two assignments so that only the municipalities that actually
 * changed are touched on the map: with thousands of features and a turn
 * that changes a handful, the map updates in place.
 */
export function diffState<T>(
  previous: ReadonlyMap<number, T>,
  next: ReadonlyMap<number, T>,
): StateDiff<T> {
  const diff: StateDiff<T> = { set: [], clear: [] }
  for (const [id, value] of next) {
    if (previous.get(id) !== value) diff.set.push([id, value])
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) diff.clear.push(id)
  }
  return diff
}

/** The same comparison for a set of flagged municipalities. */
export function diffFlags(
  previous: ReadonlySet<number>,
  next: ReadonlySet<number>,
): { on: number[]; off: number[] } {
  return {
    on: [...next].filter((id) => !previous.has(id)),
    off: [...previous].filter((id) => !next.has(id)),
  }
}
