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
