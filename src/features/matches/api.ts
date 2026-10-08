import type { Geometry } from 'geojson'

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api'
import type { AreaMap, UnitPoint } from '@/features/map/api'

export type MatchStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'FINISHED'

/** Every rule of a match: numbers, plus the switch for late registrations. */
export type MatchRules = Record<string, number | boolean>

export interface MatchSummary {
  id: string
  name: string
  status: MatchStatus
  startAt: string
  maxDays: number | null
  maxPlayers: number
  turnHours: number
  currentTurn: number
  turnEndsAt: string | null
  finishedAt: string | null
  /** The winner, once the match is over. */
  winnerEmpireId: string | null
  players: number
  hasInviteCode: boolean
  owner: string
  areas: { id: string; name: string }[]
  config: MatchRules
  isOwner: boolean
  /** Present only for the owner. */
  inviteCode?: string | null
}

export interface MatchList {
  page: number
  pageSize: number
  total: number
  matches: MatchSummary[]
}

export interface Empire {
  id: string
  name: string
  color: string
  emblem: string
  motto: string | null
  status: 'ACTIVE' | 'FALLEN'
  username: string
  capitalTerritoryId: string | null
  /** Municipalities controlled. */
  units: number
  fallenTurn: number | null
  /** Total resources: sent only when the match is over. */
  resources?: number
}

export interface Territory {
  id: string
  name: string
  ownerEmpireId: string
  geoUnitIds: number[]
  isArea: boolean
  protected: boolean
  /** Null when the viewer may not see them: hidden amounts never reach the browser. */
  resources: number | null
  /** Weight in the split of the income; null unless the territory is the viewer's. */
  weight: number | null
  /** The open battle it is the target or a source of, if any. */
  battleId: string | null
  /** Accumulation alert: an attack is probably being prepared here. */
  alert: boolean
}

export interface MatchState {
  match: MatchSummary
  me: {
    empireId: string
    /** Annexations still available this turn. */
    annexLeft: number
    /** What the empire earns when this turn ends. */
    turnValue: number
    allocationMode: 'EQUAL' | 'WEIGHTED'
    /** FALLEN: the player watches as a spectator. */
    status: 'ACTIVE' | 'FALLEN'
    /** Turns to wait before the capital can move again; 0 = now. */
    capitalMoveInTurns: number
  } | null
  empires: Empire[]
  /** Owned territories only; every other municipality is free. */
  territories: Territory[]
  /** Players of the match watching it now, out of those still in play. */
  online: { connected: number; total: number }
  /** Active structures: public, like what they do. */
  structures: Structure[]
  /** Open battles (public) and, for a player, their own battles just resolved. */
  battles: Battle[]
}

export interface Structure {
  id: string
  /** A key of the catalogue: BLOCK, SECOND_CAPITAL, and whatever is added later. */
  type: string
  territoryId: string
  empireId: string
  effects: string[]
  /** Turns it still lasts, counting the current one; null if permanent. */
  turnsLeft: number | null
}

/** One structure of the catalogue as the player can use it now. */
export interface CatalogueEntry {
  type: string
  cost: number
  durationTurns: number | null
  cooldownTurns: number
  effects: string[]
  sites: { territoryId: string; name: string; resources: number; blocked: string | null }[]
}

export interface MergePreview {
  perTerritory: number
  cost: number
  available: number
  maxUnits: number
  problem: string | null
}

export interface AreaOutlines {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    id: string
    geometry: Geometry
    properties: { name: string; ownerEmpireId: string | null; lon: number; lat: number }
  }[]
}

export type BattleOutcome = 'ATTACKER_WON' | 'DEFENDER_WON' | 'SURRENDER' | 'CANCELLED'

export interface Battle {
  id: string
  turn: number
  status: 'OPEN' | 'RESOLVED'
  outcome: BattleOutcome | null
  targetTerritoryId: string
  targetName: string
  attackerEmpireId: string
  defenderEmpireId: string
  role: 'attacker' | 'defender' | null
  // Each side receives its own numbers only.
  fromTerritoryIds?: string[]
  attackCost?: number
  attackForce?: number
  response?: 'DEFEND' | 'SURRENDER' | null
  /** Resources on the attacked territory when the attack was declared. */
  defenseForce?: number
  defenseCost?: number
}

export interface AttackPreview {
  pct: number
  totalCost: number
  force: number
  from: { territoryId: string; name: string; resources: number; cost: number }[]
}

