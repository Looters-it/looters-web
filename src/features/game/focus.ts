/**
 * The focus of the resources: a point on the map the resources of an empire gather
 * by. It is kept where the map is, not where it is drawn, so that it stays put while
 * the empire grows, and it is remembered for each match: every turn the new income
 * is spread the same way without the player doing it again.
 */

/**
 * How the focus spreads the resources: all to the territory it is on, which is what a
 * bag of money on the map of the game means; or, from the map of the resources, around
 * the point it is on, around that point and the one opposite to it across the empire, in a ring around the middle of the
 * empire as wide as the focus is far from it, or evenly along the line between the
 * point and a second one.
 */
export type FocusMode = 'point' | 'area' | 'mirror' | 'radial' | 'line'

export interface Focus {
  mode: FocusMode
  lon: number
  lat: number
  /** The other end of a line: where it is not set, the point opposite to the first. */
  to?: Point
  /**
   * How much of the resources the focus itself carries, against the shares of its
   * other parts: one where it is not said.
   */
  share?: number
  /**
   * The focus split in more parts: each further point gives the territory it is on
   * its share of the resources.
   */
  more?: Part[]
}

export interface Point {
  lon: number
  lat: number
}

/** A further part of a focus: where it is, and how much it carries against the others. */
export interface Part extends Point {
  share?: number
}

/** The share a part carries: one where it is not said. */
export const shareOf = (part: { share?: number }): number => part.share ?? 1

const withShare = <T extends { share?: number }>(part: T, share: number): T => {
  const { share: _, ...rest } = part
  return (share === 1 ? rest : { ...rest, share }) as T
}

interface Placed {
  id: string
  lon: number
  lat: number
}

/** How far the focus reaches, as a part of the size of the empire. */
const FOCUS_REACH = 0.4
/** Below this a territory is too far to count: nothing, instead of a unit left behind. */
const NEGLIGIBLE = 0.02

/** The middle of the territories as they lie on the map, not of where they crowd. */
export function middleOf(places: readonly Placed[]): { lon: number; lat: number } {
  if (places.length === 0) return { lon: 0, lat: 0 }
  const lons = places.map((place) => place.lon)
  const lats = places.map((place) => place.lat)
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
  }
}

/** The point opposite to the focus across the middle of the empire. */
export function oppositeOf(places: readonly Placed[], focus: Pick<Focus, 'lon' | 'lat'>) {
  const middle = middleOf(places)
  return { lon: 2 * middle.lon - focus.lon, lat: 2 * middle.lat - focus.lat }
}

/** The second end of the line of a focus. */
export function lineEndOf(places: readonly Placed[], focus: Focus) {
  return focus.to ?? oppositeOf(places, focus)
}

/** How much each territory should weigh under a focus: more the nearer it is to it. */
export function focusWeights(places: readonly Placed[], focus: Focus): Record<string, number> {
  const middle = middleOf(places)
  // Flat enough at the size of an empire: degrees, narrowed by the latitude.
  const narrow = Math.cos((middle.lat * Math.PI) / 180)
  const apart = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) =>
    Math.hypot((a.lon - b.lon) * narrow, a.lat - b.lat)
  const size = Math.max(1e-6, ...places.map((place) => apart(place, middle)))
  const near = (distance: number) => Math.exp(-((distance / (size * FOCUS_REACH)) ** 2))
  const other = oppositeOf(places, focus)
  const ring = apart(focus, middle)
  // How far a territory is from the line between the two ends, anywhere along it.
  const end = lineEndOf(places, focus)
  const fromLine = (place: Placed) => {
    const along = { x: (end.lon - focus.lon) * narrow, y: end.lat - focus.lat }
    const to = { x: (place.lon - focus.lon) * narrow, y: place.lat - focus.lat }
    const length = along.x ** 2 + along.y ** 2
    const part =
      length > 0 ? Math.max(0, Math.min(1, (to.x * along.x + to.y * along.y) / length)) : 0
    return Math.hypot(to.x - along.x * part, to.y - along.y * part)
  }
  // The territory a point is on: the nearest, and it alone takes everything.
  const onlyAt = (point: Point) => {
    const nearest = places.reduce<Placed | null>(
      (best, place) => (best && apart(best, point) <= apart(place, point) ? best : place),
      null,
    )
    return (place: Placed) => (place.id === nearest?.id ? 1 : 0)
  }
  const first =
    focus.mode === 'point'
      ? onlyAt(focus)
      : (place: Placed) =>
          focus.mode === 'area'
            ? near(apart(place, focus))
            : focus.mode === 'mirror'
              ? Math.max(near(apart(place, focus)), near(apart(place, other)))
              : focus.mode === 'line'
                ? near(fromLine(place))
                : near(apart(place, middle) - ring)
  // Every part carries its share of the whole, however many territories it reaches:
  // each is brought to one before they are put together.
  const parts = [first, ...(focus.more ?? []).map(onlyAt)]
  const shares = [shareOf(focus), ...(focus.more ?? []).map(shareOf)]
  const weights: Record<string, number> = Object.fromEntries(places.map((place) => [place.id, 0]))
  for (const [at, part] of parts.entries()) {
    const reached = places.map((place) => {
      const weight = part(place)
      return weight < NEGLIGIBLE ? 0 : weight
    })
    const sum = reached.reduce((all, weight) => all + weight, 0)
    if (sum <= 0) continue
    places.forEach((place, index) => {
      weights[place.id] =
        (weights[place.id] ?? 0) + ((reached[index] ?? 0) / sum) * (shares[at] ?? 1)
    })
  }
  return weights
}

