import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeMap, resetFakeMaplibre } from '@/test/fake-maplibre'

import type { AreaMap, UnitPoint } from './api'
import { demoEmpires } from './demo-empires'
import { diffFlags, diffState } from './feature-state'
import { GameMap, type MapUnit } from './GameMap'
import { buildStyle } from './style'
import { mapColors } from './theme'

vi.mock('maplibre-gl', async () => {
  const fake = await import('@/test/fake-maplibre')
  return {
    Map: fake.FakeMap,
    Popup: fake.FakePopup,
    NavigationControl: fake.FakeNavigationControl,
    setWorkerUrl: fake.fakeSetWorkerUrl,
  }
})

beforeEach(resetFakeMaplibre)

const area: AreaMap = {
  id: 'it',
  name: 'Italia',
  unitCount: 3,
  bounds: [6.6, 35.5, 18.5, 47.1],
  version: '3-3',
  tiles: '/api/geo/areas/it/tiles/{z}/{x}/{y}.mvt?v=3-3',
  minZoom: 4,
  maxZoom: 12,
  labelMinZoom: 9,
}

/** Renders the map and lets it finish loading. */
function renderMap(props: Partial<Parameters<typeof GameMap>[0]> = {}) {
  const view = render(<GameMap area={area} {...props} />)
  act(() => FakeMap.latest.fire('load'))
  return { map: FakeMap.latest, ...view }
}

describe('feature state diff', () => {
  it('reports only what changed between two assignments', () => {
    const before = new Map([
      [1, 'red'],
      [2, 'red'],
      [3, 'green'],
    ])
    const after = new Map([
      [1, 'red'],
      [2, 'green'],
      [4, 'blue'],
    ])
    expect(diffState(before, after)).toEqual({
      set: [
        [2, 'green'],
        [4, 'blue'],
      ],
      clear: [3],
    })
    expect(diffState(after, after)).toEqual({ set: [], clear: [] })
  })

  it('reports the flags to turn on and off', () => {
    expect(diffFlags(new Set([1, 2]), new Set([2, 3]))).toEqual({ on: [3], off: [1] })
  })
})

describe('map style', () => {
  const style = buildStyle(area, mapColors(), 'http://localhost')

  it('loads geometry as vector tiles bounded to the area', () => {
    expect(style.sources.units).toMatchObject({
      type: 'vector',
      tiles: ['http://localhost/api/geo/areas/it/tiles/{z}/{x}/{y}.mvt?v=3-3'],
      minzoom: 4,
      maxzoom: 12,
      bounds: area.bounds,
    })
  })

  it('names empires at low zoom and municipalities at high zoom', () => {
    const layer = (id: string) => style.layers.find((candidate) => candidate.id === id)
    expect(layer('empire-labels')).toMatchObject({ maxzoom: 9 })
    expect(layer('unit-labels')).toMatchObject({ minzoom: 9, 'source-layer': 'labels' })
  })

  it('draws labels with the fonts of the interface, served by the site itself', () => {
    expect(style.glyphs).toBeUndefined()
    expect(style['font-faces']).toEqual({
      'Sorts Mill Goudy': 'http://localhost/fonts/SortsMillGoudy-Regular.ttf',
      'Alfa Slab One': 'http://localhost/fonts/AlfaSlabOne-Regular.ttf',
    })
  })
})

