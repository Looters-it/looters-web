/**
 * The focus of the resources: a point on the map the resources of an empire gather
 * by. It is kept where the map is, not where it is drawn, so that it stays put while
 * the empire grows, and it is remembered for each match: every turn the new income
 * is spread the same way without the player doing it again.
 */

/**
 * How the focus spreads the resources: around the point it is on, around that point
 * and the one opposite to it across the empire, in a ring around the middle of the
 * empire as wide as the focus is far from it, or evenly along the line between the
 * point and a second one.
 */
export type FocusMode = 'area' | 'mirror' | 'radial' | 'line'

export interface Focus {
  mode: FocusMode
  lon: number
  lat: number
  /** The other end of a line: where it is not set, the point opposite to the first. */
  to?: { lon: number; lat: number }
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
  return Object.fromEntries(
    places.map((place) => {
      const weight =
        focus.mode === 'area'
          ? near(apart(place, focus))
          : focus.mode === 'mirror'
            ? Math.max(near(apart(place, focus)), near(apart(place, other)))
            : focus.mode === 'line'
              ? near(fromLine(place))
              : near(apart(place, middle) - ring)
      return [place.id, weight < NEGLIGIBLE ? 0 : weight]
    }),
  )
}

const keyOf = (matchId: string) => `match.focus.${matchId}`

/** The focus the player left in this match, if any. */
export function loadFocus(matchId: string): Focus | null {
  try {
    const stored = JSON.parse(
      localStorage.getItem(keyOf(matchId)) ?? 'null',
    ) as Partial<Focus> | null
    return stored &&
      typeof stored.lon === 'number' &&
      typeof stored.lat === 'number' &&
      (stored.mode === 'area' ||
        stored.mode === 'mirror' ||
        stored.mode === 'radial' ||
        stored.mode === 'line')
      ? {
          mode: stored.mode,
          lon: stored.lon,
          lat: stored.lat,
          ...(typeof stored.to?.lon === 'number' && typeof stored.to.lat === 'number'
            ? { to: { lon: stored.to.lon, lat: stored.to.lat } }
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
}
