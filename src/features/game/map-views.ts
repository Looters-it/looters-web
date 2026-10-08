import type { MatchState } from '@/features/matches/api'

/** How the map is coloured (PROMPT §2.8). */
export type MapView = 'political' | 'alliances' | 'resources'

/**
 * The colour of each owned municipality in a view.
 *
 * - political: the colour of its empire;
 * - alliances: one colour per alliance (that of its first member), the
 *   empires outside any alliance in a neutral tone;
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

  const allianceColor = new Map<string, string>()
  for (const alliance of state.alliances) {
    const color = empireColor.get(alliance.members[0]?.empireId ?? '') ?? tones.neutral
    for (const member of alliance.members) allianceColor.set(member.empireId, color)
  }
  const visible = state.territories.filter((territory) => territory.resources !== null)
  const most = Math.max(1, ...visible.map((territory) => territory.resources ?? 0))

  for (const territory of state.territories) {
    let color: string | undefined
    if (view === 'political') color = empireColor.get(territory.ownerEmpireId)
    else if (view === 'alliances')
      color = allianceColor.get(territory.ownerEmpireId) ?? tones.neutral
    else if (territory.resources === null) color = tones.neutral
    else {
      const step = Math.min(
        tones.scale.length - 1,
        Math.floor(((territory.resources ?? 0) / most) * tones.scale.length),
      )
      color = tones.scale[step]
    }
    if (color) for (const unitId of territory.geoUnitIds) colors.set(unitId, color)
  }
  return colors
}
