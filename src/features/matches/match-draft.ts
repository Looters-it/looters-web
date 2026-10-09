import type { MatchMode, MatchPace, MatchRules, MatchSettings, MatchVisibility } from './api'
import { toLocalInput } from './format'

/** The rules as the owner edits them: text while typing, so a field can be emptied. */
export interface MatchDraft {
  name: string
  areaId: string
  mode: MatchMode
  pace: MatchPace
  visibility: MatchVisibility
  /** True: no date, the match starts as soon as its first player has a capital. */
  startNow: boolean
  startAt: string // datetime-local
  /** Bots a single player faces from the first turn. */
  opponents: string
  maxDays: string
  maxPlayers: string
  turnHours: string
  inviteCode: string
  config: Record<string, string | boolean>
}

const tomorrowAtNine = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date
}

export function emptyDraft(rules: MatchRules): MatchDraft {
  return {
    name: '',
    areaId: '',
    mode: 'MULTIPLAYER',
    pace: 'NORMAL',
    visibility: 'PUBLIC',
    startNow: true,
    startAt: toLocalInput(tomorrowAtNine()),
    opponents: '3',
    maxDays: '',
    maxPlayers: '100',
    turnHours: '24',
    inviteCode: '',
    config: Object.fromEntries(
      Object.entries(rules).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? value : String(value),
      ]),
    ),
  }
}

export function draftFromMatch(match: MatchSettings): MatchDraft {
  return {
    name: match.name,
    areaId: match.areaIds[0] ?? '',
    mode: match.mode ?? 'MULTIPLAYER',
    pace: match.pace ?? 'NORMAL',
    visibility: match.visibility ?? 'PUBLIC',
    startNow: false,
    startAt: toLocalInput(new Date(match.startAt ?? Date.now())),
    opponents: String(match.config.botsAtStart ?? 3),
    maxDays: match.maxDays === null ? '' : String(match.maxDays),
    maxPlayers: String(match.maxPlayers),
    turnHours: String(match.turnHours),
    inviteCode: match.inviteCode ?? '',
    config: Object.fromEntries(
      Object.entries(match.config).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? value : String(value),
      ]),
    ),
  }
}

/** What the api expects; rule values equal to text are turned back into numbers. */
export function settingsFromDraft(draft: MatchDraft): MatchSettings {
  const single = draft.mode === 'SINGLEPLAYER'
  const config: MatchRules = Object.fromEntries(
    Object.entries(draft.config).map(([key, value]) => [
      key,
      typeof value === 'boolean' ? value : Number(value),
    ]),
  )
  // Alone, the opponents are bots: as many as chosen, there from the first turn.
  if (single) {
    const opponents = Math.max(1, Number(draft.opponents) || 1)
    Object.assign(config, { botsEnabled: true, botsAtStart: opponents, botsMax: opponents })
  }
  const code = draft.inviteCode.trim()
  return {
    name: draft.name.trim(),
    areaIds: draft.areaId ? [draft.areaId] : [],
    mode: draft.mode,
    pace: draft.pace,
    visibility: single ? 'PRIVATE' : draft.visibility,
    startAt: draft.startNow ? null : new Date(draft.startAt).toISOString(),
    maxDays: draft.maxDays.trim() === '' ? null : Number(draft.maxDays),
    maxPlayers: Number(draft.maxPlayers),
    turnHours: Number(draft.turnHours),
    // A private match without a code gets one made up by the server.
    inviteCode: !single && draft.visibility === 'PRIVATE' && code !== '' ? code : null,
    config,
  }
}
