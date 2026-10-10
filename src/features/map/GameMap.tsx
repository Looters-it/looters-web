import i18next from 'i18next'
import {
  AttributionControl,
  Map as MapLibreMap,
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
import type { FeatureCollection } from 'geojson'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

import type { AreaMap } from './api'
import { diffFlags, diffState } from './feature-state'
import {
  ATTACK_LAYER,
  AREAS_SOURCE,
  ATTACKED_LAYER,
  buildStyle,
  EMPIRES_SOURCE,
  FILL_LAYER,
  MARKERS_SOURCE,
  OWNERS_SOURCE,
  UNITS_LAYER,
  UNITS_SOURCE,
} from './style'
import { capitalIconId, ensureCapitalIcons } from './capital-icon'
import { ensureShieldIcon, ensureSwordsIcon } from './shield-icon'
import { mapColors } from './theme'

export interface MapUnit {
  id: number
  name: string
}

/** A sign drawn on a municipality: the capital of an empire, or an accumulation alert. */
export interface MapMarker {
  id: string
  kind: 'capital' | 'second-capital' | 'alert' | 'block' | 'protected' | 'resources' | 'attack'
  lon: number
  lat: number
  /** Colour of the empire, for a capital. */
  color?: string
  /** For a capital: what is drawn on it, the emblem or the uploaded logo of the empire. */
  emblem?: string
  logo?: string | null
  /** Short text drawn on the sign: the turns a block still lasts, the resources of a territory. */
  text?: string
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

/** What is drawn on a capital, if the marker is one and says so. */
const armsOf = (marker: MapMarker) =>
  marker.kind === 'capital' && marker.color && marker.emblem
    ? { color: marker.color, emblem: marker.emblem, logo: marker.logo ?? null }
    : null
const NO_TAGS: readonly OwnerTag[] = []

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
  selected?: MapUnit | null
  highlightedIds?: readonly number[]
  /** Municipalities under attack, marked for everyone with a pulsing red border. */
  attackedIds?: readonly number[]
  onSelect?: (unit: MapUnit | null) => void
  /** Called with the id of a sign that works as a button (an attack sign) when it is pressed. */
  onMarker?: (id: string) => void
  /** Content of the box shown for the selected municipality. */
  renderInfo?: (unit: MapUnit) => ReactNode
  /** A point to bring into view when it changes. */
  focus?: { lon: number; lat: number } | null
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
  selected = null,
  highlightedIds = NO_IDS,
  attackedIds = NO_IDS,
  onSelect,
  onMarker,
  renderInfo,
  focus = null,
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

    map.on('mouseenter', ATTACK_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('click', (event) => {
      // A sign that is a button comes before the municipality under it.
      const sign = map.queryRenderedFeatures(event.point, { layers: [ATTACK_LAYER] })[0]
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
      onSelectRef.current?.({ id: feature.id, name: String(feature.properties.name ?? '') })
    })
    map.once('load', () => setReady(true))

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      mapRef.current = null
      setReady(false)
      map.remove()
    }
    // A different area (or a new version of its data) is a different map.
  }, [area, embedded, fitPadding, attribution])

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
