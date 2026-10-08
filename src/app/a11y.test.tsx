import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/test/a11y'
import { FakeMap, resetFakeMaplibre } from '@/test/fake-maplibre'
import { FakeWebSocket, guest, stubApi } from '@/test/fakes'
import { renderApp } from '@/test/render'

vi.mock('maplibre-gl', async () => {
  const fake = await import('@/test/fake-maplibre')
  return {
    Map: fake.FakeMap,
    Popup: fake.FakePopup,
    NavigationControl: fake.FakeNavigationControl,
    setWorkerUrl: fake.fakeSetWorkerUrl,
  }
})

beforeEach(() => {
  FakeWebSocket.install()
  resetFakeMaplibre()
})

const anna = { id: 'u1', username: 'anna', role: 'USER' }
const asAnna = { 'GET /api/auth/me': () => ({ body: anna }) }
const rules = { allianceMaxAllies: 2, boardMaxChars: 500 }
const empire = (id: string, name: string, color: string, capital: string) => ({
  id,
  name,
  color,
  emblem: 'torre',
  motto: null,
  status: 'ACTIVE',
  username: id,
  capitalTerritoryId: capital,
  units: 1,
})
const territory = (
  id: string,
  name: string,
  owner: string,
  unitId: number,
  resources: number | null,
) => ({
  id,
  name,
  ownerEmpireId: owner,
  geoUnitIds: [unitId],
  isArea: false,
  protected: false,
  resources,
  weight: resources === null ? null : 1,
  battleId: null,
  alert: false,
})
const state = {
  match: {
    id: 'm1',
    name: 'Milano e provincia',
    status: 'RUNNING',
    startAt: '2026-01-01T00:00:00.000Z',
    turnHours: 1,
    maxDays: 30,
    maxPlayers: 10,
    players: 2,
    currentTurn: 3,
    turnEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
    winnerEmpireId: null,
    winnerEmpireIds: [] as string[],
    owner: 'bruno',
    areas: [{ id: 'a1', name: 'Provincia di Milano' }],
    config: rules,
    isOwner: false,
  },
  me: {
    empireId: 'anna',
    annexLeft: 1,
    turnValue: 70,
    allocationMode: 'EQUAL',
    status: 'ACTIVE',
    capitalMoveInTurns: 0,
  },
  empires: [
    empire('bruno', 'Repubblica Ambrosiana', '#aa0000', 'tb'),
    empire('anna', 'Ducato del Ticino', '#00aa00', 'ta1'),
  ],
  territories: [
    territory('ta1', 'Milano', 'anna', 1, 200),
    territory('ta2', 'Monza', 'anna', 2, 100),
    territory('tb', 'Lodi', 'bruno', 9, null),
  ],
  online: { connected: 1, total: 2 },
  battles: [],
  structures: [],
  alliances: [],
  invites: [],
}
const matchRoutes = {
  ...asAnna,
  'GET /api/matches/m1/state': () => ({ body: state }),
  'GET /api/matches/m1/map': () => ({
    body: {
      id: 'm1',
      name: 'Milano e provincia',
      unitCount: 4,
      bounds: [8.7, 45.1, 9.6, 45.7],
      version: '4',
      tiles: '/api/matches/m1/tiles/{z}/{x}/{y}.mvt?v=4',
      minZoom: 4,
      maxZoom: 12,
      labelMinZoom: 9,
    },
  }),
  'GET /api/matches/m1/units': () => ({
    body: [
      { id: 1, name: 'Milano', lon: 9.19, lat: 45.46 },
      { id: 2, name: 'Monza', lon: 9.27, lat: 45.58 },
      { id: 9, name: 'Lodi', lon: 9.5, lat: 45.31 },
    ],
  }),
  'GET /api/matches/m1/history': () => ({ body: [{ turn: 2, closedAt: 'x', events: 0 }] }),
  'GET /api/matches/m1/structures/catalogue': () => ({ body: [] }),
}
async function loadedMap() {
  await waitFor(() => {
    if (FakeMap.instances.length === 0) throw new Error('no map yet')
  })
  act(() => FakeMap.latest.fire('load'))
}

