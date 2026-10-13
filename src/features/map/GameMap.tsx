import i18next from 'i18next'
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  setWorkerUrl,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
// MapLibre parses tiles in a web worker shipped as a separate file: the bundler
// emits it as its own chunk and hands back the address.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'
import type { FeatureCollection, Geometry } from 'geojson'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

import type { AreaMap } from './api'
import { diffFlags, diffState } from './feature-state'
import {
  AIRPORT_LAYER,
  ANNEX_LAYER,
  ATTACK_LAYER,
  AREAS_SOURCE,
  ARCS_SOURCE,
  FRONTS_SOURCE,
  PORT_LAYER,
  RANGES_SOURCE,
  ATTACKED_LAYER,
  buildStyle,
  EMPIRES_SOURCE,
  FILL_LAYER,
  MARKERS_SOURCE,
  OWN_SOURCE,
  SIGN_GROUPS_LAYER,
  SIGNS_SOURCE,
  OWNERS_SOURCE,
  UNITS_LAYER,
  UNITS_SOURCE,
} from './style'
import { capitalIconId, ensureCapitalIcons } from './capital-icon'
import {
  ensureShieldIcon,
  ensureSwordsIcon,
  ensureAnnexIcon,
  ensureIsolationIcons,
  ensureAirportIcon,
  ensureArrowIcon,
  ensurePortIcon,
} from './shield-icon'
import { mapColors } from './theme'

export interface MapUnit {
  id: number
  name: string
  /** Why it has no neighbours, when the map knows: it is an island, or an exclave. */
  isolation?: 'island' | 'exclave'
}

/** A sign drawn on a municipality: the capital of an empire, or an accumulation alert. */
export interface MapMarker {
  id: string
  kind:
    | 'capital'
    | 'second-capital'
    | 'alert'
    | 'block'
    | 'port'
    | 'airport'
    | 'protected'
    | 'resources'
    | 'gain'
    | 'loss'
    | 'attack'
    | 'battle'
    | 'captured'
    | 'defend'
    | 'surrender'
    | 'repelled'
    | 'annex'
  lon: number
  lat: number
  /** Colour of the empire, for a capital. */
  color?: string
  /** For a capital: what is drawn on it, the emblem or the uploaded logo of the empire. */
  emblem?: string
  logo?: string | null
  /** Short text drawn on the sign: the turns a block still lasts, the resources of a territory. */
  text?: string
  /** Pressed, and the server has not answered yet: drawn fainter. */
  busy?: boolean
}

/** A bag of money on the map: a point the resources gather by, to drag where they should go. */
/** A circle on the map: a centre and a radius in kilometres. */
export interface MapRange {
  lon: number
  lat: number
  km: number
  /** What reaches that far: a port by sea, an airport by air. */
  kind: 'sea' | 'air'
}

const NO_RANGES: readonly MapRange[] = []
const EARTH_KM = 6371
/** The ring of a circle on the globe: every point the same distance from its centre. */
function circleAround({ lon, lat, km }: Omit<MapRange, 'kind'>, steps = 96): [number, number][] {
  const rad = Math.PI / 180
  const angle = km / EARTH_KM
  const lat1 = lat * rad
  const ring: [number, number][] = []
  for (let step = 0; step <= steps; step++) {
    const bearing = (step / steps) * 2 * Math.PI
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(bearing),
    )
    const lon2 =
      lon * rad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angle) * Math.cos(lat1),
        Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2),
      )
    ring.push([lon2 / rad, lat2 / rad])
  }
  return ring
}

/** A curve from a point to another, with the head of an arrow towards the second. */
export interface MapArc {
  from: [number, number]
  to: [number, number]
  color: string
}

const NO_ARCS: readonly MapArc[] = []
/**
 * A soft curve between two points: it leaves the straight line by a part of its length,
 * always on the same side of the way it goes, so that two attacks crossing each other
 * bend apart.
 */
