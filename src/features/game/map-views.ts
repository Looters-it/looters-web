import type { MatchState } from '@/features/matches/api'

/** How the map is coloured (PROMPT §2.8). */
export type MapView = 'political' | 'alliances' | 'resources'

/** How much lighter the colour of a territory with nothing on it is than its empire's. */
const LIGHTEST = 0.6

/**
 * A shade of the colour of an empire: the colour itself at a share of 1, lighter and
 * lighter towards 0. Always solid: a shade is read at a glance, a see-through is not.
 */
function shaded(color: string, share: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  if (!hex) return color
  const lighter = LIGHTEST * (1 - Math.max(0, Math.min(1, share)))
  const part = (from: number) => {
    const value = parseInt(hex.slice(from, from + 2), 16)
    return Math.round(value + (255 - value) * lighter)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${part(0)}${part(2)}${part(4)}`
}

/**
 * The colour of each owned municipality in a view.
 *
 * - political: the colour of its empire, in a lighter shade the fewer resources the territory holds
 *   beside the richest of that empire, where the viewer may know them (their own
 *   territories and their allies'): what is thinly held shows at a glance;
 * - alliances: alliances are pacts between two empires, not groups, so there
 *   is no colour of an alliance. A player sees their own empire and their
 *   allies in their colours and everyone else neutral; who has no empire
 *   sees in colour the empires that have at least one ally;
 * - resources: a tone as deep as the resources on the territory, only where
 *   the viewer may see them (their own territories and their allies').
 */
export function colorsFor(
  state: MatchState,
  view: MapView,
  tones: { neutral: string; scale: string[] },
): Map<number, string> {
  const colors = new Map<number, string>()
  const empireColor = new Map(state.empires.map((empire) => [empire.id, empire.color]))

  const mineId = state.me?.empireId
  const shown = new Set<string>(mineId ? [mineId] : [])
  for (const pact of state.alliances) {
    if (!mineId || pact.empireIds.includes(mineId)) for (const id of pact.empireIds) shown.add(id)
  }
  const visible = state.territories.filter((territory) => territory.resources !== null)
  const most = Math.max(1, ...visible.map((territory) => territory.resources ?? 0))

  // The richest territory of each empire whose resources the viewer may see.
  const mostOf = new Map<string, number>()
  for (const territory of visible) {
    const owner = territory.ownerEmpireId ?? ''
    mostOf.set(owner, Math.max(mostOf.get(owner) ?? 0, territory.resources ?? 0))
  }

  for (const territory of state.territories) {
    let color: string | undefined
    if (view === 'political') color = empireColor.get(territory.ownerEmpireId)
    else if (view === 'alliances')
      color = shown.has(territory.ownerEmpireId)
        ? (empireColor.get(territory.ownerEmpireId) ?? tones.neutral)
        : tones.neutral
    else if (territory.resources === null) color = tones.neutral
    else {
      const step = Math.min(
        tones.scale.length - 1,
        Math.floor(((territory.resources ?? 0) / most) * tones.scale.length),
      )
      color = tones.scale[step]
    }
    if (color && view !== 'resources' && territory.resources !== null) {
      const richest = mostOf.get(territory.ownerEmpireId ?? '') ?? 0
      color = shaded(color, richest > 0 ? territory.resources / richest : 1)
    }
    if (color) for (const unitId of territory.geoUnitIds) colors.set(unitId, color)
  }
  return colors
}
