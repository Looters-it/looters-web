import type { Map as MapLibreMap } from 'maplibre-gl'

/** The name the image goes by on the map. */
export const SHIELD_ICON = 'protected-shield'
/** Side of the drawing in pixels; shown smaller, so that it stays sharp. */
const SIZE = 56

/**
 * Makes sure the map has the sign of a protected territory: a pale shield with
 * a dark edge, a shape that says "it cannot be attacked" without relying on a
 * colour. Does nothing where there is no canvas to draw on.
 */
export function ensureShieldIcon(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || map.hasImage(SHIELD_ICON)) return
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return
  // Drawn on a 24 by 24 grid, like the icons of the interface.
  context.scale(SIZE / 24, SIZE / 24)
  const shield = new Path2D(
    'M12 2.5 L20 5.5 V11.5 C20 16.5 16.5 20 12 21.5 C7.5 20 4 16.5 4 11.5 V5.5 Z',
  )
  context.lineJoin = 'round'
  context.lineWidth = 2.5
  context.strokeStyle = '#072a3e'
  context.fillStyle = '#f3f6fb'
  context.fill(shield)
  context.stroke(shield)
  map.addImage(SHIELD_ICON, context.getImageData(0, 0, SIZE, SIZE), { pixelRatio: 2 })
}

/** The name the sign of a municipality that can be annexed goes by on the map. */
export const ANNEX_ICON = 'annex-flag'

/**
 * Makes sure the map has the sign of a free municipality that can be annexed now:
 * a white flag on a green disc. A button drawn on the map: tapping it annexes.
 */
export function ensureAnnexIcon(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || map.hasImage(ANNEX_ICON)) return
  const side = 72
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return
  context.beginPath()
  context.arc(side / 2, side / 2, side / 2 - 3, 0, Math.PI * 2)
  context.fillStyle = '#1f9d55'
  context.fill()
  context.lineWidth = 4
  context.strokeStyle = '#ffffff'
  context.stroke()
  // The flag, on a 24 by 24 grid set in the middle of the disc.
  const scale = 1.75
  context.translate((side - 24 * scale) / 2, (side - 24 * scale) / 2)
  context.scale(scale, scale)
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.fillStyle = '#ffffff'
  const cloth = new Path2D('M5 15 C8 13 11 17 19 15 V4 C11 6 8 2 5 4 Z')
  context.fill(cloth)
  context.stroke(cloth)
  context.stroke(new Path2D('M5 22 V4'))
  map.addImage(ANNEX_ICON, context.getImageData(0, 0, side, side), { pixelRatio: 2 })
}

/** The name the sign of a territory that can be attacked goes by on the map. */
export const SWORDS_ICON = 'attack-swords'

/**
 * Makes sure the map has the sign of a territory that can be attacked: two
 * crossed swords, white on a disc of the colour of what is pressed. A button
 * drawn on the map: tapping it starts the attack.
 */
export function ensureSwordsIcon(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || map.hasImage(SWORDS_ICON)) return
  const side = 72
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return
  context.beginPath()
  context.arc(side / 2, side / 2, side / 2 - 3, 0, Math.PI * 2)
  context.fillStyle = '#ee4266'
  context.fill()
  context.lineWidth = 4
  context.strokeStyle = '#ffffff'
  context.stroke()
  // The two swords, on a 24 by 24 grid set in the middle of the disc.
  const scale = 1.75
  context.translate((side - 24 * scale) / 2, (side - 24 * scale) / 2)
  context.scale(scale, scale)
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const path of [
    'M14.5 17.5 L3 6 V3 H6 L17.5 14.5',
    'M13 19 L19 13',
    'M16 16 L20 20',
    'M19 21 L21 19',
    'M14.5 6.5 L18 3 H21 V6 L17.5 9.5',
    'M5 14 L9 18',
    'M7 17 L4 20',
    'M3 19 L5 21',
  ]) {
    context.stroke(new Path2D(path))
  }
  map.addImage(SWORDS_ICON, context.getImageData(0, 0, side, side), { pixelRatio: 2 })
}

/** The names the signs of an island and of an exclave go by on the map. */
export const ISLAND_ICON = 'unit-island'
export const EXCLAVE_ICON = 'unit-exclave'

/**
 * Makes sure the map has the signs that say why a municipality has no neighbours: an
 * island (land rising from two waves) and an exclave (a piece of land inside a broken
 * border). Shapes on a pale disc with a dark edge, so that neither relies on a colour.
 */