describe('game map', () => {
  it('opens on the area and keeps the map flat and north-up', () => {
    const { map } = renderMap()
    expect(map.options).toMatchObject({ bounds: area.bounds, dragRotate: false })
  })

  it('asks for two-finger gestures only when embedded in a scrolling page', () => {
    expect(renderMap().map.options.cooperativeGestures).toBe(false)
    expect(renderMap({ embedded: true }).map.options.cooperativeGestures).toBe(true)
  })

  it('paints owners and then changes only the municipalities that changed', () => {
    const colors = new Map<number, string>(Array.from({ length: 8000 }, (_, i) => [i + 1, 'red']))
    const { map, rerender } = renderMap({ colors })
    expect(map.writes).toBe(8000)
    expect(map.state.get(42)).toEqual({ color: 'red' })

    // One annexation and one loss, out of 8,000 municipalities.
    const next = new Map(colors)
    next.set(42, 'green')
    next.delete(7)
    map.writes = 0
    rerender(<GameMap area={area} colors={next} />)

    expect(map.writes).toBe(2)
    expect(map.state.get(42)).toEqual({ color: 'green' })
    expect(map.state.get(7)).toEqual({})
    expect(FakeMap.instances).toHaveLength(1) // the map itself was not rebuilt
  })

  it('reports the municipality that was clicked, and null for empty map', () => {
    const selections: (MapUnit | null)[] = []
    const { map } = renderMap({ onSelect: (unit) => selections.push(unit) })

    act(() => map.click({ id: 15146, name: 'Milano' }))
    act(() => map.click())

    expect(selections).toEqual([{ id: 15146, name: 'Milano' }, null])
  })

  it('outlines the selection and lights up the highlighted municipalities', () => {
    const { map, rerender } = renderMap({
      selected: { id: 1, name: 'Milano' },
      highlightedIds: [2, 3],
    })
    expect(map.state.get(1)).toMatchObject({ selected: true })
    expect(map.state.get(2)).toMatchObject({ highlight: true })

    rerender(<GameMap area={area} selected={{ id: 2, name: 'Monza' }} highlightedIds={[3]} />)
    expect(map.state.get(1)).toMatchObject({ selected: false })
    expect(map.state.get(2)).toMatchObject({ selected: true, highlight: false })
    expect(map.state.get(3)).toMatchObject({ highlight: true })
  })

  it('shows the box of the selected municipality anchored where it was clicked', () => {
    const unit = { id: 1, name: 'Milano' }
    const { map, rerender } = renderMap()
    act(() => map.click(unit))
    rerender(<GameMap area={area} selected={unit} renderInfo={(u) => <p>Scheda di {u.name}</p>} />)

    expect(screen.getByText('Scheda di Milano')).toBeInTheDocument()

    rerender(<GameMap area={area} selected={null} renderInfo={(u) => <p>Scheda di {u.name}</p>} />)
    expect(screen.queryByText('Scheda di Milano')).not.toBeInTheDocument()
  })

  it('uses a sheet rising from the bottom on a phone', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const unit = { id: 1, name: 'Milano' }
    const { map, rerender, container } = renderMap()
    act(() => map.click(unit))
    rerender(<GameMap area={area} selected={unit} renderInfo={(u) => <p>Scheda di {u.name}</p>} />)

    // Inside the map frame, not in a popup attached to the document.
    expect(container).toContainElement(screen.getByText('Scheda di Milano'))
  })

  it('names the empires through a source that is replaced, not rebuilt', () => {
    const labels = [{ id: 'e1', name: 'Ducato di Prova', lon: 9.2, lat: 45.5, size: 12 }]
    const { map } = renderMap({ empireLabels: labels })
    expect(map.sourceData.get('empires')).toMatchObject({
      features: [
        {
          geometry: { type: 'Point', coordinates: [9.2, 45.5] },
          properties: { name: 'Ducato di Prova', size: 12 },
        },
      ],
    })
  })

  it('releases the map when it leaves the page', () => {
    const { map, unmount } = renderMap()
    unmount()
    expect(map.removed).toBe(true)
  })
})

describe('trial empires', () => {
  const units: UnitPoint[] = Array.from({ length: 400 }, (_, i) => ({
    id: i + 1,
    name: `Comune ${i + 1}`,
    lon: 9 + (i % 20) * 0.05,
    lat: 45 + Math.floor(i / 20) * 0.05,
  }))

  it('gives each empire the municipalities around its capital and is repeatable', () => {
    const first = demoEmpires(units, 10, ['a', 'b', 'c'])
    const second = demoEmpires(units, 10, ['a', 'b', 'c'])
    expect(first.labels).toHaveLength(10)
    expect([...first.colors]).toEqual([...second.colors])
    // Every capital belongs to its own empire, and sizes add up to the owned municipalities.
    for (const label of first.labels) expect(first.colors.has(Number(label.id))).toBe(true)
    expect(first.labels.reduce((sum, label) => sum + label.size, 0)).toBe(first.colors.size)
  })

  it('leaves far municipalities free', () => {
    const { colors } = demoEmpires(units, 1, ['a'], 0.1)
    expect(colors.size).toBeGreaterThan(0)
    expect(colors.size).toBeLessThan(units.length)
  })
})
