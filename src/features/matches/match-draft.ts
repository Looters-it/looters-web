import type { MatchRules, MatchSettings } from './api'
import { toLocalInput } from './format'

/** The rules as the owner edits them: text while typing, so a field can be emptied. */
export interface MatchDraft {
  name: string
  areaId: string
  startAt: string // datetime-local
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
    startAt: toLocalInput(tomorrowAtNine()),
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
    startAt: toLocalInput(new Date(match.startAt)),
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
  return {
    name: draft.name.trim(),
    areaIds: draft.areaId ? [draft.areaId] : [],
    startAt: new Date(draft.startAt).toISOString(),
    maxDays: draft.maxDays.trim() === '' ? null : Number(draft.maxDays),
    maxPlayers: Number(draft.maxPlayers),
    turnHours: Number(draft.turnHours),
    inviteCode: draft.inviteCode.trim() === '' ? null : draft.inviteCode.trim(),
    config: Object.fromEntries(
      Object.entries(draft.config).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? value : Number(value),
      ]),
    ),
  }
}