/** The card of a municipality (api: GET /matches/:id/units/:geoUnitId). */
export interface UnitCardData {
  geoUnitId: number
  name: string
  territory: {
    id: string
    name: string
    ownerEmpireId: string | null
    protected: boolean
    inBattle: boolean
    resources: number | null
  }
  neighbours: {
    geoUnitId: number
    name: string
    territoryId: string
    ownerEmpireId: string | null
  }[]
  /** Present for a player looking at a free municipality of a running match. */
  annex: {
    cost: number
    left: number
    payFrom: { territoryId: string; name: string; resources: number; usable: boolean }[]
  } | null
  /** Present for a player looking at a territory of another empire in a running match. */
  attack: {
    blocked: 'PROTECTED' | 'BLOCKED' | 'IN_BATTLE' | 'NOT_ADJACENT' | null
    from: { territoryId: string; name: string; resources: number; usable: boolean }[]
  } | null
}

export interface MatchOptions {
  rules: MatchRules
  maxPlayersLimit: number
  colors: string[]
  emblems: string[]
}

export interface GeoTreeNode {
  id: string
  name: string
  parentId: string | null
  unitCount: number
}

export interface MatchSettings {
  name: string
  areaIds: string[]
  startAt: string
  maxDays: number | null
  maxPlayers: number
  turnHours: number
  inviteCode: string | null
  config: MatchRules
}

export interface EmpireIdentity {
  name: string
  color: string
  emblem: string
  motto: string | null
}

export type SizeFilter = '' | 'free' | 's' | 'm' | 'l'

export const matchApi = {
  options: () => apiGet<MatchOptions>('/matches/options'),
  geoTree: () => apiGet<GeoTreeNode[]>('/geo/tree'),
  list: (filters: { name: string; size: SizeFilter; page: number }) => {
    const query = new URLSearchParams({ page: String(filters.page) })
    if (filters.name.trim()) query.set('name', filters.name.trim())
    if (filters.size) query.set('size', filters.size)
    return apiGet<MatchList>(`/matches?${query.toString()}`)
  },
  mine: () => apiGet<MatchSummary[]>('/matches/mine'),
  create: (settings: MatchSettings) => apiPost<MatchSummary>('/matches', settings),
  update: (id: string, changes: Partial<MatchSettings>) =>
    apiPatch<MatchSummary>(`/matches/${id}`, changes),
  open: (id: string) => apiPost<MatchSummary>(`/matches/${id}/open`),
  remove: (id: string) => apiDelete(`/matches/${id}`),
  state: (id: string) => apiGet<MatchState>(`/matches/${id}/state`),
  map: (id: string) => apiGet<AreaMap>(`/matches/${id}/map`),
  units: (id: string) => apiGet<UnitPoint[]>(`/matches/${id}/units`),
  join: (id: string, body: { geoUnitId: number; empire: EmpireIdentity; inviteCode?: string }) =>
    apiPost<MatchState>(`/matches/${id}/join`, body),
  updateEmpire: (id: string, empire: EmpireIdentity) =>
    apiPatch<MatchState>(`/matches/${id}/empire`, empire),
  unit: (id: string, geoUnitId: number) =>
    apiGet<UnitCardData>(`/matches/${id}/units/${geoUnitId}`),
  annex: (id: string, body: { geoUnitId: number; payFromTerritoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/annex`, body),
  allocate: (id: string, body: { amounts: Record<string, number>; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/allocate`, body),
  catalogue: (id: string) => apiGet<CatalogueEntry[]>(`/matches/${id}/structures/catalogue`),
  build: (id: string, body: { type: string; territoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/structures`, body),
  areas: (id: string) => apiGet<AreaOutlines>(`/matches/${id}/areas`),
  previewMerge: (id: string, territoryIds: string[]) =>
    apiPost<MergePreview>(`/matches/${id}/merge/preview`, { territoryIds }),
  merge: (id: string, body: { territoryIds: string[]; name: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/merge`, body),
  renameArea: (id: string, territoryId: string, name: string) =>
    apiPatch<MatchState>(`/matches/${id}/territories/${territoryId}`, { name }),
  moveCapital: (id: string, body: { territoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/capital`, body),
  previewAttack: (id: string, body: { targetGeoUnitId: number; fromTerritoryIds: string[] }) =>
    apiPost<AttackPreview>(`/matches/${id}/attacks/preview`, body),
  attack: (
    id: string,
    body: { targetGeoUnitId: number; fromTerritoryIds: string[]; turn: number },
  ) => apiPost<MatchState>(`/matches/${id}/attacks`, body),
  respond: (id: string, battleId: string, action: 'DEFEND' | 'SURRENDER') =>
    apiPost<MatchState>(`/matches/${id}/battles/${battleId}/respond`, { action }),
  setAllocationRule: (
    id: string,
    body: { mode: 'EQUAL' | 'WEIGHTED'; weights?: Record<string, number> },
  ) => apiPut<MatchState>(`/matches/${id}/allocation-rule`, body),
}
