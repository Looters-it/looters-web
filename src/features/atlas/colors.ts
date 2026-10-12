import type { AtlasArea } from './api'

/**
 * A colour of the palette for each area, so that two areas sharing a border never
 * have the same one while the palette lasts. The palette goes round its families of
 * hue (`families` of them, one after the other): an area takes, if it can, a colour
 * of a family none of its neighbours has, since two shades of one hue side by side
 * read as one area.
 */
export function areaColors(areas: readonly AtlasArea[], palette: readonly string[], families = 3) {
  const chosen = new Map<string, number>()
  if (palette.length === 0) return new Map<string, string>()
  areas.forEach((area, index) => {
    const taken = area.borders.flatMap((id) => chosen.get(id) ?? [])
    const hues = new Set(taken.map((pick) => pick % families))
    const order = palette.map((_, step) => (index + step) % palette.length)
    const pick =
      order.find((candidate) => !hues.has(candidate % families)) ??
      order.find((candidate) => !taken.includes(candidate)) ??
      order[0]!
    chosen.set(area.id, pick)
  })
  return new Map([...chosen].map(([id, pick]) => [id, palette[pick]!]))
}
