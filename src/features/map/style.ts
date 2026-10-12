import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'

import type { AreaMap } from './api'
import {
  ANNEX_ICON,
  EXCLAVE_ICON,
  ISLAND_ICON,
  PORT_ICON,
  SHIELD_ICON,
  SWORDS_ICON,
} from './shield-icon'
import type { MapColors } from './theme'

export const UNITS_SOURCE = 'units'
export const UNITS_LAYER = 'units'
export const LABELS_LAYER = 'labels'
/** The islands and the exclaves: a point on each, at every zoom. */
export const MARKS_LAYER = 'marks'
/** From this zoom the sign of an island or an exclave is drawn on it. */
const MARKS_MIN_ZOOM = 6
export const EMPIRES_SOURCE = 'empires'
export const MARKERS_SOURCE = 'markers'
/** The signs of the territories that can be attacked: they are pressed like buttons. */
export const ATTACK_LAYER = 'attack-swords'
export const ANNEX_LAYER = 'annex-flags'
export const OWNERS_SOURCE = 'owners'
export const AREAS_SOURCE = 'areas'
/** The fronts of the open battles: the border between who attacks and who is attacked. */
export const FRONTS_SOURCE = 'fronts'
export const FILL_LAYER = 'units-fill'
export const ATTACKED_LAYER = 'units-attacked'

const UNIT_FONT = 'Sorts Mill Goudy'
export const EMPIRE_FONT = 'Alfa Slab One'
/** The red of a front: a plain, strong red, unlike the colour of any empire's fill. */
const FRONT_RED = '#e11d2e'
/** The figures of the resources: yellow like coins, edged in white to stand out on any empire. */
const RESOURCE_INK = '#f5b800'
const RESOURCE_EDGE = '#ffffff'
const GAIN_INK = '#1f9d55'
const LOSS_INK = '#e11d2e'

/** Below this zoom empires are named; from it on, municipalities are. */
export const EMPIRE_LABEL_MAX_ZOOM = 9

/**
 * Background tiles. The default is the public OpenStreetMap server, fine for
 * development; a production site must use its own tile provider
 * (https://operations.osmfoundation.org/policies/tiles/).
 */