/**
 * The focus without the parts that lie on a point another has already: two bags on
 * one spot are one bag, carrying what the two did.
 */
export function tidied(focus: Focus): Focus {
  // The focus first, then its parts: each with what it has gathered so far.
  const kept: Part[] = [{ lon: focus.lon, lat: focus.lat, share: shareOf(focus) }]
  for (const point of focus.more ?? []) {
    const there = kept.find((other) => other.lon === point.lon && other.lat === point.lat)
    if (there) there.share = shareOf(there) + shareOf(point)
    else kept.push({ ...point, share: shareOf(point) })
  }
  const [first, ...more] = kept
  return rebuilt(
    withShare(focus, shareOf(first ?? focus)),
    more.map((part) => withShare(part, shareOf(part))),
  )
}

/** A point of a focus that can be taken and moved: the focus, the end of its line, a part. */
export interface FocusPoint extends Point {
  id: string
  /** What it carries, against the other points. */
  share: number
}

/** The points of a focus, the first being the focus itself. */
export function pointsOf(focus: Focus): FocusPoint[] {
  return [
    { id: 'at', lon: focus.lon, lat: focus.lat, share: shareOf(focus) },
    ...(focus.mode === 'line' && focus.to ? [{ id: 'to', ...focus.to, share: 0 }] : []),
    ...(focus.more ?? []).map((point, index) => ({
      id: `more:${String(index)}`,
      lon: point.lon,
      lat: point.lat,
      share: shareOf(point),
    })),
  ]
}

const rebuilt = (focus: Focus, more: Part[]): Focus => {
  const { more: _, ...rest } = focus
  return more.length > 0 ? { ...rest, more } : rest
}

/** The focus with one of its points moved. */
export function movePoint(focus: Focus, id: string, here: Point): Focus {
  if (id === 'at') return { ...focus, ...here }
  if (id === 'to') return { ...focus, to: here }
  const index = Number(id.slice('more:'.length))
  return rebuilt(
    focus,
    (focus.more ?? []).map((point, at) => (at === index ? { ...point, ...here } : point)),
  )
}

/** The focus with one more part, where it is said. */
export function addPoint(focus: Focus, here: Point): Focus {
  return rebuilt(focus, [...(focus.more ?? []), here])
}

/**
 * One point of a focus split in two: half of what it carried stays with it, the other
 * half goes to a new part, where it is said. What the other points carry is not touched.
 */
export function splitPoint(focus: Focus, id: string, here: Point): Focus {
  const more = focus.more ?? []
  if (id.startsWith('more:')) {
    const index = Number(id.slice('more:'.length))
    const half = shareOf(more[index] ?? {}) / 2
    return rebuilt(focus, [
      ...more.map((point, at) => (at === index ? withShare<Part>(point, half) : point)),
      withShare<Part>({ ...here }, half),
    ])
  }
  const half = shareOf(focus) / 2
  return rebuilt(withShare(focus, half), [...more, withShare<Part>({ ...here }, half)])
}

