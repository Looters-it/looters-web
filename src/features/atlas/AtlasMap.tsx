import i18next from 'i18next'
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/features/map/map.css'
import type { FeatureCollection } from 'geojson'
import { useEffect, useRef, useState } from 'react'

import { BASE_TILES, EMPIRE_FONT } from '@/features/map/style'
import { mapColors } from '@/features/map/theme'
import { cn } from '@/lib/utils'

import type { AtlasArea } from './api'

setWorkerUrl(workerUrl)

const AREAS = 'areas'
const NAMES = 'names'
const FILL = 'areas-fill'

/**
 * The map of the atlas: each area drawn as one shape in its colour, with its name.
 * Only the outlines of the areas are loaded, never their municipalities. An area is
 * chosen by pressing it; the one that is chosen is brought into view.
 */
export function AtlasMap(props: {
  areas: readonly AtlasArea[]
  colors: ReadonlyMap<string, string>
  bounds: [number, number, number, number] | null
  chosenId: string | null
  onChoose: (id: string | null) => void
  className?: string
}) {
  const { areas, colors, bounds, chosenId, onChoose, className } = props
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const onChooseRef = useRef(onChoose)
  useEffect(() => {
    onChooseRef.current = onChoose
  })

  useEffect(() => {
    if (!container.current) return
    const theme = mapColors()
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    const map = new MapLibreMap({
      container: container.current,
      style: {
        version: 8,
        'font-faces': { [EMPIRE_FONT]: `${window.location.origin}/fonts/AlfaSlabOne-Regular.ttf` },
        sources: {
          base: {
            type: 'raster',
            tiles: [BASE_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          },
          // The id of a feature is its place in the list: feature state needs a number.
          [AREAS]: { type: 'geojson', data: empty },
          [NAMES]: { type: 'geojson', data: empty },
        },
        layers: [
          { id: 'ground', type: 'background', paint: { 'background-color': theme.ground } },
          {
            id: 'base',
            type: 'raster',
            source: 'base',
            paint: {
              'raster-saturation': -0.85,
              'raster-brightness-max': 0.5,
              'raster-opacity': 0.5,
              'raster-contrast': 0.1,
            },
          },
          {
            id: FILL,
            type: 'fill',
            source: AREAS,
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'chosen'], false],
                0.95,
                ['boolean', ['feature-state', 'hover'], false],
                0.9,
                0.75,
              ],
            },
          },
          {
            id: 'areas-border',
            type: 'line',
            source: AREAS,
            layout: { 'line-join': 'round' },
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'chosen'], false],
                theme.ink,
                theme.border,
              ],
              'line-width': ['case', ['boolean', ['feature-state', 'chosen'], false], 2.5, 0.8],
            },
          },
          {
            id: 'areas-names',
            type: 'symbol',
            source: NAMES,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': [EMPIRE_FONT],
              'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 14, 10, 18],
              'text-max-width': 7,
              // The larger areas are named first where names would overlap.
              'symbol-sort-key': ['-', ['get', 'size']],
            },
            paint: {
              'text-color': theme.ink,
              'text-halo-color': theme.halo,
              'text-halo-width': 1.6,
            },
          },
        ],
      },
      ...(bounds
        ? { bounds, fitBoundsOptions: { padding: 24 } }
        : { center: [12.5, 42] as [number, number], zoom: 5 }),
      minZoom: 2,
      maxZoom: 12,
      cooperativeGestures: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.getCanvas().setAttribute('aria-label', i18next.t('atlas.title'))
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    let hovered: number | null = null
    const setHover = (id: number | null) => {
      if (hovered === id) return
      if (hovered !== null) map.setFeatureState({ source: AREAS, id: hovered }, { hover: false })
      if (id !== null) map.setFeatureState({ source: AREAS, id }, { hover: true })
      hovered = id
      map.getCanvas().style.cursor = id === null ? '' : 'pointer'
    }
    map.on('mousemove', FILL, (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.id
      setHover(typeof id === 'number' ? id : null)
    })
    map.on('mouseleave', FILL, () => setHover(null))
    map.on('click', (event) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: [FILL] })[0]
      const areaId = feature?.properties.areaId as string | undefined
      onChooseRef.current(areaId ?? null)
    })
    map.once('load', () => setReady(true))
    return () => {
      mapRef.current = null
      setReady(false)
      map.remove()
    }
    // The map is built once: what it shows is written by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource<GeoJSONSource>(AREAS)?.setData({
      type: 'FeatureCollection',
      features: areas.map((area, index) => ({
        type: 'Feature',
        id: index,
        properties: { areaId: area.id, color: colors.get(area.id) ?? '#808080' },
        geometry: area.outline,
      })),
    })
    map.getSource<GeoJSONSource>(NAMES)?.setData({
      type: 'FeatureCollection',
      features: areas.map((area) => ({
        type: 'Feature',
        properties: { name: area.name, size: area.unitCount },
        geometry: { type: 'Point', coordinates: [area.lon, area.lat] },
      })),
    })
  }, [areas, colors, ready])

  // The chosen area is marked and brought into view; with none, the whole map is.
  const marked = useRef<number | null>(null)
  const moved = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const index = areas.findIndex((area) => area.id === chosenId)
    if (marked.current !== null) {
      map.setFeatureState({ source: AREAS, id: marked.current }, { chosen: false })
    }
    marked.current = index === -1 ? null : index
    if (index !== -1) map.setFeatureState({ source: AREAS, id: index }, { chosen: true })
    const target = areas[index]?.bounds ?? (moved.current ? bounds : null)
    moved.current = index !== -1
    if (target) map.fitBounds(target, { padding: 24 })
  }, [areas, bounds, chosenId, ready])

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div ref={container} className="h-full w-full" />
    </div>
  )
}
