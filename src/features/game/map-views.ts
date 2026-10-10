import type { MatchState } from '@/features/matches/api'

/** How the map is coloured (PROMPT §2.8). */
export type MapView = 'political' | 'alliances' | 'resources'

/** How faint the colour of a territory with nothing on it is, beside the richest one. */
const FAINTEST = 0.4

/** A colour let through by as much as the share says: whole at 1, at its faintest at 0. */
function faded(color: string, share: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  if (!hex) return color
  const part = (from: number) => String(parseInt(hex.slice(from, from + 2), 16))
  const alpha = FAINTEST + (1 - FAINTEST) * Math.max(0, Math.min(1, share))
  return `rgba(${part(0)}, ${part(2)}, ${part(4)}, ${alpha.toFixed(2)})`
}

/**
 * The colour of each owned municipality in a view.
 *
 * - political: the colour of its empire, fainter the fewer resources the territory holds
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
      color = faded(color, richest > 0 ? territory.resources / richest : 1)
    }
    if (color) for (const unitId of territory.geoUnitIds) colors.set(unitId, color)
  }
  return colors
}