/** A point of a focus put together with another: the other carries what the two did. */
export function joinPoint(focus: Focus, id: string, onto: string): Focus | null {
  const carried = pointsOf(focus).find((point) => point.id === id)?.share ?? 0
  const more = focus.more ?? []
  const index = onto.startsWith('more:') ? Number(onto.slice('more:'.length)) : -1
  const grown =
    index < 0
      ? withShare(focus, shareOf(focus) + carried)
      : rebuilt(
          focus,
          more.map((point, at) =>
            at === index ? withShare(point, shareOf(point) + carried) : point,
          ),
        )
  // Taking away the focus itself moves the first part to its place: said before it goes.
  return dropPoint(grown, id)
}

/**
 * The focus without one of its points: two parts put back together. Taking away the
 * focus itself leaves its place to the first of the other parts; a line that loses an
 * end is a focus on an area. Null when nothing is left.
 */
export function dropPoint(focus: Focus, id: string): Focus | null {
  const more = focus.more ?? []
  if (id.startsWith('more:')) {
    const index = Number(id.slice('more:'.length))
    return rebuilt(
      focus,
      more.filter((_, at) => at !== index),
    )
  }
  if (focus.mode === 'line' && focus.to) {
    const { to, ...rest } = focus
    return { ...rest, mode: 'area', ...(id === 'at' ? to : {}) }
  }
  const [next, ...others] = more
  return next
    ? rebuilt(withShare({ ...focus, lon: next.lon, lat: next.lat }, shareOf(next)), others)
    : null
}

const keyOf = (matchId: string) => `match.focus.${matchId}`

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Point).lon === 'number' &&
  typeof (value as Point).lat === 'number'

const isShare = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

// Who is showing the focus of a match: told when it is moved from somewhere else.
const watchers = new Set<() => void>()
const read = new Map<string, { raw: string | null; focus: Focus | null }>()

/** Follows the focus of the matches: calls back whenever one is saved. */
export function watchFocus(callback: () => void): () => void {
  watchers.add(callback)
  return () => watchers.delete(callback)
}

/** The focus the player left in this match, if any. */
export function loadFocus(matchId: string): Focus | null {
  try {
    const raw = localStorage.getItem(keyOf(matchId))
    // The same focus as long as nothing was saved: who follows it is not told in vain.
    const known = read.get(matchId)
    if (known && known.raw === raw) return known.focus
    const stored = parse(raw)
    const focus = stored && tidied(stored)
    read.set(matchId, { raw, focus })
    return focus
  } catch {
    return null
  }
}

function parse(raw: string | null): Focus | null {
  try {
    const stored = JSON.parse(raw ?? 'null') as Partial<Focus> | null
    return stored &&
      typeof stored.lon === 'number' &&
      typeof stored.lat === 'number' &&
      (stored.mode === 'point' ||
        stored.mode === 'area' ||
        stored.mode === 'mirror' ||
        stored.mode === 'radial' ||
        stored.mode === 'line')
      ? {
          mode: stored.mode,
          lon: stored.lon,
          lat: stored.lat,
          ...(isShare(stored.share) ? { share: stored.share } : {}),
          ...(isPoint(stored.to) ? { to: { lon: stored.to.lon, lat: stored.to.lat } } : {}),
          ...(Array.isArray(stored.more) && stored.more.some(isPoint)
            ? {
                more: stored.more.filter(isPoint).map((point) => ({
                  lon: point.lon,
                  lat: point.lat,
                  ...(isShare((point as Part).share) ? { share: (point as Part).share } : {}),
                })),
              }
            : {}),
        }
      : null
  } catch {
    return null
  }
}

/** Remembers the focus of this match, or forgets it with null. */
export function saveFocus(matchId: string, focus: Focus | null): void {
  try {
    if (focus) localStorage.setItem(keyOf(matchId), JSON.stringify(focus))
    else localStorage.removeItem(keyOf(matchId))
  } catch {
    // Not remembered, that is all.
  }
  for (const watcher of watchers) watcher()
}