function curveBetween([x1, y1]: [number, number], [x2, y2]: [number, number], steps = 32) {
  const bend = 0.22
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend
  const line: [number, number][] = []
  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    const u = 1 - t
    line.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2])
  }
  return line
}

export interface MapBag {
  id: string
  lon: number
  lat: number
  /** The resources it carries, written over it. */
  text: string
  /** Not yet placed by the player: it waits to be taken. */
  idle: boolean
  /** The resources will move at the next turn, not now. */
  later: boolean
  /** Whether it can be split in two. */
  split: boolean
}

/** What the page can ask the map. */
export interface MapProbe {
  /** The municipality drawn under a point of the screen, if any. */
  unitAt: (clientX: number, clientY: number) => number | null
}

/** The tag of the owning empire, written on a municipality. */
export interface OwnerTag {
  id: number
  lon: number
  lat: number
  tag: string
}

/** A name drawn over an empire at low zoom. */
export interface EmpireLabel {
  id: string
  name: string
  lon: number
  lat: number
  /** Municipalities controlled: larger empires win when names collide. */
  size: number
}

setWorkerUrl(workerUrl)

const NO_COLORS: ReadonlyMap<number, string> = new Map()
const NO_IDS: readonly number[] = []
const NO_LABELS: readonly EmpireLabel[] = []
const NO_MARKERS: readonly MapMarker[] = []

/** Two crossed swords on a red disc: what bounces on a territory while it is fought over. */
/** A shield on a blue disc: the answer to an attack, pressed to defend. */
const DEFEND_SIGN = `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.500 20 5.500v6c0 5-3.500 8.500-8 10-4.500-1.500-8-5-8-10v-6Z"/><path d="m9 12 2 2 4-4"/></svg></span>`
const BATTLE_SIGN = `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.500 3.500M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg></span>`

/** A white flag on a grey disc: beside the shield, pressed twice to give the territory away. */
const SURRENDER_SIGN = `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4c5-2.500 9 2.500 16 0v10c-7 2.500-11-2.500-16 0"/></svg></span>`
/** A shield that held: what stands for a moment on a territory an attack failed on. */
const REPELLED_SIGN = `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.500 20 5.500v6c0 5-3.500 8.500-8 10-4.500-1.500-8-5-8-10v-6Z"/><path d="m9.500 9.500 5 5"/><path d="m14.500 9.500-5 5"/></svg></span>`
/** How long the flag of the surrender waits for its second press. */
const SURRENDER_ARMED_MS = 6000

/** What is drawn on a capital, if the marker is one and says so. */
const armsOf = (marker: MapMarker) =>
  marker.kind === 'capital' && marker.color && marker.emblem
    ? { color: marker.color, emblem: marker.emblem, logo: marker.logo ?? null }
    : null
const NO_TAGS: readonly OwnerTag[] = []
const NO_BAGS: readonly MapBag[] = []

/** A bag of coins tied at the neck, and the button that splits it in two. */
const BAG_SIGN = `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1.500 4h-3Z"/><path d="M10.500 7C7 9 4.500 12.500 4.500 16a4.500 4.500 0 0 0 4.500 4.500h6a4.500 4.500 0 0 0 4.500-4.500c0-3.500-2.500-7-6-9"/><path d="M14 12.500c-.500-.700-1.200-1-2-1-1.200 0-2 .600-2 1.500 0 2 4 1 4 3 0 .900-.800 1.500-2 1.500-.800 0-1.500-.300-2-1M12 10.500v1M12 17.500v1"/></svg></span>`
/** How near, in pixels, a bag is dropped to another to be put together with it. */
const BAG_MERGE = 30
/** How far beside a bag, in pixels, the one split from it appears. */
const BAG_APART = 52

const PHONE = '(max-width: 767px)'

