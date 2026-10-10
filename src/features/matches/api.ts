import type { Geometry } from 'geojson'

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api'
import type { AreaMap, UnitPoint } from '@/features/map/api'

/** Planned: open to players, not started yet. Ongoing: being played. */
export type MatchStatus = 'PLANNED' | 'ONGOING' | 'FINISHED'
/** Alone against bots, or with people online. */
export type MatchMode = 'SINGLEPLAYER' | 'MULTIPLAYER'
/** Rush: turns of thirty seconds. Normal: as long as whoever created the match decided. */
export type MatchPace = 'RUSH' | 'NORMAL'
export type MatchVisibility = 'PUBLIC' | 'PRIVATE'

/** Every rule of a match: numbers, plus the switch for late registrations. */
export type MatchRules = Record<string, number | boolean>

export interface MatchSummary {
  id: string
  name: string
  status: MatchStatus
  mode: MatchMode
  pace: MatchPace
  visibility: MatchVisibility
  startAt: string
  maxDays: number | null
  maxPlayers: number
  turnHours: number
  currentTurn: number
  turnEndsAt: string | null
  finishedAt: string | null
  /** The winner, once the match is over. */
  winnerEmpireId: string | null
  /** Every winner: more than one when the match ended with empires exactly level. */
  winnerEmpireIds: string[]
  players: number
  owner: string
  areas: { id: string; name: string }[]
  config: MatchRules
  isOwner: boolean
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
  /** Played by the server, not by a person. */
  isBot: boolean
  capitalTerritoryId: string | null
  /** Municipalities controlled. */
  units: number
  fallenTurn: number | null
  /** The image the player uploaded in place of the emblem, if any. */
  logoUrl: string | null
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
  /** Alliances are public: everyone sees who is allied with whom. */
  alliances: Alliance[]
  /** Proposals waiting for an answer, made by the viewer or to them. */
  invites: { id: string; fromEmpireId: string; toEmpireId: string }[]
  /** Active structures: public, like what they do. */
  structures: Structure[]
  /** Open battles (public) and, for a player, their own battles just resolved. */
  battles: Battle[]
}

/** A pact between two empires: alliances do not form groups. */
export interface Alliance {
  id: string
  empireIds: string[]
  /** The turn at whose end the announced end takes effect; null while nobody announced it. */
  endsAtTurn: number | null
  /** Who announced the end: the only one who can take it back. */
  endedByEmpireId: string | null
}

export interface ChatMessage {
  id: string
  empireId: string
  text: string
  createdAt: string
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
  /** Turns before it can change territory again (0: now); null if it cannot move at all. */
  moveInTurns: number | null
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
  /** Blocks standing on the chosen territories: the merge cancels them. */
  blocksLost: number
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

/** One entry of the board: a typed event; the interface writes its text. */
export interface BoardEntry {
  id: string
  type: string
  turn: number
  createdAt: string
  empireId: string | null
  territoryId: string | null
  /** A municipality of the territory it is about, to centre the map on it. */
  geoUnitId: number | null
  data: Record<string, string>
}

/** A closed turn: what happened and who owned each municipality when it ended. */
export interface TurnHistory {
  turn: number
  closedAt: string
  events: BoardEntry[]
  /** Municipality id → empire id; free municipalities are absent. */
  ownership: Record<string, string>
}

/** A small map of a match: the real outline of its area and what each empire holds. */
export interface MatchPreview {
  /** `min-x min-y width height` of the SVG that draws the paths. */
  viewBox: string
  outline: string
  empires: { color: string; path: string }[]
}

export type BoardKind =
  'messages' | 'empires' | 'annexations' | 'battles' | 'capitals' | 'areas' | 'alliances' | 'match'

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
  /** Where the attack starts from: public, like its target. */
  fromTerritoryIds: string[]
  fromNames: string[]
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
  mode?: MatchMode
  pace?: MatchPace
  visibility?: MatchVisibility
  /** Null: the match starts as soon as its first player has chosen a capital. */
  startAt: string | null
  maxDays: number | null
  maxPlayers: number
  turnHours: number
  config: MatchRules
}

export interface EmpireIdentity {
  name: string
  color: string
  emblem: string
  motto: string | null
}

export type SizeFilter = '' | 'free' | 's' | 'm' | 'l'

/** A player the owner of a private match has asked in. */
export interface MatchGuest {
  id: string
  username: string
  createdAt: string
  /** True once they have founded their empire. */
  joined: boolean
}

/** An invitation the viewer got and has not answered yet. */
export interface Invitation {
  id: string
  createdAt: string
  match: MatchSummary
}

