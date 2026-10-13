import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { NotFoundPage } from '@/app/NotFoundPage'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Combine,
  Hammer,
  Map as MapIcon,
  Handshake,
  ScrollText,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
  Pause,
  Play,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AttackBar } from '@/features/game/AttackBar'
import { AttackPanel } from '@/features/game/AttackPanel'
import { EndAnnouncement } from '@/features/game/EndAnnouncement'
import { BattleAlert } from '@/features/game/BattleAlert'
import { BattleAnnouncer } from '@/features/game/BattleAnnouncer'
import { AttackToasts } from '@/features/game/AttackToasts'
import { SiegeToasts } from '@/features/game/SiegeToasts'
import { unlockSoundOnFirstGesture } from '@/features/game/tick'
import { TurnAnnouncer } from '@/features/game/TurnAnnouncer'
import { Board } from '@/features/game/Board'
import { BoardToasts } from '@/features/game/BoardToasts'
import { MatchHud } from '@/features/game/MatchHud'
import { AlliancePage } from '@/features/game/AlliancePage'
import { BuildPage } from '@/features/game/BuildPage'
import { historyQuery, turnQuery } from '@/features/game/history'
import { usePhase } from '@/features/game/phase'
import { useFocusBags } from '@/features/game/useFocusBags'
import { useFocusKeeper } from '@/features/game/useFocusKeeper'
import { HistoryPage } from '@/features/game/HistoryPage'
import { colorsFor, type MapView } from '@/features/game/map-views'
import { empireTags } from '@/features/game/tags'
import { StatusBadge, unitStatus } from '@/features/game/StatusBadge'
import { UnitSearch } from '@/features/game/UnitSearch'
import { Leaderboard } from '@/features/game/Leaderboard'
import { MergePage } from '@/features/game/MergePage'
import { ResourcesPage } from '@/features/game/ResourcesPage'
import { UnitPanel } from '@/features/game/UnitPanel'
import { useMatchLive } from '@/features/game/useMatchLive'
import type {
  EmpireLabel,
  MapArc,
  MapMarker,
  MapProbe,
  MapRange,
  MapUnit,
  OwnerTag,
} from '@/features/map/GameMap'
import { LazyGameMap } from '@/features/map/LazyGameMap'
import { UnitCard } from '@/features/map/UnitCard'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

import { matchApi, type MatchState, type UnitCardData } from './api'
import { EmpireShield } from './Emblem'
import { useMatchFormat, useNow } from './format'
import { JoinPanel } from './JoinPanel'
import { MyEmpire } from './MyEmpire'
import { InvitePanel } from './InvitePanel'
import { OwnerPanel } from './OwnerPanel'

/**
 * What the card over the map shows: the match itself, the way into it for who is
 * not in yet, or the municipality that was picked and the attack prepared on it.
 * Everything else opens in a dialog.
 */
/** How long what a territory earned stays written on the map. */
const GAIN_SHOWN_MS = 4000
/** How long the green sign stays on a territory that was just conquered. */
const CAPTURED_SHOWN_MS = 3500

type View = 'info' | 'match' | 'unit' | 'attack'

/** What opens in a dialog over the page. */
type Sheet = 'empire' | 'leaderboard' | 'history' | 'merge' | 'build' | 'alliance'

/** The pages of the empire, each behind its round button on the map. */
const EMPIRE_SHEETS = [
  ['resources', Coins],
  ['merge', Combine],
  ['build', Hammer],
  ['alliance', Handshake],
] as const

/** What is done only in the preliminary part of a turn. */
const PRELIMINARY_SHEETS: readonly string[] = ['resources', 'merge', 'build']

const NOTHING: never[] = []
const MAP_VIEWS: MapView[] = ['political', 'alliances', 'resources']
/** Map paint needs literal colours: the neutral tone and the scale of the resources view. */
const MAP_TONES = {
  neutral: '#24506d',
  // From barely there to bright: on a dark map, more is lighter.
  scale: ['#1d4f6e', '#2c6388', '#3f78a3', '#5b8dbb', '#7aa2cf', '#99b2dd', '#bccdea', '#e3ebf7'],
}