export const BASE_TILES =
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
      [OWNERS_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [AREAS_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      [FRONTS_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': colors.ground } },
      {
        id: 'base',
        type: 'raster',
        source: 'base',
        // Dimmed and drained, so the map sinks into the dark page and the empires stand out.
        paint: {
          'raster-saturation': -0.85,
          'raster-brightness-max': 0.5,
          'raster-opacity': 0.5,
          'raster-contrast': 0.1,
        },
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
        // A merged area reads as one polygon: a heavy outline around all its municipalities.
        id: 'area-outlines',
        type: 'line',
        source: AREAS_SOURCE,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': colors.ink, 'line-width': 2.5 },
      },
      {
        // Where two territories are fighting: their shared border, thick and red, with an
        // edge of the map's own halo under it so that it stands out on any colour.
        id: 'front-edges',
        type: 'line',
        source: FRONTS_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': colors.halo,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 10, 9, 13, 12],
        },
      },
      {
        id: 'front-lines',
        type: 'line',
        source: FRONTS_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': FRONT_RED,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 10, 6, 13, 8],
        },
      },
      {
        id: 'area-labels',
        type: 'symbol',
        source: AREAS_SOURCE,
        minzoom: 7,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [EMPIRE_FONT],
          'text-size': 13,
          'text-max-width': 8,
        },
        paint: { 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 1.6 },
      },
      {
        // Second capital: a hollow ring in the empire's colour, distinct from the full disc of the capital.
        id: 'second-capital-markers',
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'second-capital'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 7],
          'circle-color': colors.halo,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 3.5,
        },
      },
      {
        // A port: an anchor beside the territory, top left, where nothing else is drawn.
        id: 'port-anchors',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'port'],
        layout: {
          'icon-image': PORT_ICON,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 10, 0.75, 14, 1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-translate': [-14, -14] },
      },
      {
        // Military block: a dark square-ish disc with the turns left written on it.
        id: 'block-discs',
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'block'],
        paint: {
          'circle-radius': 10,
          'circle-color': colors.ink,
          'circle-stroke-color': colors.halo,
          'circle-stroke-width': 1.5,
          'circle-translate': [-12, -12],
        },
      },
      {
        id: 'block-turns',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'block'],
        layout: {
          'text-field': ['get', 'text'],
          'text-font': [EMPIRE_FONT],
          'text-size': 12,
          'text-offset': [-1, -1],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': colors.halo },
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
        // The arms of the empire on its capital: emblem or uploaded logo, drawn over the
        // disc, which stays visible where the image is missing.
        id: 'capital-arms',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['all', ['==', ['get', 'kind'], 'capital'], ['!=', ['get', 'icon'], '']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 10, 0.8, 14, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      {
        // The resources of a territory, where the viewer may know them: a yellow figure
        // with a white edge, above the municipality.
        id: 'resource-figures',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'resources'],
        layout: {
          'text-field': ['get', 'text'],
          'text-font': [EMPIRE_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 14, 13, 17],
          'text-offset': [0, -1.5],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': RESOURCE_INK,
          'text-halo-color': RESOURCE_EDGE,
          'text-halo-width': 1.6,
        },
      },
      {
        // What a territory earned when the turn began: a green "+N" over its figure, for
        // a moment.
        id: 'resource-gains',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['in', ['get', 'kind'], ['literal', ['gain', 'loss']]],
        layout: {
          'text-field': ['get', 'text'],
          'text-font': [EMPIRE_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 17, 13, 21],
          'text-offset': [0, -2.7],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          // What it spent instead, in red.
          'text-color': ['case', ['==', ['get', 'kind'], 'loss'], LOSS_INK, GAIN_INK],
          'text-halo-color': RESOURCE_EDGE,
          'text-halo-width': 2,
        },
      },
      {
        // Can be annexed now: a flag beside the free municipality, pressed like a button.
        id: ANNEX_LAYER,
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'annex'],
        layout: {
          'icon-image': ANNEX_ICON,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.85, 14, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        // Beside the name of the municipality, not over it.
        paint: { 'icon-translate': [16, 14] },
      },
      {
        // Can be attacked now: crossed swords beside the municipality, bottom right. Drawn
        // large enough for a fingertip, and pressed like a button.
        id: ATTACK_LAYER,
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'attack'],
        layout: {
          'icon-image': SWORDS_ICON,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.85, 14, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-translate': [16, 14] },
      },
      {
        // Protected until the end of the turn: a shield beside the municipality, bottom left.
        id: 'protected-shields',
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['==', ['get', 'kind'], 'protected'],
        layout: {
          'icon-image': SHIELD_ICON,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.85, 14, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-translate': [-13, 13] },
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
        // The tag of the owning empire on its municipalities: who owns what can be read
        // without telling colours apart. Names and signs are placed first and win.
        id: 'owner-tags',
        type: 'symbol',
        source: OWNERS_SOURCE,
        layout: {
          'text-field': ['get', 'tag'],
          'text-font': [UNIT_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 9, 11, 13, 13],
          'text-offset': [0, 1.1],
          'text-padding': 6,
        },
        paint: { 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 1.4 },
      },
      {
        // Why a municipality has no neighbours: an island, or an exclave. Above its name,
        // drawn whatever else is there: it explains what the map cannot show.
        id: 'unit-marks',
        type: 'symbol',
        source: UNITS_SOURCE,
        'source-layer': MARKS_LAYER,
        minzoom: Math.max(area.minZoom, MARKS_MIN_ZOOM),
        layout: {
          'icon-image': ['match', ['get', 'kind'], 'exclave', EXCLAVE_ICON, ISLAND_ICON],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 0.65, 14, 0.85],
          'icon-offset': [0, -22],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
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
          // Under the capital, whose arms stay in view above the name.
          'text-anchor': 'top',
          'text-offset': [0, 0.9],
          // Larger empires win when names collide.
          'symbol-sort-key': ['-', ['get', 'size']],
        },
        paint: { 'text-color': colors.ink, 'text-halo-color': colors.halo, 'text-halo-width': 1.8 },
      },
    ],
  }
}
