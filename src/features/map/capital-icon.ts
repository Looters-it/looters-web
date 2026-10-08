import type { Map as MapLibreMap } from 'maplibre-gl'

import { GLYPHS, inkOn } from '@/features/matches/emblem-glyphs'

/** Side of the drawing in pixels; shown at half of it, so that it stays sharp. */
const SIZE = 64

export interface CapitalArms {
  color: string
  emblem: string
  /** Address of the uploaded logo, when there is one. */
  logo: string | null
}

/** The name the image goes by on the map: it changes when anything drawn changes. */
export const capitalIconId = (arms: CapitalArms) =>
  `capital:${arms.color}:${arms.emblem}:${arms.logo ?? ''}`

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    // A logo that does not load leaves the emblem in its place.
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/**
 * Draws the arms of an empire as the sign of its capital (PROMPT §2.8): a
 * disc of its colour with its emblem, or the uploaded logo cut to the disc.
 * Returns null where there is no canvas to draw on.
 */
async function draw(arms: CapitalArms): Promise<ImageData | null> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = typeof Path2D === 'undefined' ? null : canvas.getContext('2d')
  if (!context) return null
  const centre = SIZE / 2
  const radius = centre - 4

  context.beginPath()
  context.arc(centre, centre, radius, 0, Math.PI * 2)
  context.fillStyle = arms.color
  context.fill()

  const logo = arms.logo ? await loadImage(arms.logo) : null
  if (logo) {
    context.save()
    context.clip()
    // Cover the disc, keeping the proportions of the picture.
    const scale = Math.max((radius * 2) / logo.width, (radius * 2) / logo.height)
    const [width, height] = [logo.width * scale, logo.height * scale]
    context.drawImage(logo, centre - width / 2, centre - height / 2, width, height)
    context.restore()
  } else {
    // Emblems are authored on a 24 by 24 grid.
    const scale = (radius * 1.2) / 24
    context.save()
    context.translate(centre - 12 * scale, centre - 12 * scale)
    context.scale(scale, scale)
    context.fillStyle = inkOn(arms.color)
    context.fill(new Path2D(GLYPHS[arms.emblem] ?? GLYPHS.scudo))
    context.restore()
  }

  context.beginPath()
  context.arc(centre, centre, radius, 0, Math.PI * 2)
  context.lineWidth = 5
  context.strokeStyle = '#16120d'
  context.stroke()
  return context.getImageData(0, 0, SIZE, SIZE)
}

/**
 * Makes sure the map has the image of each of these arms, and returns the
 * ids of those it has. Where an image cannot be drawn the capital keeps the
 * plain disc underneath.
 */
export async function ensureCapitalIcons(
  map: MapLibreMap,
  all: readonly CapitalArms[],
): Promise<Set<string>> {
  const ready = new Set<string>()
  await Promise.all(
    all.map(async (arms) => {
      const id = capitalIconId(arms)
      if (map.hasImage(id)) {
        ready.add(id)
        return
      }
      const image = await draw(arms)
      // The map may have been removed, or the image added by another call, meanwhile.
      if (!image || !map.getStyle() || map.hasImage(id)) {
        if (image && map.getStyle()) ready.add(id)
        return
      }
      map.addImage(id, image, { pixelRatio: 2 })
      ready.add(id)
    }),
  )
  return ready
}
