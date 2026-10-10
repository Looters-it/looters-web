import type { TerritoryShape } from '@/features/matches/api'

/**
 * The territories of an empire drawn to fill a chart of the given size: flat enough at
 * that size to be laid out by their coordinates, narrowed by the latitude. Gives the
 * outline of each territory and a point inside it, and the way from the map to the
 * chart and back. Null when there is nothing to draw.
 */
export function drawEmpire(
  shapes: readonly TerritoryShape[],
  width: number,
  height: number,
  margin: number,
) {
  const ringsOf = (shape: TerritoryShape) =>
    shape.geometry.type === 'Polygon'
      ? shape.geometry.coordinates
      : shape.geometry.coordinates.flat()
  const points = shapes.flatMap(ringsOf).flat()
  if (points.length === 0) return null
  const lats = points.map((point) => point[1] ?? 0)
  const narrow = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180)
  const xs = points.map((point) => (point[0] ?? 0) * narrow)
  const [left, right] = [Math.min(...xs), Math.max(...xs)]
  const [bottom, top] = [Math.min(...lats), Math.max(...lats)]
  const zoom = Math.min(
    (width - margin * 2) / Math.max(right - left, 1e-9),
    (height - margin * 2) / Math.max(top - bottom, 1e-9),
  )
  const place = (lon: number, lat: number) => ({
    x: width / 2 + (lon * narrow - (left + right) / 2) * zoom,
    y: height / 2 - (lat - (bottom + top) / 2) * zoom,
  })
  const unplace = (x: number, y: number) => ({
    lon: ((x - width / 2) / zoom + (left + right) / 2) / narrow,
    lat: (height / 2 - y) / zoom + (bottom + top) / 2,
  })
  const pathOf = (ring: number[][]) =>
    ring
      .map((point, index) => {
        const { x, y } = place(point[0] ?? 0, point[1] ?? 0)
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join('') + 'Z'
  const byId = new Map(
    shapes.map((shape) => [
      shape.id,
      { path: ringsOf(shape).map(pathOf).join(''), centre: place(shape.lon, shape.lat) },
    ]),
  )
  return { byId, place, unplace }
}