export const matchApi = {
  /** The players invited to a private match: for its owner. */
  guests: (id: string) => apiGet<MatchGuest[]>(`/matches/${id}/invitations`),
  inviteGuest: (id: string, username: string) =>
    apiPost<MatchGuest[]>(`/matches/${id}/invitations`, { username }),
  uninviteGuest: (id: string, invitationId: string) =>
    apiDelete<MatchGuest[]>(`/matches/${id}/invitations/${invitationId}`),
  /** The viewer's own invitations, and the way to turn one down. */
  invitations: () => apiGet<Invitation[]>('/invitations'),
  declineInvitation: (id: string) => apiDelete(`/invitations/${id}`),
  options: () => apiGet<MatchOptions>('/matches/options'),
  geoTree: () => apiGet<GeoTreeNode[]>('/geo/tree'),
  list: (filters: { name: string; size: SizeFilter; page: number; finished?: boolean }) => {
    const query = new URLSearchParams({ page: String(filters.page) })
    if (filters.finished) query.set('status', 'finished')
    if (filters.name.trim()) query.set('name', filters.name.trim())
    if (filters.size) query.set('size', filters.size)
    return apiGet<MatchList>(`/matches?${query.toString()}`)
  },
  mine: () => apiGet<MatchSummary[]>('/matches/mine'),
  create: (settings: MatchSettings) => apiPost<MatchSummary>('/matches', settings),
  update: (id: string, changes: Partial<MatchSettings>) =>
    apiPatch<MatchSummary>(`/matches/${id}`, changes),
  remove: (id: string) => apiDelete(`/matches/${id}`),
  state: (id: string) => apiGet<MatchState>(`/matches/${id}/state`),
  map: (id: string) => apiGet<AreaMap>(`/matches/${id}/map`),
  units: (id: string) => apiGet<UnitPoint[]>(`/matches/${id}/units`),
  join: (id: string, body: { geoUnitId: number; empire: EmpireIdentity }) =>
    apiPost<MatchState>(`/matches/${id}/join`, body),
  /** Puts an image (PNG, JPEG or WebP) in place of the emblem of the player's empire. */
  setLogo: (id: string, file: Blob) => apiPut<MatchState>(`/matches/${id}/empire/logo`, file),
  removeLogo: (id: string, empireId: string) =>
    apiDelete<MatchState>(`/matches/${id}/empires/${empireId}/logo`),
  preview: (id: string) => apiGet<MatchPreview>(`/matches/${id}/preview`),
  /** Leaves a match that has not started: the starting municipality is free again. */
  withdraw: (id: string) => apiDelete<MatchState>(`/matches/${id}/empire`),
  updateEmpire: (id: string, empire: EmpireIdentity) =>
    apiPatch<MatchState>(`/matches/${id}/empire`, empire),
  /** The territories the player can attack right now. */
  targets: (id: string) => apiGet<{ territoryIds: string[] }>(`/matches/${id}/targets`),
  unit: (id: string, geoUnitId: number) =>
    apiGet<UnitCardData>(`/matches/${id}/units/${geoUnitId}`),
  annex: (id: string, body: { geoUnitId: number; payFromTerritoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/annex`, body),
  allocate: (id: string, body: { amounts: Record<string, number>; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/allocate`, body),
  invite: (id: string, toEmpireId: string) =>
    apiPost<MatchState>(`/matches/${id}/alliances/invites`, { toEmpireId }),
  answerInvite: (id: string, inviteId: string, action: 'accept' | 'decline' | 'withdraw') =>
    apiPost<MatchState>(`/matches/${id}/alliances/invites/${inviteId}/${action}`),
  endAlliance: (id: string, allianceId: string) =>
    apiPost<MatchState>(`/matches/${id}/alliances/${allianceId}/end`),
  keepAlliance: (id: string, allianceId: string) =>
    apiPost<MatchState>(`/matches/${id}/alliances/${allianceId}/keep`),
  transfer: (
    id: string,
    body: { fromTerritoryId: string; toTerritoryId: string; amount: number; turn: number },
  ) => apiPost<MatchState>(`/matches/${id}/alliances/transfer`, body),
  chat: (id: string, allianceId: string) =>
    apiGet<ChatMessage[]>(`/matches/${id}/alliances/${allianceId}/chat`),
  say: (id: string, allianceId: string, text: string) =>
    apiPost<ChatMessage[]>(`/matches/${id}/alliances/${allianceId}/chat`, { text }),
  board: (id: string, filters: { kind?: BoardKind; empireId?: string }) => {
    const query = new URLSearchParams()
    if (filters.kind) query.set('kind', filters.kind)
    if (filters.empireId) query.set('empireId', filters.empireId)
    return apiGet<BoardEntry[]>(`/matches/${id}/board?${query.toString()}`)
  },
  history: (id: string) =>
    apiGet<{ turn: number; closedAt: string; events: number }[]>(`/matches/${id}/history`),
  turn: (id: string, turn: number) => apiGet<TurnHistory>(`/matches/${id}/history/${turn}`),
  postMessage: (id: string, text: string) =>
    apiPost<{ id: string }>(`/matches/${id}/board`, { text }),
  removeMessage: (id: string, eventId: string) => apiDelete(`/matches/${id}/board/${eventId}`),
  moveStructure: (id: string, structureId: string, body: { territoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/structures/${structureId}/move`, body),
  catalogue: (id: string) => apiGet<CatalogueEntry[]>(`/matches/${id}/structures/catalogue`),
  build: (id: string, body: { type: string; territoryId: string; turn: number }) =>
    apiPost<MatchState>(`/matches/${id}/structures`, body),
  areas: (id: string) => apiGet<AreaOutlines>(`/matches/${id}/areas`),
  /** The border fought over in each open battle, as lines for the map. */
  fronts: (id: string) => apiGet<AreaOutlines>(`/matches/${id}/fronts`),
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