interface Props {
  area: AreaMap
  /** Colour of each owned municipality; the others are drawn as free. */
  colors?: ReadonlyMap<number, string>
  empireLabels?: readonly EmpireLabel[]
  markers?: readonly MapMarker[]
  /** Tags of the owners on their municipalities: ownership without relying on colour. */
  ownerTags?: readonly OwnerTag[]
  /** Outlines of merged areas, each drawn as one polygon with its name. */
  areas?: FeatureCollection | null
  /** The fronts of the open battles: lines drawn thick and red along the border fought over. */
  fronts?: FeatureCollection | null
  /** Who attacks what: a curve from where each open attack starts to its target. */
  arcs?: readonly MapArc[]
  /** The border of the viewer's own empire: a green line over everything that is coloured. */
  outline?: Geometry | null
  /** How far the ports reach: a circle around each, in kilometres. */
  ranges?: readonly MapRange[]
  selected?: MapUnit | null
  highlightedIds?: readonly number[]
  /** Municipalities under attack, marked for everyone with a pulsing red border. */
  attackedIds?: readonly number[]
  onSelect?: (unit: MapUnit | null) => void
  /** Called with the id of a sign that works as a button (an attack sign) when it is pressed. */
  onMarker?: (id: string) => void
  /** Given once the map is drawn: the way to ask which municipality is under a point of the screen. */
  onProbe?: (probe: MapProbe | null) => void
  /** The bags of money the resources gather by, each one draggable. */
  bags?: readonly MapBag[]
  /** A bag let go: where, and the bag it was dropped on if any. */
  onBagDrop?: (
    id: string,
    here: { lon: number; lat: number },
    onto: string | null,
    /** The municipality under the bag. */
    unitId: number | null,
  ) => void
  /** A bag split in two: where the new one goes. */
  onBagSplit?: (here: { lon: number; lat: number }) => void
  /** Content of the box shown for the selected municipality. */
  renderInfo?: (unit: MapUnit) => ReactNode
  /** A point to bring into view when it changes. */
  focus?: { lon: number; lat: number } | null
  /** Ranges the view must hold: the map moves back until they are all in sight. */
  frame?: readonly MapRange[] | null
  /**
   * For a map embedded in a page that scrolls: one finger scrolls the page,
   * two fingers (or ctrl + wheel) move the map.
   */
  embedded?: boolean
  /** The corner for the credits of the map: the one the page keeps nothing in. */
  attribution?: 'bottom-left' | 'bottom-right'
  /**
   * Room to leave around the area when the map first opens, in pixels: for a
   * map partly covered by something else, so that the area is where it shows.
   */
  fitPadding?: number | { top: number; right: number; bottom: number; left: number }
  className?: string
}

/**
 * The map of the game: OpenStreetMap underneath, municipalities on top.
 * Geometry is loaded once as vector tiles; everything that changes during a
 * match (owner colour, selection, highlights) is applied as feature state.
 */
