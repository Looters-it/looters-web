/**
 * MapLibre needs concrete colour values, so the theme tokens are read from
 * the document at runtime: the map never has a colour of its own.
 */
export function themeColor(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`)
  // Outside a browser with the stylesheet loaded (tests) there is no value.
  return value.trim() || '#808080'
}

export interface MapColors {
  ground: string
  free: string
  border: string
  ink: string
  halo: string
  selected: string
  highlight: string
  attacked: string
}

export function mapColors(): MapColors {
  return {
    ground: themeColor('ground'),
    free: themeColor('free'),
    border: themeColor('dim'),
    ink: themeColor('ink'),
    halo: themeColor('ground'),
    selected: themeColor('deep-space-blue'),
    highlight: themeColor('watermelon'),
    attacked: themeColor('crushed-berry-600'),
  }
}

/**
 * Stand-in colours for empires, taken from the three palettes of the theme.
 * They are hard to tell apart beyond a dozen empires: a dedicated palette is
 * still to be designed (PROMPT §11, BACKLOG M0-11).
 */
export function empirePalette(): string[] {
  const shades = ['700', '500', '300', '800', '400', '600']
  const families = ['crushed-berry', 'hunter-green', 'khaki-beige']
  return shades.flatMap((shade) => families.map((family) => themeColor(`${family}-${shade}`)))
}