describe('accessibility', () => {
  it('homepage, for a guest', async () => {
    stubApi({ ...guest })
    renderApp()
    await screen.findByText(/Non ci sono ancora partite/)
    await expectAccessible()
  })

  it('sign-in dialog', async () => {
    stubApi({ ...guest })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Accesso e registrazione' }))
    await screen.findByRole('dialog')
    await expectAccessible()
  })

  it('new match form', async () => {
    stubApi({ ...asAnna })
    renderApp('/partite/nuova')
    await screen.findByRole('heading', { name: 'Nuova partita' })
    await expectAccessible()
  })

  it('match page: menu, map and board', async () => {
    stubApi(matchRoutes)
    renderApp('/partite/m1')
    await loadedMap()
    await screen.findByRole('button', { name: 'Classifica' })
    await expectAccessible()
  })

  for (const page of [
    'La partita',
    'Classifica',
    'Scontri',
    'Storico dei turni',
    'Risorse per comune',
    'Unisci territori',
    'Costruzioni',
    'Alleanze',
  ]) {
    it(`match page: ${page}`, async () => {
      stubApi(matchRoutes)
      renderApp('/partite/m1')
      await loadedMap()
      // The menu entry: "Alleanze" is also the name of a view of the map.
      const entries = await screen.findAllByRole('button', { name: page })
      await userEvent.click(entries.at(-1)!)
      await screen.findByRole('button', { name: /menu/i })
      await expectAccessible()
    })
  }

  it('not found page', async () => {
    stubApi({ ...guest })
    renderApp('/nowhere')
    await screen.findByText('Pagina non trovata')
    await expectAccessible()
  })
})

describe('without a pointer or without telling colours apart', () => {
  it('skips the navbar with the first Tab', async () => {
    stubApi({ ...guest })
    renderApp()
    await screen.findByText(/Non ci sono ancora partite/)
    await userEvent.tab()
    const skip = screen.getByRole('link', { name: 'Vai al contenuto' })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#contenuto')
    expect(document.getElementById('contenuto')?.tagName).toBe('MAIN')
  })

  it('selects a municipality by typing its name', async () => {
    stubApi({
      ...matchRoutes,
      'GET /api/matches/m1/units/9': () => ({
        body: {
          geoUnitId: 9,
          name: 'Lodi',
          territory: {
            id: 'tb',
            name: 'Lodi',
            ownerEmpireId: 'bruno',
            resources: null,
            protected: false,
            inBattle: false,
          },
          neighbours: [],
          annex: null,
          attack: null,
        },
      }),
    })
    renderApp('/partite/m1')
    await loadedMap()

    const search = await screen.findByRole('searchbox', { name: 'Cerca un comune' })
    await userEvent.type(search, 'lo')
    expect(await screen.findByRole('status')).toHaveTextContent('1 comune trovato')
    const results = screen.getByRole('list', { name: 'Comuni trovati' })
    await userEvent.click(within(results).getByRole('button', { name: 'Lodi' }))

    // Its card opens and the map moves there, exactly as after a tap on the map.
    expect(await screen.findByRole('heading', { name: 'Lodi' })).toBeInTheDocument()
    await waitFor(() => expect(FakeMap.latest.state.get(9)?.selected).toBe(true))
  })

  it('writes the tag of the owner on every municipality, and next to the empire in the leaderboard', async () => {
    stubApi(matchRoutes)
    renderApp('/partite/m1')
    await loadedMap()
    const owners = () =>
      (
        FakeMap.latest.sourceData.get('owners') as {
          features: { properties: { tag: string }; geometry: { coordinates: number[] } }[]
        }
      ).features
    await waitFor(() => expect(owners()).toHaveLength(3))
    expect(
      owners()
        .map((owner) => owner.properties.tag)
        .sort(),
    ).toEqual(['DT', 'DT', 'RA'])

    await userEvent.click(await screen.findByRole('button', { name: 'Classifica' }))
    expect(screen.getByLabelText('sigla DT')).toHaveTextContent('DT')
    expect(screen.getByLabelText('sigla RA')).toHaveTextContent('RA')

    // The tags can be turned off, and the choice is remembered.
    await userEvent.click(screen.getByRole('button', { name: 'Sigle degli imperi' }))
    await waitFor(() => expect(owners()).toHaveLength(0))
    expect(localStorage.getItem('map.tags')).toBe('off')
    localStorage.removeItem('map.tags')
  })

  it('names the map for who reaches it with the keyboard', async () => {
    stubApi(matchRoutes)
    renderApp('/partite/m1')
    await loadedMap()
    expect(FakeMap.latest.getCanvas()).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^Mappa/),
    )
  })
})

describe('empire tags', () => {
  it('are the initials of the name, without the small words, and never repeat', async () => {
    const { empireTags } = await import('@/features/game/tags')
    const tags = empireTags([
      { id: 'a', name: 'Ducato del Ticino' },
      { id: 'b', name: 'Repubblica Ambrosiana' },
      { id: 'c', name: 'Dominio Toscano' },
      { id: 'd', name: 'Roma' },
      { id: 'e', name: "Lega dell'Adda e del Po" },
    ])
    expect([...tags.values()]).toEqual(['DT', 'RA', 'DT2', 'ROM', 'LAP'])
  })
})