export function GameMap({
  area,
  colors = NO_COLORS,
  empireLabels = NO_LABELS,
  markers = NO_MARKERS,
  ownerTags = NO_TAGS,
  areas = null,
  fronts = null,
  outline = null,
  ranges = NO_RANGES,
  arcs = NO_ARCS,
  selected = null,
  highlightedIds = NO_IDS,
  attackedIds = NO_IDS,
  onSelect,
  onMarker,
  bags = NO_BAGS,
  onBagDrop,
  onBagSplit,
  onProbe,
  renderInfo,
  focus = null,
  frame = null,
  embedded = false,
  attribution = 'bottom-right',
  fitPadding,
  className,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  // What is currently applied to the map, to change only the differences.
  const applied = useRef({
    colors: NO_COLORS,
    highlighted: new Set<number>(),
    attacked: new Set<number>(),
    selectedId: null as number | null,
  })
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })
  const onMarkerRef = useRef(onMarker)
  useEffect(() => {
    onMarkerRef.current = onMarker
  })

  // The box of the selected municipality: anchored to it on wide screens,
  // a sheet rising from the bottom on a phone.
  const [popupNode] = useState(() => document.createElement('div'))
  const popupRef = useRef<Popup | null>(null)
  // Where the box is anchored, and for which municipality: a selection made
  // elsewhere (a list in the panel) has no place on the map to hang a box on.
  const [anchor, setAnchor] = useState<{ id: number; at: [number, number] } | null>(null)
  const [phone, setPhone] = useState(() => window.matchMedia?.(PHONE).matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.(PHONE)
    if (!query) return
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!container.current) return
    const map = new MapLibreMap({
      container: container.current,
      style: buildStyle(area, mapColors(), window.location.origin),
      ...(area.bounds
        ? { bounds: area.bounds, fitBoundsOptions: { padding: fitPadding ?? 24 } }
        : { center: [12.5, 42], zoom: 5 }),
      minZoom: 4,
      maxZoom: 16,
      cooperativeGestures: embedded,
      // Placed by hand below, in the corner the page leaves free.
      attributionControl: false,
      // The map is flat and north-up: rotating it would only disorient.
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    // The canvas takes the focus for the arrow keys: it needs a name.
    map.getCanvas().setAttribute('aria-label', i18next.t('game.map.canvas'))
    map.addControl(new AttributionControl({ compact: true }), attribution)
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    applied.current = {
      colors: NO_COLORS,
      highlighted: new Set(),
      attacked: new Set(),
      selectedId: null,
    }

    let hovered: number | null = null
    const setHover = (id: number | null) => {
      if (hovered === id) return
      const target = { source: UNITS_SOURCE, sourceLayer: UNITS_LAYER }
      if (hovered !== null) map.setFeatureState({ ...target, id: hovered }, { hover: false })
      if (id !== null) map.setFeatureState({ ...target, id }, { hover: true })
      hovered = id
      map.getCanvas().style.cursor = id === null ? '' : 'pointer'
    }
    map.on('mousemove', FILL_LAYER, (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.id
      setHover(typeof id === 'number' ? id : null)
    })
    map.on('mouseleave', FILL_LAYER, () => setHover(null))

    for (const layer of [ATTACK_LAYER, ANNEX_LAYER, PORT_LAYER, AIRPORT_LAYER, SIGN_GROUPS_LAYER]) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
    }
    map.on('click', (event) => {
      // A sign that is a button comes before the municipality under it.
      const sign = map.queryRenderedFeatures(event.point, {
        layers: [ATTACK_LAYER, ANNEX_LAYER, PORT_LAYER, AIRPORT_LAYER, SIGN_GROUPS_LAYER],
      })[0]
      // A group of flags opens: the map goes in until they stand apart.
      const groupId: unknown = sign?.properties.cluster_id
      if (sign && typeof groupId === 'number' && sign.geometry.type === 'Point') {
        const center = sign.geometry.coordinates as [number, number]
        void map
          .getSource<GeoJSONSource>(SIGNS_SOURCE)
          ?.getClusterExpansionZoom(groupId)
          .then((zoom) => map.easeTo({ center, zoom: zoom + 0.3 }))
        return
      }
      if (sign && onMarkerRef.current) {
        onMarkerRef.current(String(sign.properties.id ?? ''))
        return
      }
      const feature = map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] })[0]
      if (typeof feature?.id !== 'number') {
        onSelectRef.current?.(null)
        return
      }
      setAnchor({ id: feature.id, at: [event.lngLat.lng, event.lngLat.lat] })
      const kind: unknown = feature.properties.kind
      onSelectRef.current?.({
        id: feature.id,
        name: String(feature.properties.name ?? ''),
        ...(kind === 'island' || kind === 'exclave' ? { isolation: kind } : {}),
      })
    })
    map.once('load', () => {
      ensureIsolationIcons(map)
      setReady(true)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      mapRef.current = null
      setReady(false)
      map.remove()
    }
    // A different area (or a new version of its data) is a different map.
  }, [area, embedded, fitPadding, attribution])

  const onProbeRef = useRef(onProbe)
  useEffect(() => {
    onProbeRef.current = onProbe
  })
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    onProbeRef.current?.({
      unitAt: (clientX, clientY) => {
        const box = map.getCanvas().getBoundingClientRect()
        if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom)
          return null
        const id = map.queryRenderedFeatures([clientX - box.left, clientY - box.top], {
          layers: [FILL_LAYER],
        })[0]?.id
        return typeof id === 'number' ? id : null
      },
    })
    return () => onProbeRef.current?.(null)
  }, [ready])

  // Owner colours: only the municipalities that changed are touched.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = { source: UNITS_SOURCE, sourceLayer: UNITS_LAYER }
    const diff = diffState(applied.current.colors, colors)
    for (const [id, color] of diff.set) map.setFeatureState({ ...target, id }, { color })
    for (const id of diff.clear) map.removeFeatureState({ ...target, id }, 'color')
    applied.current.colors = colors
  }, [colors, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = { source: UNITS_SOURCE, sourceLayer: UNITS_LAYER }
    const next = new Set(highlightedIds)
    const diff = diffFlags(applied.current.highlighted, next)
    for (const id of diff.on) map.setFeatureState({ ...target, id }, { highlight: true })
    for (const id of diff.off) map.setFeatureState({ ...target, id }, { highlight: false })
    applied.current.highlighted = next
  }, [highlightedIds, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = { source: UNITS_SOURCE, sourceLayer: UNITS_LAYER }
    const next = new Set(attackedIds)
    const diff = diffFlags(applied.current.attacked, next)
    for (const id of diff.on) map.setFeatureState({ ...target, id }, { attacked: true })
    for (const id of diff.off) map.setFeatureState({ ...target, id }, { attacked: false })
    applied.current.attacked = next

    // The border pulses while something is under attack, unless motion is reduced.
    if (next.size === 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let wide = false
    const timer = setInterval(() => {
      wide = !wide
      map.setPaintProperty(ATTACKED_LAYER, 'line-width', [
        'case',
        ['boolean', ['feature-state', 'attacked'], false],
        wide ? 5.5 : 3.5,
        0,
      ])
    }, 700)
    return () => clearInterval(timer)
  }, [attackedIds, ready])

  const selectedId = selected?.id ?? null
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = { source: UNITS_SOURCE, sourceLayer: UNITS_LAYER }
    const previous = applied.current.selectedId
    if (previous !== null) map.setFeatureState({ ...target, id: previous }, { selected: false })
    if (selectedId !== null) map.setFeatureState({ ...target, id: selectedId }, { selected: true })
    applied.current.selectedId = selectedId
  }, [selectedId, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource<GeoJSONSource>(EMPIRES_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: empireLabels.map((label) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [label.lon, label.lat] },
        properties: { name: label.name, size: label.size },
      })),
    })
  }, [empireLabels, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const write = (icons: Set<string>) => {
      // The flags go to the source that groups them.
      map.getSource<GeoJSONSource>(SIGNS_SOURCE)?.setData({
        type: 'FeatureCollection',
        features: markers
          .filter((marker) => marker.kind === 'annex')
          .map((marker) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [marker.lon, marker.lat] },
            properties: { id: marker.id, kind: marker.kind, busy: marker.busy === true },
          })),
      })
      map.getSource<GeoJSONSource>(MARKERS_SOURCE)?.setData({
        type: 'FeatureCollection',
        features: markers.map((marker) => {
          const icon = armsOf(marker) ? capitalIconId(armsOf(marker)!) : ''
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [marker.lon, marker.lat] },
            properties: {
              id: marker.id,
              kind: marker.kind,
              color: marker.color ?? '',
              text: marker.text ?? '',
              busy: marker.busy === true,
              // Only an image the map really has: otherwise the plain disc stays.
              icon: icons.has(icon) ? icon : '',
            },
          }
        }),
      })
    }
    // The shield of the protected territories is the same for all: drawn once.
    if (markers.some((marker) => marker.kind === 'protected')) ensureShieldIcon(map)
    if (markers.some((marker) => marker.kind === 'attack')) ensureSwordsIcon(map)
    if (markers.some((marker) => marker.kind === 'annex')) ensureAnnexIcon(map)
    if (markers.some((marker) => marker.kind === 'port')) ensurePortIcon(map)
    if (markers.some((marker) => marker.kind === 'airport')) ensureAirportIcon(map)
    // At once with what is there, then again when the arms of the capitals are drawn.
    write(new Set())
    let cancelled = false
    const arms = markers.flatMap((marker) => armsOf(marker) ?? [])
    if (arms.length > 0 && typeof map.hasImage === 'function') {
      void ensureCapitalIcons(map, arms).then((icons) => {
        if (!cancelled && icons.size > 0) write(icons)
      })
    }
    return () => {
      cancelled = true
    }
  }, [markers, ready])

  // A battle being fought: crossed swords that bounce on the territory. Once it is
  // conquered the sign turns green and stops, then shakes sideways once. Drawn in the
  // page, over the map, since nothing drawn by the map moves by itself.
  // An attack the viewer can answer is a shield instead, with the cost of defending
  // over it: pressing it defends at once.
  const battles = markers
    .filter(
      (marker) =>
        marker.kind === 'battle' ||
        marker.kind === 'captured' ||
        marker.kind === 'defend' ||
        marker.kind === 'surrender' ||
        marker.kind === 'repelled',
    )
    .map((marker) => [marker.kind, marker.lon, marker.lat, marker.id, marker.text ?? ''].join('|'))
    .join(';')
  // Each sign stays the same element for as long as it is there: one that is pressed
  // must not be taken away and put back under the finger when another sign changes.
  const signsRef = useRef(new Map<string, Marker>())
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const shown = signsRef.current
    const wanted = new Set(battles === '' ? [] : battles.split(';'))
    for (const [sign, marker] of shown) {
      if (wanted.has(sign)) continue
      marker.remove()
      shown.delete(sign)
    }
    for (const sign of wanted) {
      if (shown.has(sign)) continue
      const [kind, lon, lat, id = '', text = ''] = sign.split('|')
      const pressed = kind === 'defend' || kind === 'surrender'
      const element = document.createElement(pressed ? 'button' : 'div')
      element.className =
        kind === 'captured'
          ? 'battle-sign battle-won'
          : kind === 'repelled'
            ? 'battle-sign battle-repelled'
            : kind === 'defend'
              ? 'battle-sign battle-defend'
              : kind === 'surrender'
                ? 'battle-sign battle-defend battle-surrender'
                : 'battle-sign'
      if (kind === 'defend') {
        element.setAttribute('type', 'button')
        element.setAttribute('aria-label', i18next.t('game.map.defend', { count: Number(text) }))
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          onMarkerRef.current?.(id)
        })
      } else if (kind === 'surrender') {
        // Giving a territory away cannot be taken back: the flag is pressed twice, the
        // first time only to say so, and it forgets if the second does not come.
        element.setAttribute('type', 'button')
        element.setAttribute('aria-label', i18next.t('game.map.surrender'))
        let armed: ReturnType<typeof setTimeout> | null = null
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          if (armed !== null) {
            clearTimeout(armed)
            onMarkerRef.current?.(id)
            return
          }
          element.classList.add('battle-armed')
          element.setAttribute('aria-label', i18next.t('game.map.surrenderConfirm'))
          const said = element.querySelector('b')
          if (said) said.textContent = i18next.t('game.map.surrenderAgain')
          armed = setTimeout(() => {
            armed = null
            element.classList.remove('battle-armed')
            element.setAttribute('aria-label', i18next.t('game.map.surrender'))
            if (said) said.textContent = i18next.t('game.map.surrenderShort')
          }, SURRENDER_ARMED_MS)
        })
      } else {
        element.setAttribute('aria-hidden', 'true')
      }
      // What is written over the sign: the cost of defending, or what a conquest took.
      const label = document.createElement('b')
      label.textContent = kind === 'surrender' ? i18next.t('game.map.surrenderShort') : text
      element.innerHTML =
        kind === 'defend'
          ? DEFEND_SIGN
          : kind === 'surrender'
            ? SURRENDER_SIGN
            : kind === 'repelled'
              ? REPELLED_SIGN
              : BATTLE_SIGN
      if (label.textContent !== '') element.prepend(label)
      // Above the figure of the resources, which stays readable under it.
      shown.set(
        sign,
        // The flag of the surrender stands beside the shield, not over it.
        new Marker({ element, anchor: 'bottom', offset: [kind === 'surrender' ? 54 : 0, -30] })
          .setLngLat([Number(lon), Number(lat)])
          .addTo(map),
      )
    }
  }, [battles, ready])
  // The bags of money: each stays the same element while it is there, so that the one
  // being dragged is not taken from under the finger when the resources move.
  const bagsRef = useRef(new Map<string, { marker: Marker; held: boolean }>())
  const onBagDropRef = useRef(onBagDrop)
  const onBagSplitRef = useRef(onBagSplit)
  useEffect(() => {
    onBagDropRef.current = onBagDrop
    onBagSplitRef.current = onBagSplit
  })
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const shown = bagsRef.current
    for (const [id, bag] of shown) {
      if (bags.some((wanted) => wanted.id === id)) continue
      bag.marker.remove()
      shown.delete(id)
    }
    for (const bag of bags) {
      let entry = shown.get(bag.id)
      if (!entry) {
        const element = document.createElement('div')
        element.innerHTML = `<b></b>${BAG_SIGN}<button type="button">+</button>`
        element.setAttribute('role', 'button')
        element.setAttribute('aria-label', i18next.t('game.map.bag'))
        element.title = i18next.t('game.map.bag')
        const marker = new Marker({ element, anchor: 'center', draggable: true })
          .setLngLat([bag.lon, bag.lat])
          .addTo(map)
        const made = { marker, held: false }
        entry = made
        shown.set(bag.id, made)
        // A press on a bag is not a press on the municipality under it.
        element.addEventListener('click', (event) => event.stopPropagation())
        const plus = element.querySelector('button')
        plus?.setAttribute('aria-label', i18next.t('game.map.bagSplit'))
        if (plus) plus.title = i18next.t('game.map.bagSplit')
        // The button splits: it must not begin a drag of the bag it is on.
        for (const type of ['mousedown', 'touchstart'] as const) {
          plus?.addEventListener(type, (event) => event.stopPropagation())
        }
        plus?.addEventListener('click', () => {
          const at = map.project(marker.getLngLat())
          // Beside it, on the side with more room.
          const side = at.x + BAG_APART + 24 < map.getContainer().clientWidth ? 1 : -1
          const here = map.unproject([at.x + BAG_APART * side, at.y])
          onBagSplitRef.current?.({ lon: here.lng, lat: here.lat })
        })
        marker.on('dragstart', () => {
          made.held = true
          element.classList.add('money-bag-held')
          // Let go outside the map (over a panel), the map never hears of it: told here.
          const release = () =>
            setTimeout(() => {
              if (!made.held) return
              map.fire('mouseup')
              map.fire('touchend')
            })
          window.addEventListener('mouseup', release, { once: true })
          window.addEventListener('touchend', release, { once: true })
        })
        marker.on('dragend', () => {
          made.held = false
          element.classList.remove('money-bag-held')
          const here = marker.getLngLat()
          const at = map.project(here)
          const onto = [...shown].find(([other, { marker: there }]) => {
            if (other === bag.id) return false
            const point = map.project(there.getLngLat())
            return Math.hypot(point.x - at.x, point.y - at.y) < BAG_MERGE
          })
          const under = map.queryRenderedFeatures(at, { layers: [FILL_LAYER] })[0]?.id
          onBagDropRef.current?.(
            bag.id,
            { lon: here.lng, lat: here.lat },
            onto?.[0] ?? null,
            typeof under === 'number' ? under : null,
          )
        })
      }
      const element = entry.marker.getElement()
      // One by one: the element also carries the classes the map places it by.
      element.classList.add('money-bag')
      element.classList.toggle('money-bag-idle', bag.idle)
      element.classList.toggle('money-bag-later', bag.later)
      element.classList.toggle('money-bag-whole', !bag.split)
      const label = element.querySelector('b')
      if (label) label.textContent = bag.text
      if (entry.held) continue
      // The one still waiting stands beside the capital, not over it.
      const at = map.project([bag.lon, bag.lat])
      entry.marker.setLngLat(bag.idle ? map.unproject([at.x + 44, at.y]) : [bag.lon, bag.lat])
    }
  }, [bags, ready])
  // Gone with the map.
  useEffect(() => {
    const shown = signsRef.current
    const carried = bagsRef.current
    return () => {
      for (const marker of shown.values()) marker.remove()
      shown.clear()
      for (const bag of carried.values()) bag.marker.remove()
      carried.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource<GeoJSONSource>(OWNERS_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: ownerTags.map((owner) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [owner.lon, owner.lat] },
        properties: { tag: owner.tag },
      })),
    })
  }, [ownerTags, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map
      .getSource<GeoJSONSource>(AREAS_SOURCE)
      ?.setData(areas ?? { type: 'FeatureCollection', features: [] })
  }, [areas, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map
      .getSource<GeoJSONSource>(FRONTS_SOURCE)
      ?.setData(fronts ?? { type: 'FeatureCollection', features: [] })
  }, [fronts, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource<GeoJSONSource>(OWN_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: outline ? [{ type: 'Feature', properties: {}, geometry: outline }] : [],
    })
  }, [outline, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource<GeoJSONSource>(RANGES_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: ranges.map((range) => ({
        type: 'Feature',
        properties: { kind: range.kind },
        geometry: { type: 'Polygon', coordinates: [circleAround(range)] },
      })),
    })
  }, [ranges, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (arcs.length > 0) ensureArrowIcon(map)
    map.getSource<GeoJSONSource>(ARCS_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: arcs.map((arc) => ({
        type: 'Feature',
        properties: { color: arc.color },
        geometry: { type: 'LineString', coordinates: curveBetween(arc.from, arc.to) },
      })),
    })
  }, [arcs, ready])

  // The anchored box follows the map; on a phone the sheet below is used instead.
  const anchored = anchor && anchor.id === selected?.id ? anchor.at : null
  const showPopup = Boolean(selected && renderInfo && anchored && !phone)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !showPopup || !anchored) {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    const popup =
      popupRef.current ??
      new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        maxWidth: '320px',
      })
        .setDOMContent(popupNode)
        .addTo(map)
    popup.setLngLat(anchored)
    popupRef.current = popup
  }, [anchored, popupNode, ready, showPopup])

  // Brings a point into view, for a municipality chosen from a list.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !focus) return
    map.easeTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 9) })
  }, [focus, ready])

  // A range that was asked for is shown whole: one wider than the view would not be seen.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !frame || frame.length === 0) return
    const ring = frame.flatMap((range) => circleAround(range, 24))
    const lons = ring.map(([lon]) => lon)
    const lats = ring.map(([, lat]) => lat)
    const west = Math.min(...lons)
    const east = Math.max(...lons)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    const view = map.getBounds()
    if (view.contains([west, south]) && view.contains([east, north])) return
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48 },
    )
  }, [frame, ready])

  const info = selected && renderInfo && (anchored || phone) ? renderInfo(selected) : null

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div ref={container} className="h-full w-full" />
      {info && !phone && createPortal(info, popupNode)}
      {info && phone && (
        <div className="animate-in bg-background slide-in-from-bottom-8 absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-xl p-4 duration-200">
          {info}
        </div>
      )}
    </div>
  )
}
