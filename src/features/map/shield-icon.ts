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