export function ensureIsolationIcons(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || typeof Path2D === 'undefined') return
  const drawings: [string, (context: CanvasRenderingContext2D) => void][] = [
    [
      ISLAND_ICON,
      (context) => {
        // The island, and the sea under it.
        context.fill(new Path2D('M6.5 13.5 C7.5 9.5 10 8 12 8 C14 8 16.5 9.5 17.5 13.5 Z'))
        context.stroke(new Path2D('M5.5 16 q1.6 -1.4 3.2 0 t3.3 0 t3.3 0 t3.2 0'))
        context.stroke(new Path2D('M7.5 19 q1.5 -1.3 3 0 t3 0 t3 0'))
      },
    ],
    [
      EXCLAVE_ICON,
      (context) => {
        // A border drawn in pieces all round, and the land it closes in.
        context.setLineDash([2.6, 2.2])
        context.stroke(new Path2D('M12 5.5 a6.5 6.5 0 1 0 0.01 0'))
        context.setLineDash([])
        context.fill(new Path2D('M12 9.2 a2.8 2.8 0 1 0 0.01 0'))
      },
    ],
  ]
  for (const [name, draw] of drawings) {
    if (map.hasImage(name)) continue
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(SIZE / 24, SIZE / 24)
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.fillStyle = '#f3f6fb'
    context.strokeStyle = '#072a3e'
    context.lineWidth = 1.6
    const disc = new Path2D('M12 1.5 a10.5 10.5 0 1 0 0.01 0')
    context.fill(disc)
    context.stroke(disc)
    context.fillStyle = '#072a3e'
    draw(context)
    map.addImage(name, context.getImageData(0, 0, SIZE, SIZE), { pixelRatio: 2 })
  }
}

/** The name the sign of a port goes by on the map. */
export const PORT_ICON = 'structure-port'

/**
 * Makes sure the map has the sign of a port: an anchor on a blue disc. The sea is
 * reached from where it stands.
 */
export function ensurePortIcon(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || map.hasImage(PORT_ICON)) return
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return
  context.scale(SIZE / 24, SIZE / 24)
  context.lineJoin = 'round'
  context.lineCap = 'round'
  const disc = new Path2D('M12 1.5 a10.5 10.5 0 1 0 0.01 0')
  context.fillStyle = '#1d6fd6'
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1.6
  context.fill(disc)
  context.stroke(disc)
  // The anchor: ring, shank, stock and the two arms.
  context.lineWidth = 1.8
  context.stroke(new Path2D('M12 6.2 a1.4 1.4 0 1 0 0.01 0'))
  context.stroke(new Path2D('M12 9 V18.5'))
  context.stroke(new Path2D('M9.3 11.3 H14.7'))
  context.stroke(new Path2D('M6.5 13.5 C6.8 16.6 9 18.5 12 18.5 C15 18.5 17.2 16.6 17.5 13.5'))
  map.addImage(PORT_ICON, context.getImageData(0, 0, SIZE, SIZE), { pixelRatio: 2 })
}

/** The name the sign of an airport goes by on the map. */
export const AIRPORT_ICON = 'structure-airport'

/**
 * Makes sure the map has the sign of an airport: a plane on a violet disc. Whatever is
 * in its range is reached from where it stands.
 */
export function ensureAirportIcon(map: MapLibreMap): void {
  if (typeof map.hasImage !== 'function' || map.hasImage(AIRPORT_ICON)) return
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return
  context.scale(SIZE / 24, SIZE / 24)
  context.lineJoin = 'round'
  context.lineCap = 'round'
  const disc = new Path2D('M12 1.5 a10.5 10.5 0 1 0 0.01 0')
  context.fillStyle = '#7c3aed'
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1.6
  context.fill(disc)
  context.stroke(disc)
  // The plane, seen from above and pointing up: body, wings and tail.
  context.fillStyle = '#ffffff'
  context.fill(
    new Path2D(
      'M12 4.5 C12.8 4.5 13.2 5.4 13.2 6.6 V10 L18.6 13.4 V15 L13.2 13.4 V16.6 L15 18 V19.2 L12 18.4 L9 19.2 V18 L10.8 16.6 V13.4 L5.4 15 V13.4 L10.8 10 V6.6 C10.8 5.4 11.2 4.5 12 4.5 Z',
    ),
  )
  map.addImage(AIRPORT_ICON, context.getImageData(0, 0, SIZE, SIZE), { pixelRatio: 2 })
}