function MatchInfo({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  const { match } = state
  const now = useNow()
  const overdue = match.status === 'PLANNED' && new Date(match.startAt).getTime() < now
  const winners = state.empires.filter((empire) => match.winnerEmpireIds.includes(empire.id))
  const iWon = winners.some((empire) => empire.id === state.me?.empireId)

  return (
    <section className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl leading-tight">{match.name}</h1>
        <span className="rounded-pill border px-2 text-base">
          {t(`match.status.${match.status}`)}
        </span>
      </div>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <MapIcon aria-hidden="true" className="size-5 flex-none" />
          <span className="sr-only">{t('match.info.area')}</span>
          {match.areas.map((area) => area.name).join(', ')}
        </span>
        <Link
          to={`/user/${encodeURIComponent(match.owner)}`}
          className="hover:text-foreground flex items-center gap-1.5 underline underline-offset-4"
        >
          <User aria-hidden="true" className="size-5 flex-none" />
          <span className="sr-only">{t('match.info.ownerLabel')}</span>
          {match.owner}
        </Link>
      </p>
      {match.status === 'PLANNED' && (
        <p className="text-base">
          {t('match.info.starts', {
            date: format.dateTime(match.startAt),
            when: format.fromNow(match.startAt, now),
          })}
        </p>
      )}
      {overdue && (
        <p role="status" className="text-danger">
          {t('match.info.lateStart', { min: Number(match.config.minPlayersToStart ?? 2) })}
        </p>
      )}
      {match.status === 'FINISHED' && (
        <p role="status" className="text-lg font-bold">
          {t('game.end.finished')}{' '}
          {winners.length === 0
            ? t('game.end.noWinner')
            : winners.length > 1
              ? t(iWon ? 'game.end.youTied' : 'game.end.tie', {
                  names: winners.map((empire) => empire.name).join(', '),
                })
              : iWon
                ? t('game.end.youWon')
                : t('game.end.winner', { name: winners[0]?.name ?? '' })}
        </p>
      )}
      {/* Said in full by a dialog when it happens: here it stays as a reminder. */}
      {match.status !== 'FINISHED' && state.me?.status === 'FALLEN' && (
        <p role="status" className="text-muted-foreground">
          {t('game.end.spectatorShort')}
        </p>
      )}
    </section>
  )
}

/** How long a turn lasts, when the match ends and who is here now: the foot of the card. */
function MatchTimes({ match, online }: { match: MatchState['match']; online: string | null }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  // The last day: as many days after the start as the match may last.
  const end = match.maxDays
    ? new Date(new Date(match.startAt).getTime() + match.maxDays * 86_400_000).toISOString()
    : null
  // In the unit that says it in a whole number: 30 seconds, not a fraction of an hour.
  const [turn, unit] =
    match.turnHours * 60 < 1
      ? ([Math.round(match.turnHours * 3600), 'turnSeconds'] as const)
      : match.turnHours < 1
        ? ([Math.round(match.turnHours * 60), 'turnMinutes'] as const)
        : ([match.turnHours, 'turnHours'] as const)
  const turnText = t(`match.info.${unit}`, { count: turn })
  return (
    <div className="text-muted-foreground mt-auto flex items-center gap-4 text-base">
      {/* A clock with the length of a turn at its corner; said in full to who cannot see it. */}
      <span className="relative flex-none pt-2 pr-7" title={turnText}>
        <Clock aria-hidden="true" className="size-7" />
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground rounded-pill absolute top-0 right-0 flex h-5 min-w-5 items-center justify-center px-1 font-mono text-xs leading-none font-bold"
        >
          {turn}
          {t(`match.info.unit.${unit}`)}
        </span>
        <span className="sr-only">{turnText}</span>
      </span>
      <ul>
        {online && <li>{online}</li>}
        <li>{end ? t('match.info.endsOn', { date: format.date(end) }) : t('match.info.noEnd')}</li>
      </ul>
    </div>
  )
}

/** A round button that floats over the map and opens one of the dialogs. */
function MapFab(props: {
  label: string
  onClick: () => void
  children: ReactNode
  /** Not for this part of the turn: still there, and it says why when opened. */
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={cn(
        'bg-background hover:bg-accent flex size-10 cursor-pointer items-center justify-center rounded-full shadow-md transition-colors md:size-12 [&_svg]:size-5 md:[&_svg]:size-6',
        props.dimmed && '[&_svg]:opacity-40',
      )}
    >
      {props.children}
    </button>
  )
}

/** The page of a match: the map on the whole screen, and over it a card and the controls. */
const NO_RANGES: MapRange[] = []
const NO_ARCS: MapArc[] = []

export function MatchPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { state: stateQuery, connected } = useMatchLive(id)
  const state = stateQuery.data

  const [selected, setSelected] = useState<MapUnit | null>(null)
  const [chosenView, setView] = useState<View | null>(null)
  const [hoveredEmpire, setHoveredEmpire] = useState<string | null>(null)
  const [mapView, setMapView] = useState<MapView>('political')
  // The closed turn shown on the map instead of the present, while the history is reviewed.
  const [review, setReview] = useState<number | null>(null)
  const [card, setCard] = useState<UnitCardData | null>(null)
  const [focus, setFocus] = useState<{ lon: number; lat: number } | null>(null)
  const [phoneTab, setPhoneTab] = useState<'map' | 'panel' | 'board'>('map')
  // The attack being prepared: its target and the own territories chosen so far.
  const [attack, setAttack] = useState<{ card: UnitCardData; from: string[] } | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  // The port or airport whose range is drawn: the one whose sign was tapped.
  const [rangeOf, setRangeOf] = useState<string | null>(null)
  // The own territory tapped for an attack it cannot join, and why: said in the bar.
  // The signs pressed whose order the server has not answered yet: shown as waiting.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [refused, setRefused] = useState<{ name: string; why: 'far' | 'unusable' } | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  // The structures open beside the map too: they are dragged from there onto it.
  const [buildOpen, setBuildOpen] = useState(false)
  const probe = useRef<MapProbe | null>(null)
  // While a structure is dragged: the territories it can be dropped on.
  const [dropSites, setDropSites] = useState<readonly string[] | null>(null)
  const navigate = useNavigate()
  const [abandoning, setAbandoning] = useState(false)
  const queryClient = useQueryClient()
  const pause = useMutation({
    mutationFn: (paused: boolean) => (paused ? matchApi.pause(id) : matchApi.resume(id)),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', id], next),
  })
  const abandon = useMutation({
    mutationFn: () => matchApi.abandon(id),
    onSuccess: () => {
      // The player chose it: the fall needs no telling, and there is nothing left to do here.
      setFallenSeen(true)
      try {
        localStorage.setItem(`fallen-seen:${id}`, 'yes')
      } catch {
        // Told at the next visit, that is all.
      }
      void navigate('/matches')
    },
  })
  // The sounds of the match, on unless the player turned them off on this device.
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('match.sound') !== 'off'
    } catch {
      return true
    }
  })
  useEffect(() => unlockSoundOnFirstGesture(), [])
  // The attack on a capital that already opened its dialog by itself: once is enough.
  const [urgentShown, setUrgentShown] = useState<string | null>(null)
  // Whether the player has already been told, on this device, that their empire fell.
  const [fallenSeen, setFallenSeen] = useState(() => {
    try {
      return localStorage.getItem(`fallen-seen:${id}`) === 'yes'
    } catch {
      return false
    }
  })
  // Territories being chosen for a merge.
  const [merging, setMerging] = useState<string[]>([])

  const hasMap = state !== undefined
  const area = useQuery({
    queryKey: ['matches', 'map', id],
    queryFn: () => matchApi.map(id),
    enabled: hasMap,
    staleTime: Infinity,
  })
  const units = useQuery({
    queryKey: ['matches', 'units', id],
    queryFn: () => matchApi.units(id),
    enabled: hasMap,
    staleTime: Infinity,
  })

  const hasAreas = state?.territories.some((territory) => territory.isArea) ?? false
  // The fronts are read again whenever a battle opens or closes.
  const openBattles = (state?.battles ?? [])
    .filter((battle) => battle.status === 'OPEN')
    .map((battle) => battle.id)
    .sort()
    .join()
  const fronts = useQuery({
    queryKey: ['matches', 'fronts', id, openBattles],
    queryFn: () => matchApi.fronts(id),
    enabled: openBattles !== '',
  })
  const areas = useQuery({
    // Read again when the areas change: a merge, a rename, a conquest.
    queryKey: [
      'matches',
      'areas',
      id,
      state?.territories
        .filter((territory) => territory.isArea)
        .map((territory) => `${territory.id}:${territory.name}:${territory.geoUnitIds.length}`)
        .join('|'),
    ],
    queryFn: () => matchApi.areas(id),
    enabled: hasMap && hasAreas,
    placeholderData: (previous) => previous,
  })

  const closedTurns = useQuery({ ...historyQuery(id), enabled: review !== null })
  const past = useQuery({ ...turnQuery(id, review ?? 0), enabled: review !== null }).data
  const reviewing = review !== null && past?.turn === review ? past : null
  const reviewTurns = closedTurns.data?.map((entry) => entry.turn) ?? []
  const pastColors = useMemo(() => {
    const colorOf = new Map(state?.empires.map((empire) => [empire.id, empire.color]))
    const colors = new Map<number, string>()
    for (const [unitId, empireId] of Object.entries(reviewing?.ownership ?? {})) {
      const color = colorOf.get(empireId)
      if (color) colors.set(Number(unitId), color)
    }
    return colors
  }, [reviewing, state?.empires])

  // Who owns each municipality, for the map and for the box of the selected one.
  const ownership = useMemo(() => {
    const empires = new Map(state?.empires.map((empire) => [empire.id, empire]))
    const byUnit = new Map<number, MatchState['territories'][number]>()
    for (const territory of state?.territories ?? []) {
      for (const unitId of territory.geoUnitIds) byUnit.set(unitId, territory)
    }
    const colors = state ? colorsFor(state, mapView, MAP_TONES) : new Map<number, string>()
    return { empires, byUnit, colors }
  }, [state, mapView])

  // The tag of the owner on each municipality: ownership readable without colours.
  const tags = useMemo(() => empireTags(state?.empires ?? []), [state?.empires])
  const [showTags, setShowTags] = useState(() => {
    try {
      return localStorage.getItem('map.tags') !== 'off'
    } catch {
      return true
    }
  })
  const ownerTags = useMemo<OwnerTag[]>(() => {
    if (!showTags) return []
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    const owners: Record<string, string> =
      reviewing?.ownership ??
      Object.fromEntries(
        (state?.territories ?? []).flatMap((territory) =>
          territory.geoUnitIds.map((unitId) => [String(unitId), territory.ownerEmpireId]),
        ),
      )
    return Object.entries(owners).flatMap(([unitId, empireId]) => {
      const point = points.get(Number(unitId))
      const tag = tags.get(empireId)
      return point && tag ? [{ id: point.id, lon: point.lon, lat: point.lat, tag }] : []
    })
  }, [reviewing, showTags, state?.territories, tags, units.data])

  // Each empire is named at its capital.
  const labels = useMemo<EmpireLabel[]>(() => {
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    return (state?.empires ?? []).flatMap((empire) => {
      const capital = state?.territories.find((t) => t.id === empire.capitalTerritoryId)
      const point = capital && points.get(capital.geoUnitIds[0] ?? -1)
      return point
        ? [{ id: empire.id, name: empire.name, lon: point.lon, lat: point.lat, size: empire.units }]
        : []
    })
  }, [state, units.data])

  // Capitals (always visible to everyone) and accumulation alerts, drawn on the map.
  // What the player could attack now changes with who owns what, what is protected and
  // what is in a battle: asked again whenever any of that moves.
  const border = (state?.territories ?? [])
    .map(
      (territory) =>
        `${territory.id}${territory.ownerEmpireId}${territory.protected ? 'p' : ''}${territory.battleId ?? ''}${(territory.resources ?? 0) > 0 ? '+' : ''}`,
    )
    .join()
  const canAct = state?.match.status === 'ONGOING' && state.me?.status === 'ACTIVE'
  const phase = usePhase(
    state?.match ?? { status: 'PLANNED', preliminaryEndsAt: null, pausedAt: null },
  )
  useFocusKeeper(state, phase)
  // The border of the player's empire: asked again whenever what it holds changes.
  const holdings = (state?.territories ?? [])
    .filter((territory) => territory.ownerEmpireId === state?.me?.empireId)
    .map((territory) => `${territory.id}:${String(territory.geoUnitIds.length)}`)
    .join()
  const outline = useQuery({
    queryKey: ['matches', 'outline', id, holdings],
    queryFn: () => matchApi.outline(id),
    enabled: holdings !== '',
    placeholderData: keepPreviousData,
  })
  const focusBags = useFocusBags(state, phase)
  const targets = useQuery({
    // Nothing can be attacked in the preliminary part of a turn: asked again when it ends.
    queryKey: ['matches', 'targets', id, state?.match.currentTurn, phase, border],
    queryFn: () => matchApi.targets(id),
    enabled: canAct,
    placeholderData: keepPreviousData,
  })
  // Only in the part of the turn they can be pressed in: what the last one left is not shown.
  const acting = canAct && phase === 'ACTION'
  const targetIds = acting ? targets.data?.territoryIds : undefined
  const annexIds = acting ? targets.data?.annexUnitIds : undefined

  // What each of the player's territories earned when a turn began, shown on the map
  // for a moment: the difference with what it held when the turn before ended.
  const [seenState, setSeenState] = useState(state)
  const [gains, setGains] = useState<ReadonlyMap<string, number>>(new Map())
  // Territories just conquered: the sign of the battle stays on them for a moment, green.
  const [captured, setCaptured] = useState<ReadonlyMap<string, number | null>>(new Map())
  // Territories an attack has just failed on: a shield that held, for a moment; for who
  // attacked, with what the attempt cost.
  const [repelled, setRepelled] = useState<ReadonlyMap<string, number | null>>(new Map())
  if (state !== seenState) {
    setSeenState(state)
    let conquered: ReadonlySet<string> = new Set()
    if (state && seenState) {
      const open = new Set(seenState.battles.filter((b) => b.status === 'OPEN').map((b) => b.id))
      const taken = state.battles
        .filter(
          (b) =>
            open.has(b.id) &&
            b.status === 'RESOLVED' &&
            (b.outcome === 'ATTACKER_WON' || b.outcome === 'SURRENDER'),
        )
        .map((b): [string, number | null] => {
          // For who took it: what was on the territory, and what winning the battle paid.
          const found = state.territories.find((t) => t.id === b.targetTerritoryId)?.resources
          return [
            b.targetTerritoryId,
            b.role === 'attacker' ? (found ?? 0) + (b.spoils ?? 0) : null,
          ]
        })
      if (taken.length > 0) setCaptured(new Map(taken))
      const held = state.battles
        .filter((b) => open.has(b.id) && b.status === 'RESOLVED' && b.outcome === 'DEFENDER_WON')
        .map((b): [string, number | null] => [
          b.targetTerritoryId,
          b.role === 'attacker' ? (b.attackCost ?? null) : null,
        ])
      if (held.length > 0) setRepelled(new Map(held))
      conquered = new Set(taken.map(([id]) => id))
    }
    if (state && seenState && state.match.currentTurn > seenState.match.currentTurn) {
      const before = new Map(seenState.territories.map((t) => [t.id, t.resources]))
      const earned = new Map<string, number>()
      for (const territory of state.territories) {
        const had = before.get(territory.id)
        if (territory.ownerEmpireId !== state.me?.empireId) continue
        if (territory.resources === null || had === null || had === undefined) continue
        if (territory.resources > had) earned.set(territory.id, territory.resources - had)
      }
      setGains(earned)
    } else if (state?.me && seenState) {
      // Within a turn: what the empire has as a whole changed (an attack or an
      // annexation paid for, something built, a battle that paid). Each territory shows
      // what it spent or took. Resources only moved among the territories leave the
      // whole as it was, and say nothing.
      const mineId = state.me.empireId
      const before = new Map(
        seenState.territories
          .filter((t) => t.ownerEmpireId === mineId)
          .map((t) => [t.id, t.resources ?? 0]),
      )
      const now = state.territories.filter((t) => t.ownerEmpireId === mineId)
      const had = [...before.values()].reduce((sum, amount) => sum + amount, 0)
      const has = now.reduce((sum, t) => sum + (t.resources ?? 0), 0)
      if (had !== has) {
        const moved = new Map<string, number>()
        for (const territory of now) {
          // A conquest says what it took on its own sign.
          if (conquered.has(territory.id)) continue
          const change = (territory.resources ?? 0) - (before.get(territory.id) ?? 0)
          if (change !== 0) moved.set(territory.id, change)
        }
        if (moved.size > 0) setGains(moved)
      }
    }
  }
  useEffect(() => {
    if (captured.size === 0) return
    const timer = setTimeout(() => setCaptured(new Map()), CAPTURED_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [captured])
  useEffect(() => {
    if (repelled.size === 0) return
    const timer = setTimeout(() => setRepelled(new Map()), CAPTURED_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [repelled])
  useEffect(() => {
    if (gains.size === 0) return
    const timer = setTimeout(() => setGains(new Map()), GAIN_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [gains])

  // How far a port or an airport reaches, drawn when it is asked for: its sign was tapped,
  // or the municipality it stands on is selected, whoever holds it. While an attack is
  // prepared the player's own are all drawn, to see what can start from where. A circle
  // around every municipality of the territory, as wide as the level of the structure.
  const selectedId = selected?.id
  const preparing = attack !== null
  // An attack is prepared within the action of one turn: when that ends, so does it,
  // or its bar would stay over a map that no longer lets it be declared.
  const moment = `${String(state?.match.currentTurn)}:${String(phase)}`
  const [attackMoment, setAttackMoment] = useState(moment)
  if (attackMoment !== moment) {
    setAttackMoment(moment)
    if (attack) {
      setAttack(null)
      if (chosenView === 'attack') setView('unit')
    }
  }
  const ranges = useMemo<(MapRange & { tapped: boolean })[]>(() => {
    if (!state) return []
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    return state.structures.flatMap((structure) => {
      const km = structure.rangeKm ?? 0
      const territory = state.territories.find((t) => t.id === structure.territoryId)
      const tapped = structure.id === rangeOf
      const shown =
        tapped ||
        (preparing && structure.empireId === state.me?.empireId) ||
        (selectedId !== undefined && territory?.geoUnitIds.includes(selectedId))
      if (!territory || !shown || km <= 0) return []
      const kind = structure.effects.includes('AIR_REACH') ? ('air' as const) : ('sea' as const)
      return territory.geoUnitIds.flatMap((unitId) => {
        const point = points.get(unitId)
        return point ? [{ lon: point.lon, lat: point.lat, km, kind, tapped }] : []
      })
    })
  }, [preparing, rangeOf, selectedId, state, units.data])

  // The range of the sign that was tapped: the map moves back until it is all in sight.
  const frame = useMemo(() => ranges.filter((range) => range.tapped), [ranges])

  // Who attacks what: from every territory an open attack starts from, a curve to its
  // target, in the colour of the attacker. It stays as long as the battle does, so a
  // siege that goes on for turns always shows whose it is.
  const arcs = useMemo<MapArc[]>(() => {
    if (!state) return []
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    const pointOf = (territoryId: string) =>
      points.get(state.territories.find((t) => t.id === territoryId)?.geoUnitIds[0] ?? -1)
    // The attack being prepared: a curve from every territory chosen so far.
    const target = attack ? points.get(attack.card.geoUnitId) : undefined
    const own = state.empires.find((empire) => empire.id === state.me?.empireId)?.color
    const prepared =
      attack && target && own
        ? attack.from.flatMap((sourceId): MapArc[] => {
            const from = pointOf(sourceId)
            return from
              ? [{ from: [from.lon, from.lat], to: [target.lon, target.lat], color: own }]
              : []
          })
        : []
    const open = state.battles
      .filter((battle) => battle.status === 'OPEN')
      .flatMap((battle) => {
        const to = pointOf(battle.targetTerritoryId)
        const color = state.empires.find((e) => e.id === battle.attackerEmpireId)?.color
        if (!to || !color) return []
        return battle.fromTerritoryIds.flatMap((sourceId): MapArc[] => {
          const from = pointOf(sourceId)
          return from ? [{ from: [from.lon, from.lat], to: [to.lon, to.lat], color }] : []
        })
      })
    return [...open, ...prepared]
  }, [attack, state, units.data])

  const markers = useMemo<MapMarker[]>(() => {
    const attackable = new Set(targetIds)
    const points = new Map(units.data?.map((unit) => [unit.id, unit]))
    const empireOf = new Map(state?.empires.map((empire) => [empire.capitalTerritoryId, empire]))
    // Free municipalities that can be annexed now: a flag to press, to annex at once.
    // Not while an attack is prepared: the map is then for choosing where it starts from,
    // and a tap on an own municipality must not land on a flag or on other swords.
    const flags = (preparing ? [] : (annexIds ?? [])).flatMap((unitId): MapMarker[] => {
      const point = points.get(unitId)
      const flag = `annex:${String(unitId)}`
      return point
        ? [{ id: flag, kind: 'annex', lon: point.lon, lat: point.lat, busy: busy.has(flag) }]
        : []
    })
    const signs = (state?.territories ?? []).flatMap((territory) => {
      const point = points.get(territory.geoUnitIds[0] ?? -1)
      if (!point) return []
      const at = { lon: point.lon, lat: point.lat }
      const capitalOf = empireOf.get(territory.id)
      return [
        ...(capitalOf
          ? [
              {
                id: `capital:${territory.id}`,
                kind: 'capital' as const,
                color: capitalOf.color,
                emblem: capitalOf.emblem,
                logo: capitalOf.logoUrl,
                ...at,
              },
            ]
          : []),
        ...(territory.alert
          ? [{ id: `alert:${territory.id}`, kind: 'alert' as const, ...at }]
          : []),
        // It can be attacked now: crossed swords to press, to prepare the attack at once.
        ...(attackable.has(territory.id) && !preparing
          ? [
              {
                id: `attack:${territory.id}`,
                kind: 'attack' as const,
                busy: busy.has(`attack:${territory.id}`),
                ...at,
              },
            ]
          : []),
        ...(gains.has(territory.id)
          ? [
              {
                id: `gain:${territory.id}`,
                kind: (gains.get(territory.id) ?? 0) < 0 ? ('loss' as const) : ('gain' as const),
                text: `${(gains.get(territory.id) ?? 0) < 0 ? '−' : '+'}${String(Math.abs(gains.get(territory.id) ?? 0))}`,
                ...at,
              },
            ]
          : []),
        // What the territory holds, where the viewer is allowed to know: seen at a glance.
        ...(territory.resources !== null
          ? [
              {
                id: `resources:${territory.id}`,
                kind: 'resources' as const,
                text: String(territory.resources),
                ...at,
              },
            ]
          : []),
        // Just acquired: it cannot be attacked until the turn ends.
        ...(territory.protected
          ? [{ id: `protected:${territory.id}`, kind: 'protected' as const, ...at }]
          : []),
        // Structures are read by their effects, so new ones with the same effects are drawn too.
        ...(state?.structures ?? [])
          .filter((structure) => structure.territoryId === territory.id)
          .flatMap((structure): MapMarker[] => [
            // A port: the sea is reached from here.
            ...(structure.effects.includes('SEA_REACH')
              ? [{ id: `port:${structure.id}`, kind: 'port' as const, ...at }]
              : []),
            // An airport: whatever is in its range is reached from here.
            ...(structure.effects.includes('AIR_REACH')
              ? [{ id: `airport:${structure.id}`, kind: 'airport' as const, ...at }]
              : []),
            ...(structure.effects.includes('NO_ATTACK_ON')
              ? [
                  {
                    id: `block:${structure.id}`,
                    kind: 'block' as const,
                    text: structure.turnsLeft === null ? '' : String(structure.turnsLeft),
                    ...at,
                  },
                ]
              : []),
            ...(structure.effects.includes('BACKUP_CAPITAL')
              ? [
                  {
                    id: `second:${structure.id}`,
                    kind: 'second-capital' as const,
                    color: state?.empires.find((e) => e.id === structure.empireId)?.color,
                    ...at,
                  },
                ]
              : []),
          ]),
      ]
    })
    // A territory being fought over: crossed swords bounce on it, for everyone.
    const fought = new Set(
      state?.battles.filter((b) => b.status === 'OPEN').map((b) => b.targetTerritoryId),
    )
    // An attack on the viewer still to answer: a shield to press, with what defending costs.
    const toAnswer = new Map(
      state?.battles
        .filter((b) => b.status === 'OPEN' && b.role === 'defender' && !b.response)
        .map((b) => [b.targetTerritoryId, b]),
    )
    const clashes = (state?.territories ?? []).flatMap((territory): MapMarker[] => {
      const point = points.get(territory.geoUnitIds[0] ?? -1)
      if (!fought.has(territory.id) || !point) return []
      const answer = canAct ? toAnswer.get(territory.id) : undefined
      return answer
        ? [
            {
              id: `defend:${answer.id}`,
              kind: 'defend',
              text: String(answer.defenseCost ?? 0),
              lon: point.lon,
              lat: point.lat,
            },
            // Or it is given away: a white flag beside the shield.
            { id: `surrender:${answer.id}`, kind: 'surrender', lon: point.lon, lat: point.lat },
          ]
        : [{ id: `battle:${territory.id}`, kind: 'battle', lon: point.lon, lat: point.lat }]
    })
    const conquests = (state?.territories ?? []).flatMap((territory): MapMarker[] => {
      const point = points.get(territory.geoUnitIds[0] ?? -1)
      const gain = captured.get(territory.id)
      return captured.has(territory.id) && point
        ? [
            {
              id: `captured:${territory.id}`,
              kind: 'captured',
              text: gain ? `+${String(gain)}` : '',
              lon: point.lon,
              lat: point.lat,
            },
          ]
        : []
    })
    const failures = (state?.territories ?? []).flatMap((territory): MapMarker[] => {
      const point = points.get(territory.geoUnitIds[0] ?? -1)
      const cost = repelled.get(territory.id)
      return repelled.has(territory.id) && point
        ? [
            {
              id: `repelled:${territory.id}`,
              kind: 'repelled',
              text: cost ? `−${String(cost)}` : '',
              lon: point.lon,
              lat: point.lat,
            },
          ]
        : []
    })
    return [...signs, ...flags, ...clashes, ...conquests, ...failures]
  }, [state, targetIds, annexIds, gains, captured, repelled, canAct, preparing, busy, units.data])

  const mineId = state?.me?.empireId
  // What is lit on the map: the empire pointed at in the ranking, or the free
  // neighbours of the player's own municipality that is selected.
  const highlighted = useMemo(() => {
    // A structure in the hand: where it can be put down.
    if (dropSites) {
      return (state?.territories ?? [])
        .filter((territory) => dropSites.includes(territory.id))
        .flatMap((territory) => territory.geoUnitIds)
    }
    if (hoveredEmpire) {
      return (state?.territories ?? [])
        .filter((territory) => territory.ownerEmpireId === hoveredEmpire)
        .flatMap((territory) => territory.geoUnitIds)
    }
    // While an attack is prepared: the own territories that can join it.
    if (attack) {
      const usable = new Set(
        attack.card.attack?.from.filter((source) => source.usable).map((s) => s.territoryId),
      )
      return (state?.territories ?? [])
        .filter((territory) => usable.has(territory.id))
        .flatMap((territory) => territory.geoUnitIds)
    }
    if (card && selected?.id === card.geoUnitId && card.territory.ownerEmpireId === mineId) {
      return card.neighbours.filter((n) => n.ownerEmpireId === null).map((n) => n.geoUnitId)
    }
    return []
  }, [attack, card, dropSites, hoveredEmpire, mineId, selected?.id, state?.territories])

  // Territories that are the target of an open battle are marked for everyone.
  const attacked = useMemo(() => {
    const targets = new Set(
      state?.battles.filter((b) => b.status === 'OPEN').map((b) => b.targetTerritoryId),
    )
    return (state?.territories ?? [])
      .filter((territory) => targets.has(territory.id))
      .flatMap((territory) => territory.geoUnitIds)
  }, [state?.battles, state?.territories])

  const selectFromList = useCallback(
    (unit: MapUnit) => {
      setSelected(unit)
      const point = units.data?.find((candidate) => candidate.id === unit.id)
      if (point) setFocus({ lon: point.lon, lat: point.lat })
    },
    [units.data],
  )

  // An announcement names a municipality: select it and bring it into view.
  const goTo = (geoUnitId: number, name: string) => {
    selectFromList({ id: geoUnitId, name })
    setPhoneTab('map')
  }

  if (stateQuery.error) {
    const missing = stateQuery.error instanceof ApiError && stateQuery.error.status === 404
    return missing ? (
      <NotFoundPage />
    ) : (
      <p className="text-danger p-6">{t('match.errors.UNKNOWN')}</p>
    )
  }
  if (!state) return <p className="text-muted-foreground p-6">{t('match.loading')}</p>

  const { match } = state
  const mine = state.empires.find((empire) => empire.id === mineId) ?? null
  const joining = !mine
  const selectedTerritory = selected ? ownership.byUnit.get(selected.id) : undefined
  // While registering, a free municipality picked on the map is the chosen start.
  const start = joining && selected && !selectedTerritory ? selected : null

  // An attack on the capital cannot wait to be noticed: losing it is losing the empire.
  // Its dialog opens by itself, once, with that attack in front of the others.
  const urgent = mine
    ? state.battles.find(
        (battle) =>
          battle.role === 'defender' &&
          battle.status === 'OPEN' &&
          !battle.response &&
          !battle.foughtThisTurn &&
          battle.targetTerritoryId === mine.capitalTerritoryId,
      )
    : undefined
  if (urgent && urgent.id !== urgentShown) {
    setUrgentShown(urgent.id)
    setAlertOpen(true)
  }
  const fallen = match.status !== 'FINISHED' && state.me?.status === 'FALLEN'

  // Who is not in the match yet has the way into it in front; a player has the match.
  const view: View = joining ? 'match' : (chosenView ?? 'info')
  const open = (next: View) => {
    setView(next)
    setHoveredEmpire(null)
    if (next !== 'attack') setAttack(null)
  }
  const openSheet = (next: Sheet | null) => {
    setSheet(next)
    // What was being chosen in a dialog is dropped with it.
    if (next !== 'merge') setMerging([])
  }
  const onMapSelect = (unit: MapUnit | null) => {
    // Looking at the past: the box says who owned the municipality then, nothing else opens.
    if (reviewing) {
      setSelected(unit)
      return
    }
    // While an attack is prepared, tapping an own territory that can join it adds or
    // removes it; any other tap is ignored, so the target is not lost by mistake.
    if (attack) {
      const territory = unit ? ownership.byUnit.get(unit.id) : undefined
      const source = attack.card.attack?.from.find((s) => s.territoryId === territory?.id)
      if (source?.usable) {
        setRefused(null)
        setAttack({
          ...attack,
          from: attack.from.includes(source.territoryId)
            ? attack.from.filter((id) => id !== source.territoryId)
            : [...attack.from, source.territoryId],
        })
      } else if (territory && territory.ownerEmpireId === mineId) {
        // An own territory that cannot join: said, or the tap would seem lost.
        setRefused({ name: territory.name, why: source ? 'unusable' : 'far' })
      }
      return
    }
    setSelected(unit)
    setRangeOf(null)
    // A player who taps a municipality gets its card; someone registering keeps the form.
    if (unit && !joining) setView('unit')
    if (!unit && view === 'unit') setView('info')
  }

  // The signs on the map that work as buttons: the swords attack that territory, the
  // flag annexes that municipality, at once and without passing through its card.
  const onMarker = (markerId: string) => {
    const [kind, signId] = markerId.split(':')
    if ((kind === 'port' || kind === 'airport') && signId) {
      // While an attack is prepared the sign stands for its territory: it joins or leaves.
      const territoryId = state.structures.find((s) => s.id === signId)?.territoryId
      const source = attack?.card.attack?.from.find((s) => s.territoryId === territoryId)
      if (attack) {
        if (source?.usable) {
          setAttack({
            ...attack,
            from: attack.from.includes(source.territoryId)
              ? attack.from.filter((id) => id !== source.territoryId)
              : [...attack.from, source.territoryId],
          })
        }
        return
      }
      // The anchor and the plane show how far they reach; a second tap hides it again.
      setRangeOf((shown) => (shown === signId ? null : signId))
      return
    }
    if (kind === 'defend' && signId) {
      // The shield defends at once; to surrender instead, the alert of the attack is opened.
      void matchApi
        .respond(id, signId, 'DEFEND')
        .then((next) => queryClient.setQueryData(['matches', 'state', id], next))
        .catch(() => setAlertOpen(true))
      return
    }
    if (kind === 'surrender' && signId) {
      // The capital is the empire: giving it away is decided in the alert, which says so.
      const battle = state.battles.find((candidate) => candidate.id === signId)
      const capital = state.empires.find((empire) => empire.id === state.me?.empireId)
      if (battle?.targetTerritoryId === capital?.capitalTerritoryId) {
        setAlertOpen(true)
        return
      }
      void matchApi
        .respond(id, signId, 'SURRENDER')
        .then((next) => queryClient.setQueryData(['matches', 'state', id], next))
        .catch(() => setAlertOpen(true))
      return
    }
    if (kind !== 'attack' && kind !== 'annex') return
    // Pressed already, and still on its way: once is enough.
    if (busy.has(markerId)) return
    // An attack is on a territory, an annexation on a free municipality.
    const unitId =
      kind === 'annex'
        ? Number(signId)
        : state.territories.find((t) => t.id === signId)?.geoUnitIds[0]
    const point = units.data?.find((unit) => unit.id === unitId)
    if (!point) return
    const unit = { id: point.id, name: point.name }
    setBusy((now) => new Set(now).add(markerId))
    const settle = () =>
      setBusy((now) => {
        const left = new Set(now)
        left.delete(markerId)
        return left
      })
    if (kind === 'annex') {
      // The flag annexes at once, paid by the richest own municipality beside it. If it
      // cannot be done any more, the card of the municipality says why.
      void matchApi
        .unit(id, point.id)
        .then((target) => {
          const payer = target.annex?.payFrom.find((candidate) => candidate.usable)
          if (!payer) throw new Error('not annexable')
          return matchApi.annex(id, {
            geoUnitId: point.id,
            payFromTerritoryId: payer.territoryId,
            turn: state.match.currentTurn,
          })
        })
        .then((next) => {
          queryClient.setQueryData(['matches', 'state', id], next)
          return queryClient.invalidateQueries({ queryKey: ['matches', 'unit', id] })
        })
        .catch(() => onMapSelect(unit))
        .finally(settle)
      return
    }
    void matchApi
      .unit(id, point.id)
      .then((target) => {
        const sources = target.attack?.from.filter((source) => source.usable) ?? []
        // No longer attackable by the time it was pressed: its card says why.
        if (!target.attack || target.attack.blocked !== null || sources.length === 0) {
          onMapSelect(unit)
          return
        }
        // An attack that could start from a port or an airport is never declared for the
        // player: they choose on the map where it starts from, and see what it costs.
        if (sources.some((source) => source.via !== 'land')) {
          open('info')
          setSelected(null)
          setRefused(null)
          setAttack({ card: target, from: [] })
          return
        }
        // The swords attack at once, from every own territory beside it that can: to
        // choose where from, the attack is prepared from the card.
        return matchApi
          .attack(id, {
            targetGeoUnitId: point.id,
            fromTerritoryIds: sources.map((source) => source.territoryId),
            turn: state.match.currentTurn,
          })
          .then((next) => {
            queryClient.setQueryData(['matches', 'state', id], next)
            return queryClient.invalidateQueries({ queryKey: ['matches', 'unit', id] })
          })
      })
      .catch(() => onMapSelect(unit))
      .finally(settle)
  }

  // From a warning to its place: the map goes to the territory, and the card of the
  // municipality opens. Not while an attack is prepared, when a tap on a territory means
  // something else.
  const locate = (territoryId: string) => {
    const unitId = state.territories.find((t) => t.id === territoryId)?.geoUnitIds[0]
    const point = units.data?.find((unit) => unit.id === unitId)
    if (!point) return
    setFocus({ lon: point.lon, lat: point.lat })
    setPhoneTab('map')
    if (!attack) onMapSelect({ id: point.id, name: point.name })
  }

  const matchView = (
    // Only the way in, a step at a time: the match is managed from the empire, once there is one.
    <JoinPanel
      state={state}
      start={start}
      header={<MatchInfo state={state} />}
      notice={
        selected &&
        selectedTerritory && (
          <p role="status" className="text-danger">
            {t('match.join.placeTaken', { name: selected.name })}
          </p>
        )
      }
    />
  )

  // What is said of the municipality that was picked, in a card beside the map.
  const unitInfo = (unit: MapUnit) => {
    if (reviewing) {
      const then = ownership.empires.get(reviewing.ownership[String(unit.id)] ?? '')
      return (
        <UnitCard name={unit.name} isolation={unit.isolation}>
          {then ? (
            <p className="flex items-center gap-2">
              <EmpireShield
                color={then.color}
                emblem={then.emblem}
                logo={then.logoUrl}
                className="size-6"
              />
              {t('match.unit.owned', { name: then.name })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t('match.unit.free')}</p>
          )}
        </UnitCard>
      )
    }
    const territory = ownership.byUnit.get(unit.id)
    const empire = territory && ownership.empires.get(territory.ownerEmpireId)
    return (
      <UnitCard name={unit.name} isolation={unit.isolation}>
        {empire && territory ? (
          <>
            <p className="flex items-center gap-2">
              <EmpireShield
                color={empire.color}
                emblem={empire.emblem}
                logo={empire.logoUrl}
                className="size-6"
              />
              {t('match.unit.owned', { name: empire.name })}
            </p>
            <p className="text-muted-foreground">
              {territory.resources === null
                ? t('match.unit.hidden')
                : t('match.unit.resources', { count: territory.resources })}
            </p>
            <StatusBadge
              status={unitStatus(true, territory.battleId !== null)}
              className="self-start"
            />
            {empire.capitalTerritoryId === territory.id && <p>{t('match.unit.capital')}</p>}
            {territory.protected && <p>{t('match.unit.protected')}</p>}
          </>
        ) : (
          <StatusBadge status="neutral" className="self-start" />
        )}
      </UnitCard>
    )
  }

  return (
    <div className="relative flex flex-col max-lg:-mt-14 md:h-dvh">
      {hasMap && area.data ? (
        <div
          className={cn(
            'relative h-[calc(100dvh-3.5rem)] flex-none md:h-full',
            phoneTab !== 'map' && 'hidden md:block',
          )}
        >
          <LazyGameMap
            attribution="bottom-left"
            viewInUrl
            area={area.data}
            colors={reviewing ? pastColors : ownership.colors}
            empireLabels={reviewing ? NOTHING : labels}
            markers={reviewing ? NOTHING : markers}
            onMarker={onMarker}
            bags={reviewing ? NOTHING : focusBags.bags}
            onBagDrop={focusBags.drop}
            onBagSplit={focusBags.split}
            onProbe={(next) => {
              probe.current = next
            }}
            ownerTags={ownerTags}
            areas={hasAreas && !reviewing ? (areas.data ?? null) : null}
            outline={reviewing || holdings === '' ? null : (outline.data?.geometry ?? null)}
            fronts={openBattles !== '' && !reviewing ? (fronts.data ?? null) : null}
            ranges={reviewing ? NO_RANGES : ranges}
            frame={reviewing ? null : frame}
            arcs={reviewing ? NO_ARCS : arcs}
            selected={selected}
            highlightedIds={reviewing ? NOTHING : highlighted}
            attackedIds={reviewing ? NOTHING : attacked}
            focus={focus}
            onSelect={onMapSelect}
            className="h-full"
          />
          {reviewing ? (
            <div
              role="group"
              aria-label={t('game.history.bar')}
              className="bg-background rounded-pill absolute top-16 left-3 z-10 flex h-11 items-center gap-2 px-1.5 shadow-md"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('game.history.previous')}
                disabled={!reviewTurns.includes(reviewing.turn - 1)}
                onClick={() => setReview(reviewing.turn - 1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p role="status" className="font-bold">
                {t('game.history.reviewing', { turn: reviewing.turn })}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('game.history.next')}
                disabled={!reviewTurns.includes(reviewing.turn + 1)}
                onClick={() => setReview(reviewing.turn + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
              <Button size="sm" onClick={() => setReview(null)}>
                {t('game.history.present')}
              </Button>
            </div>
          ) : (
            <div
              role="group"
              aria-label={t('game.map.view')}
              className="bg-background rounded-pill absolute top-16 left-3 z-10 flex h-11 items-center gap-1 p-1 shadow-md"
            >
              {MAP_VIEWS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mapView === option}
                  onClick={() => setMapView(option)}
                  className={cn(
                    'rounded-pill h-9 cursor-pointer px-4 text-base transition-colors',
                    mapView === option
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-accent',
                  )}
                >
                  {t(`game.map.${option}`)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-pressed={showTags}
            onClick={() => {
              const next = !showTags
              setShowTags(next)
              try {
                localStorage.setItem('map.tags', next ? 'on' : 'off')
              } catch {
                // Not remembered, that is all.
              }
            }}
            className={cn(
              'rounded-pill absolute top-[7.5rem] left-3 z-10 h-11 cursor-pointer px-5 text-base shadow-md transition-colors',
              showTags
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-background hover:bg-accent',
            )}
          >
            {t('game.map.tags')}
          </button>
          {/* Top left, under the controls of the map: the municipality that was picked.
              On a phone it comes up from the bottom. */}
          {selected && (
            <div className="bg-background animate-in fade-in absolute top-[11rem] left-3 z-10 flex max-h-[calc(100%-16.5rem)] w-80 flex-col gap-4 overflow-y-auto rounded-lg p-4 shadow-md duration-200 max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:max-h-[60%] max-md:w-auto max-md:rounded-b-none lg:w-[24rem]">
              <Button
                variant="quiet"
                size="icon-sm"
                className="self-end max-md:size-10"
                aria-label={t('game.menu.close')}
                onClick={() => {
                  setSelected(null)
                  open('info')
                }}
              >
                <X aria-hidden="true" />
              </Button>
              {/* A player gets everything about it and what can be done there; who is
                  looking at the past, or choosing where to start, only what it is. */}
              {(reviewing || (view !== 'unit' && view !== 'attack')) && unitInfo(selected)}
              {!reviewing && view === 'unit' && (
                <UnitPanel
                  key={selected.id}
                  state={state}
                  unit={selected}
                  onCard={setCard}
                  onPrepareAttack={(target) => {
                    // The strongest usable territory is proposed; the player adds or removes.
                    const first = target.attack?.from.find((source) => source.usable)
                    setAttack({ card: target, from: first ? [first.territoryId] : [] })
                    setView('attack')
                  }}
                />
              )}
              {!reviewing && view === 'attack' && attack && (
                <AttackPanel
                  state={state}
                  card={attack.card}
                  chosen={attack.from}
                  onChoose={(from) => setAttack({ ...attack, from })}
                  onDone={() => open('unit')}
                />
              )}
            </div>
          )}
          {/* Bottom left, over the map: the news of the board as they come. With a
              municipality picked they stand beside its card, never over what is done there. */}
          <div
            className={cn(
              'absolute bottom-12 left-3 z-10 max-md:hidden',
              selected && 'md:left-[21.5rem] lg:left-[25.5rem]',
            )}
          >
            <BoardToasts state={state} />
          </div>
          {/* The resources of the empire, where the card of the match is: not a dialog,
              so the map stays in sight and in use while they are balanced. */}
          {resourcesOpen && mine && !fallen && (
            <section
              aria-label={t('game.menu.resources')}
              className="bg-background animate-in fade-in absolute inset-x-3 top-16 z-20 flex max-h-[calc(100%-9rem)] flex-col gap-4 overflow-y-auto rounded-lg p-4 shadow-lg duration-200 md:top-3 md:right-[4.5rem] md:left-auto md:max-h-[calc(100%-7rem)] md:w-[32rem] lg:w-[42rem] xl:w-[48rem]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl">{t('game.menu.resources')}</h2>
                <Button
                  variant="quiet"
                  size="icon-sm"
                  aria-label={t('game.menu.close')}
                  onClick={() => setResourcesOpen(false)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <ResourcesPage state={state} />
            </section>
          )}
          {/* The structures, in the same place: a menu that leaves the map in sight, since
              what it lists is dragged onto the map itself. */}
          {buildOpen && mine && !fallen && (
            <section
              aria-label={t('game.menu.build')}
              className="bg-background animate-in fade-in absolute inset-x-3 bottom-16 z-20 flex max-h-[45%] flex-col gap-3 overflow-y-auto rounded-lg p-4 shadow-lg duration-200 md:top-3 md:right-[4.5rem] md:bottom-auto md:left-auto md:max-h-[calc(100%-7rem)] md:w-[22rem] lg:w-[24rem]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl">{t('game.menu.build')}</h2>
                <Button
                  variant="quiet"
                  size="icon-sm"
                  aria-label={t('game.menu.close')}
                  onClick={() => setBuildOpen(false)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <BuildPage
                state={state}
                onSites={setDropSites}
                territoryAt={(x, y) => {
                  const unitId = probe.current?.unitAt(x, y) ?? null
                  return unitId === null
                    ? null
                    : (state.territories.find((territory) => territory.geoUnitIds.includes(unitId))
                        ?.id ?? null)
                }}
              />
            </section>
          )}
          {/* Bottom right, over the map: the news of the board as they come, and under
              them the turn and its clock, the player's resources and the board itself.
              On a phone the board has its own tab and the figures are in the bar on top. */}
          {!reviewing && <TurnAnnouncer part="turn" match={match} sound={sound} />}
          {/* How a battle of the player went: in the middle of the map too, until closed. */}
          {!reviewing && <BattleAnnouncer state={state} sound={sound} />}
          {/* Paused: said in the middle of the map, with the way back into the match. */}
          {match.status === 'ONGOING' && match.pausedAt && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div
                role="status"
                className="bg-background/95 pointer-events-auto flex flex-col items-center gap-4 rounded-2xl px-10 py-6 shadow-lg"
              >
                <p className="font-display text-4xl sm:text-5xl">{t('game.pause.title')}</p>
                {match.isOwner && (
                  <Button size="lg" disabled={pause.isPending} onClick={() => pause.mutate(false)}>
                    <Play aria-hidden="true" />
                    {t('game.pause.resume')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* The announcements, at the top of the map between the search and what stands
              top right (on a phone, under the controls of the map): the turn that ends
              or begins, then the attacks on the player. */}
          <div className="pointer-events-none absolute inset-x-3 top-[10.5rem] z-20 flex flex-col gap-2 md:top-16 md:right-auto md:left-[23rem] md:w-72 xl:top-3 xl:right-[29.5rem] xl:left-[21rem] xl:mx-auto xl:w-auto xl:max-w-[30rem]">
            {!reviewing && <TurnAnnouncer part="count" match={match} sound={sound} />}
            {/* An attack prepared on the map itself: where from is chosen by tapping. */}
            {!reviewing && attack && view !== 'attack' && (
              <AttackBar
                key={attack.card.geoUnitId}
                state={state}
                card={attack.card}
                chosen={attack.from}
                refused={refused}
                onDone={() => setAttack(null)}
              />
            )}
            <AttackToasts
              state={state}
              sound={sound}
              onRespond={() => setAlertOpen(true)}
              onLocate={locate}
            />
            {!reviewing && <SiegeToasts state={state} onLocate={locate} />}
          </div>
          {/* Top left, beside the button of the menu: finding a municipality by its name. */}
          {units.data && !reviewing && (
            <UnitSearch
              units={units.data}
              className="absolute top-2 right-16 left-16 z-20 md:right-auto md:w-64"
              onSelect={(unit) => {
                selectFromList(unit)
                onMapSelect(unit)
              }}
            />
          )}
          {/* On the right edge, under the zoom: the round buttons that open the empire
              and its pages, the leaderboard and the history, each in a dialog. */}
          <div className="absolute top-28 right-3 z-10 flex flex-col gap-1.5 md:gap-2">
            {mine && (
              <MapFab
                label={t('game.fab.empire', { name: mine.name })}
                onClick={() => openSheet('empire')}
              >
                <EmpireShield
                  color={mine.color}
                  emblem={mine.emblem}
                  logo={mine.logoUrl}
                  className="size-8"
                />
              </MapFab>
            )}
            {/* A fallen empire has nothing left to manage. */}
            {mine &&
              !fallen &&
              EMPIRE_SHEETS.map(([page, Icon]) => (
                <MapFab
                  key={page}
                  label={t(`game.menu.${page}`)}
                  // The resources open beside the map, the rest over it.
                  onClick={() => {
                    if (page === 'resources') {
                      setBuildOpen(false)
                      setResourcesOpen((open) => !open)
                    } else if (page === 'build') {
                      setResourcesOpen(false)
                      setBuildOpen((open) => !open)
                    } else openSheet(page)
                  }}
                  dimmed={PRELIMINARY_SHEETS.includes(page) && phase !== 'PRELIMINARY'}
                >
                  <Icon aria-hidden="true" />
                </MapFab>
              ))}
            <MapFab label={t('game.menu.leaderboard')} onClick={() => openSheet('leaderboard')}>
              <Trophy aria-hidden="true" />
            </MapFab>
            {(match.status === 'ONGOING' || match.status === 'FINISHED') && (
              <MapFab label={t('game.menu.history')} onClick={() => openSheet('history')}>
                <ScrollText aria-hidden="true" />
              </MapFab>
            )}
            {/* Played alone, a match can be stopped: nobody else is kept waiting. */}
            {match.status === 'ONGOING' && match.mode === 'SINGLEPLAYER' && match.isOwner && (
              <MapFab
                label={t(match.pausedAt ? 'game.pause.resume' : 'game.pause.pause')}
                onClick={() => pause.mutate(!match.pausedAt)}
              >
                {match.pausedAt ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </MapFab>
            )}
            {match.status === 'ONGOING' && (
              <MapFab
                label={t(sound ? 'game.sound.off' : 'game.sound.on')}
                onClick={() => {
                  const next = !sound
                  setSound(next)
                  try {
                    localStorage.setItem('match.sound', next ? 'on' : 'off')
                  } catch {
                    // Not remembered, that is all.
                  }
                }}
              >
                {sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
              </MapFab>
            )}
          </div>
          <div
            className={cn(
              'absolute right-3 bottom-3 z-10 flex flex-col items-end gap-2',
              // On a phone the card of the chosen municipality takes this place while it is open.
              selected && 'max-md:hidden',
            )}
          >
            <Board
              state={state}
              onGoTo={goTo}
              onPhoneTab
              leading={
                <MatchHud
                  state={state}
                  alert={
                    <BattleAlert
                      state={state}
                      open={alertOpen}
                      onOpenChange={setAlertOpen}
                      firstId={urgent?.id}
                    />
                  }
                />
              }
            />
          </div>
        </div>
      ) : (
        <div className="bg-muted hidden flex-1 md:block" />
      )}

      {/* Top right, beside the round buttons: the one card over the map. It says what
          match this is and, when a municipality is picked, becomes its card. On a phone
          it is a tab of its own. */}
      <aside
        className={cn(
          'flex w-full flex-col gap-4 overflow-y-auto p-4 pb-20 max-lg:pt-16',
          'md:bg-background md:absolute md:top-3 md:right-[4.5rem] md:z-10 md:max-h-[calc(100dvh-5.5rem)] md:w-[22rem] md:rounded-lg md:p-4 md:shadow-md lg:w-[24rem]',
          hasMap && phoneTab !== 'panel' && 'hidden md:flex',
        )}
      >
        {view !== 'match' ? (
          <>
            <MatchInfo state={state} />
            <MatchTimes
              match={match}
              online={
                match.status !== 'FINISHED'
                  ? t('game.hud.online', { count: connected, total: state.online.total })
                  : null
              }
            />
            {canAct && (
              <Button
                variant="destructive"
                className="border-[#e11d2e] bg-[#e11d2e] text-white hover:border-[#b81524] hover:bg-[#b81524]"
                onClick={() => setAbandoning(true)}
              >
                {t('game.abandon.open')}
              </Button>
            )}
          </>
        ) : (
          <>{view === 'match' && matchView}</>
        )}
      </aside>

      {hasMap && phoneTab === 'board' && (
        <div className="h-[calc(100dvh-3.5rem)] pt-14 md:hidden">
          <Board state={state} onGoTo={goTo} full />
        </div>
      )}

      {/* The match is over: said once, to who played it. */}
      <EndAnnouncement state={state} onRanking={() => openSheet('leaderboard')} />

      {/* Everything that does not need the map beside it opens over the page. */}
      <Dialog open={sheet !== null} onOpenChange={(next) => !next && openSheet(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-5 overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="text-2xl">
            {sheet === 'empire' ? (mine?.name ?? '') : sheet ? t(`game.menu.${sheet}`) : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">{match.name}</DialogDescription>
          {sheet === 'empire' && mine && (
            <div className="flex flex-col gap-6">
              <MyEmpire state={state} empire={mine} />
              {match.isOwner && match.mode === 'MULTIPLAYER' && match.visibility === 'PRIVATE' && (
                <InvitePanel match={match} />
              )}
              {match.isOwner && <OwnerPanel key={match.status} match={match} />}
            </div>
          )}
          {sheet !== null && PRELIMINARY_SHEETS.includes(sheet) && phase === 'ACTION' && (
            <p role="status" className="text-danger">
              {t('game.phase.onlyPreliminary')}
            </p>
          )}
          {sheet === 'leaderboard' && <Leaderboard state={state} onHover={setHoveredEmpire} />}
          {sheet === 'merge' && <MergePage state={state} chosen={merging} onChoose={setMerging} />}
          {sheet === 'alliance' && <AlliancePage state={state} />}
          {sheet === 'history' && (
            <HistoryPage
              state={state}
              review={review}
              onReview={(turn) => {
                setReview(turn)
                setSelected(null)
                // A past turn is looked at on the map: the dialog gets out of the way.
                if (turn !== null) {
                  setSheet(null)
                  setPhoneTab('map')
                }
              }}
              onGoTo={(geoUnitId, name) => {
                setSheet(null)
                goTo(geoUnitId, name)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Leaving for good is asked twice: it cannot be undone. */}
      <Dialog
        open={abandoning}
        onOpenChange={(next) => {
          setAbandoning(next)
          if (!next) abandon.reset()
        }}
      >
        <DialogContent className="flex flex-col gap-5 sm:max-w-lg">
          <DialogTitle className="text-2xl">{t('game.abandon.title')}</DialogTitle>
          <DialogDescription className="text-foreground text-lg">
            {t('game.abandon.text')}
          </DialogDescription>
          {abandon.error && (
            <p role="alert" className="text-danger">
              {t('match.errors.UNKNOWN')}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <DialogClose asChild>
              <Button variant="outline">{t('game.abandon.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="border-[#e11d2e] bg-[#e11d2e] text-white hover:border-[#b81524] hover:bg-[#b81524]"
              disabled={abandon.isPending}
              onClick={() => abandon.mutate()}
            >
              {t('game.abandon.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* The fall of the empire is told at once, in full, and only once. */}
      <Dialog
        open={fallen && !fallenSeen}
        onOpenChange={(next) => {
          if (next) return
          setFallenSeen(true)
          try {
            localStorage.setItem(`fallen-seen:${id}`, 'yes')
          } catch {
            // Told again at the next visit, that is all.
          }
        }}
      >
        <DialogContent className="flex flex-col items-center gap-5 text-center sm:max-w-lg">
          {mine && (
            <EmpireShield
              color={mine.color}
              emblem={mine.emblem}
              logo={mine.logoUrl}
              className="size-20 opacity-60 grayscale"
            />
          )}
          <DialogTitle className="text-3xl">{t('game.end.fallenTitle')}</DialogTitle>
          <DialogDescription className="text-foreground text-lg">
            {t('game.end.fallenText', { name: mine?.name ?? '' })}
          </DialogDescription>
          <DialogClose asChild>
            <Button size="lg">{t('game.end.fallenContinue')}</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {/* On a phone the map, the panel and the board take the whole screen in turn. */}
      {hasMap && (
        <div
          role="tablist"
          aria-label={t('game.menu.tabs')}
          className="bg-background fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 md:hidden"
        >
          {(['map', 'panel', 'board'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={phoneTab === tab}
              onClick={() => setPhoneTab(tab)}
              className={cn(
                'h-14 cursor-pointer font-bold tracking-[0.09em] uppercase',
                phoneTab === tab && 'bg-primary text-primary-foreground',
              )}
            >
              {t(
                tab === 'map'
                  ? 'game.menu.phoneMap'
                  : tab === 'panel'
                    ? 'game.menu.phonePanel'
                    : 'game.menu.phoneBoard',
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
