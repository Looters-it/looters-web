import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'

import type { AreaMap } from './api'
import type { MapColors } from './theme'

export const UNITS_SOURCE = 'units'
export const UNITS_LAYER = 'units'
export const LABELS_LAYER = 'labels'
export const EMPIRES_SOURCE = 'empires'
export const MARKERS_SOURCE = 'markers'
export const FILL_LAYER = 'units-fill'
export const ATTACKED_LAYER = 'units-attacked'

const UNIT_FONT = 'Sorts Mill Goudy'
const EMPIRE_FONT = 'Alfa Slab One'

/** Below this zoom empires are named; from it on, municipalities are. */
export const EMPIRE_LABEL_MAX_ZOOM = 9

/**
 * Background tiles. The default is the public OpenStreetMap server, fine for
 * development; a production site must use its own tile provider
 * (https://operations.osmfoundation.org/policies/tiles/).
 */
const BASE_TILES =
  (import.meta.env.VITE_BASE_TILES_URL as string | undefined) ??
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const featureFlag = (name: string): ExpressionSpecification => [
  'boolean',
  ['feature-state', name],
  false,
]

/**
 * The whole map style. Geometry comes from vector tiles that know nothing
 * about matches: who owns what is feature state (`color`, `selected`,
 * `highlight`, `hover`), changed per municipality without reloading anything.
 */
export function buildStyle(area: AreaMap, colors: MapColors, origin: string): StyleSpecification {
  return {
    version: 8,
    // Labels are drawn from the same font files the interface uses.
    'font-faces': {
      [UNIT_FONT]: `${origin}/fonts/SortsMillGoudy-Regular.ttf`,
      [EMPIRE_FONT]: `${origin}/fonts/AlfaSlabOne-Regular.ttf`,
    },
    sources: {
      base: {
        type: 'raster',
        tiles: [BASE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
      [UNITS_SOURCE]: {
        type: 'vector',
        tiles: [`${origin}${area.tiles}`],
        minzoom: area.minZoom,
        maxzoom: area.maxZoom,
        ...(area.bounds ? { bounds: area.bounds } : {}),
      },
      [EMPIRES_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [MARKERS_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': colors.ground } },
      {
        id: 'base',
        type: 'raster',
        source: 'base',
        // Muted, so the map reads as part of the parchment and the empires stand out.
        paint: { 'raster-saturation': -0.75, 'raster-opacity': 0.7, 'raster-contrast': -0.1 },
      },
      {
        id: FILL_LAYER,
        type: 'fill',
        source: UNITS_SOURCE,
        'source-layer': UNITS_LAYER,
        paint: {
          'fill-color': ['coalesce', ['feature-state', 'color'], colors.free],
          // Owned municipalities are solid; free ones let the map show through.
          'fill-opacity': ['case', ['!=', ['feature-state', 'color'], null], 0.82, 0.3],
        },
      },
      {
        id: 'units-highlight',
        type: 'fill',
        source: UNITS_SOURCE,
        'source-layer': UNITS_LAYER,
        paint: {
          'fill-color': colors.highlight,
          'fill-opacity': ['case', featureFlag('highlight'), 0.5, featureFlag('hover'), 0.18, 0],
        },
      },
      {
        id: 'units-border',
        type: 'line',
        source: UNITS_SOURCE,
        'source-layer': UNITS_LAYER,
        paint: {
          'line-color': colors.border,
          'line-opacity': 0.7,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.15, 8, 0.5, 12, 1.2],
        },
      },
      {
        id: 'units-selected',
        type: 'line',
        source: UNITS_SOURCE,
        'source-layer': UNITS_LAYER,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': colors.selected,
          'line-width': ['case', featureFlag('selected'), 3, 0],
        },
      },
      {
        // A territory under attack: a red border, visible to everyone, that pulses
        // (the width is animated by the component unless motion is reduced).
        id: ATTACKED_LAYER,
        type: 'line',
        source: UNITS_SOURCE,
        'source-layer': UNITS_LAYER,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': colors.attacked,
          'line-width': ['case', featureFlag('attacked'), 3.5, 0],
          'line-dasharray': [2, 1.5],
        },
      },
      {
        // Capitals: a ringed disc in the empire's colour, always visible to everyone.
        id: 'capital-markers',
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'capital'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 8],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': colors.ink,
          'circle-stroke-width': 2.5,
        },
      },
      {
        // Accumulation alerts: a red disc with an exclamation mark, a shape and not just a colour.
        id: 'alert-discs',
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'alert'],
        paint: {
          'circle-radius': 9,
          'circle-color': colors.attacked,
          'circle-stroke-color': colors.halo,
          'circle-stroke-width': 1.5,
          'circle-translate': [12, -12],
        },
      },
      {
        id: 'alert-marks',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'alert'],
        layout: {
          'text-field': '!',
          'text-font': [EMPIRE_FONT],
          'text-size': 13,
          'text-offset': [0.92, -0.92],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': colors.halo },
      },
      {
        id: 'unit-labels',
        type: 'symbol',
        source: UNITS_SOURCE,
        'source-layer': LABELS_LAYER,
        minzoom: Math.max(area.labelMinZoom, EMPIRE_LABEL_MAX_ZOOM),
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [UNIT_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 16],
          'text-max-width': 7,
          // Larger municipalities win when names collide.
          'symbol-sort-key': ['-', ['get', 'area']],
        },
        paint: { 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'empire-labels',
        type: 'symbol',
        source: EMPIRES_SOURCE,
        maxzoom: EMPIRE_LABEL_MAX_ZOOM,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [EMPIRE_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 9, 17],
          'text-max-width': 8,
          // Larger empires win when names collide.
          'symbol-sort-key': ['-', ['get', 'size']],
        },
        paint: { 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 1.8 },
      },
    ],
  }
}
