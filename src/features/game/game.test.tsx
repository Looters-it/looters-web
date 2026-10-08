import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeMap, resetFakeMaplibre } from '@/test/fake-maplibre'
import { FakeWebSocket, stubApi } from '@/test/fakes'
import { renderApp } from '@/test/render'

import { sameAmounts, setAmount, splitEqually, totalOf } from './allocation'
import { formatRemaining } from './remaining'

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

describe('resource allocation', () => {
  const amounts = { a: 100, b: 50, c: 0 }

  it('lets a territory rise only by what was freed from the others', () => {
    // Nothing is unallocated: raising a slider does nothing.
    expect(setAmount(amounts, 150, 'c', 40)).toEqual(amounts)
    // Lowering one frees resources…
    const lowered = setAmount(amounts, 150, 'a', 60)
    expect(lowered).toEqual({ a: 60, b: 50, c: 0 })
    expect(150 - totalOf(lowered)).toBe(40)
    // …that another can take, up to what is free.
    expect(setAmount(lowered, 150, 'c', 999)).toEqual({ a: 60, b: 50, c: 40 })
    expect(setAmount(lowered, 150, 'b', -5).b).toBe(0)
  })

  it('splits in equal parts and gives what is left over to the capital', () => {
    expect(splitEqually(['a', 'b', 'c'], 100, 'b')).toEqual({ a: 33, b: 34, c: 33 })
    expect(splitEqually(['a', 'b'], 7, null)).toEqual({ a: 4, b: 3 })
    expect(splitEqually([], 7, null)).toEqual({})
  })

  it('compares two allocations', () => {
    expect(sameAmounts(amounts, { ...amounts })).toBe(true)
    expect(sameAmounts(amounts, { ...amounts, c: 1 })).toBe(false)
  })
})

describe('countdown', () => {
  it('formats what is left, with days when needed, never below zero', () => {
    expect(formatRemaining(3_725_000)).toBe('01:02:05')
    expect(formatRemaining(90_061_000)).toBe('1g 01:01:01')
    expect(formatRemaining(-5000)).toBe('00:00:00')
  })
})

// ---------- A running match seen by Anna, who holds Milano (capital) and Monza ----------

const asAnna = {
  'GET /api/auth/me': () => ({ body: { id: 'u1', username: 'anna', role: 'USER' } }),
}
const rules = { minPlayersToStart: 2, lateJoin: true, annexCost: 50, annexPerTurn: 1 }

const empire = (
  id: string,
  name: string,
  username: string,
  color: string,
  capital: string,
  units: number,
) => ({
  id,
  name,
  color,
  emblem: 'torre',
  motto: null,
  status: 'ACTIVE',
  username,
  capitalTerritoryId: capital,
  units,
})
const territory = (
  id: string,
  name: string,
  owner: string,
  unitId: number,
  resources: number | null,
  extra = {},
) => ({
  id,
  name,
  ownerEmpireId: owner,
  geoUnitIds: [unitId],
  isArea: false,
  protected: false,
  resources,
  weight: resources === null ? null : 1,
  ...extra,
})

function running(territories: object[], me: object = {}, turn = 3) {
  return {
    match: {
      id: 'm1',
      name: 'Milano e provincia',
      status: 'RUNNING',
      startAt: new Date(Date.now() - 86_400_000).toISOString(),
      maxDays: null,
      maxPlayers: 100,
      turnHours: 24,
      currentTurn: turn,
      turnEndsAt: new Date(Date.now() + 3_725_000).toISOString(),
      players: 2,
      hasInviteCode: false,
      owner: 'bruno',
      areas: [{ id: 'a1', name: 'Provincia di Milano' }],
      config: rules,
      isOwner: false,
    },
    me: { empireId: 'anna', annexLeft: 1, turnValue: 70, allocationMode: 'EQUAL', ...me },
    empires: [
      empire('bruno', 'Repubblica Ambrosiana', 'bruno', '#aa0000', 'tb', 1),
      empire('anna', 'Ducato del Ticino', 'anna', '#00aa00', 'ta1', territories.length - 1),
    ],
    territories,
    online: { connected: 1, total: 2 },
  }
}
const mine = [
  territory('ta1', 'Milano', 'anna', 1, 200),
  territory('ta2', 'Monza', 'anna', 2, 100, { protected: true }),
  territory('tb', 'Lodi', 'bruno', 9, null),
]

const mapRoutes = {
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
      { id: 3, name: 'Sesto San Giovanni', lon: 9.23, lat: 45.53 },
    ],
  }),
}

async function loadedMap() {
  await waitFor(() => expect(FakeMap.instances.length).toBeGreaterThan(0))
  act(() => FakeMap.latest.fire('load'))
  return FakeMap.latest
}

describe('match bar', () => {
  it('shows connected players, turn, time left and the total of own resources', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(mine) }),
    })
    renderApp('/partite/m1')

    const bar = await screen.findByRole('banner')
    expect(await within(bar).findByText('1/2')).toBeInTheDocument()
    expect(within(bar).getByText('Turno').nextSibling).toHaveTextContent('3')
    expect(within(bar).getByText('Risorse').nextSibling).toHaveTextContent('300')
    expect(within(bar).getByLabelText('Tempo alla fine del turno')).toHaveTextContent(/^01:02:0\d$/)
    // The platform counter gives way to the match's own.
    expect(within(bar).queryByText(/giocator. conness/)).not.toBeInTheDocument()
  })

  it('follows the match on the socket and reads the state again when told', async () => {
    let state = running(mine)
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: state }),
    })
    renderApp('/partite/m1')
    await screen.findByRole('button', { name: 'Classifica' })

    const socket = FakeWebSocket.latest
    act(() => socket.open())
    expect(socket.sent).toContainEqual({ t: 'sub', matchId: 'm1' })

    act(() => socket.receive({ t: 'match.online', matchId: 'm1', connected: 2 }))
    expect(await screen.findByText('2/2')).toBeInTheDocument()

    // The turn closes on the server: a hint arrives, the page asks for the new state.
    state = running([territory('ta1', 'Milano', 'anna', 1, 235), ...mine.slice(1)], {}, 4)
    const before = calls.filter((call) => call.key === 'GET /api/matches/m1/state').length
    act(() => socket.receive({ t: 'match.update', matchId: 'm1', kinds: ['turn.closed'] }))

    const bar = screen.getByRole('banner')
    await waitFor(() => expect(within(bar).getByText('Turno').nextSibling).toHaveTextContent('4'))
    expect(within(bar).getByText('Risorse').nextSibling).toHaveTextContent('335')
    expect(calls.filter((call) => call.key === 'GET /api/matches/m1/state').length).toBe(before + 1)
  })
})

describe('panel menu', () => {
  it('opens an entry, hides the menu and comes back with "Menu"', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(mine) }),
    })
    renderApp('/partite/m1')

    await userEvent.click(await screen.findByRole('button', { name: 'Classifica' }))
    expect(screen.getByRole('heading', { name: 'Classifica' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Risorse per comune' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: 'Risorse per comune' })).toBeInTheDocument()
  })

  it('ranks the empires by municipalities and lights one on the map when pointed at', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(mine) }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Classifica' }))

    const cards = screen
      .getAllByRole('listitem')
      .filter((item) => item.textContent?.includes('comun'))
    expect(cards[0]).toHaveTextContent('1Ducato del Ticinoanna2 comuni')
    expect(cards[1]).toHaveTextContent('2Repubblica Ambrosianabruno1 comune')
    // Never a total of resources in the ranking.
    expect(screen.queryByText(/risorse/i, { selector: 'ol *' })).not.toBeInTheDocument()

    await userEvent.hover(cards[1]!)
    await waitFor(() => expect(map.state.get(9)).toMatchObject({ highlight: true }))
    await userEvent.unhover(cards[1]!)
    await waitFor(() => expect(map.state.get(9)).toMatchObject({ highlight: false }))
  })
})

describe('resources per municipality', () => {
  async function openResources(state = running(mine)) {
    let current = state
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: current }),
      'POST /api/matches/m1/allocate': (body) => {
        const { amounts } = body as { amounts: Record<string, number> }
        current = running(
          mine.map((t) => (t.id in amounts ? { ...t, resources: amounts[t.id] } : t)),
        )
        return { body: current }
      },
      'PUT /api/matches/m1/allocation-rule': (body) => {
        current = running(mine, { allocationMode: (body as { mode: string }).mode })
        return { body: current }
      },
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Risorse per comune' }))
    return calls
  }
  const figure = (label: string) => screen.getByText(label).nextSibling
  const slider = (name: string) => screen.getByRole('slider', { name: `Risorse a ${name}` })

  it('shows municipalities, total and unallocated, with one slider each', async () => {
    await openResources()
    expect(figure('Comuni')).toHaveTextContent('2')
    expect(figure('Risorse totali')).toHaveTextContent('300')
    expect(figure('Non allocate')).toHaveTextContent('0')
    expect(slider('Milano')).toHaveAttribute('aria-valuenow', '200')
    expect(slider('Monza')).toHaveAttribute('aria-valuenow', '100')
    // Only the player's own municipalities.
    expect(screen.queryByRole('slider', { name: 'Risorse a Lodi' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Applica' })).toBeDisabled()
  })

  it('frees resources by lowering a slider and applies only when all are assigned', async () => {
    const calls = await openResources()

    slider('Milano').focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(figure('Non allocate')).toHaveTextContent('3')
    expect(figure('Risorse totali')).toHaveTextContent('300') // the total never moves
    expect(screen.getByRole('button', { name: 'Applica' })).toBeDisabled()
    expect(
      screen.getByText('Assegna le 3 risorse rimaste per poter applicare.'),
    ).toBeInTheDocument()

    // Monza can take what was freed, and no more.
    slider('Monza').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(slider('Monza')).toHaveAttribute('aria-valuenow', '103')
    expect(figure('Non allocate')).toHaveTextContent('0')

    // Nothing has been sent yet.
    expect(calls.some((call) => call.key === 'POST /api/matches/m1/allocate')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Applica' }))
    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/allocate')?.body).toEqual({
        amounts: { ta1: 197, ta2: 103 },
        turn: 3,
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Applica' })).toBeDisabled())
    expect(slider('Milano')).toHaveAttribute('aria-valuenow', '197')
  })

  it('divides in equal parts and cancels back to what is saved', async () => {
    await openResources()
    await userEvent.click(screen.getByRole('button', { name: 'Dividi in parti uguali' }))
    expect(slider('Milano')).toHaveAttribute('aria-valuenow', '150')
    expect(slider('Monza')).toHaveAttribute('aria-valuenow', '150')
    expect(screen.getByRole('button', { name: 'Applica' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(slider('Milano')).toHaveAttribute('aria-valuenow', '200')
    expect(screen.getByRole('button', { name: 'Applica' })).toBeDisabled()
  })

  it('sets the rule that splits each turn income, weighing by what each holds now', async () => {
    const calls = await openResources()
    await userEvent.click(
      screen.getByRole('combobox', { name: /Guadagno di ogni turno \(ora 70\)/ }),
    )
    await userEvent.click(
      await screen.findByRole('option', { name: 'In proporzione alle risorse di adesso' }),
    )

    await waitFor(() =>
      expect(
        calls.find((call) => call.key === 'PUT /api/matches/m1/allocation-rule')?.body,
      ).toEqual({
        mode: 'WEIGHTED',
        weights: { ta1: 200, ta2: 100 },
      }),
    )
  })
})

describe('municipality card and annexation', () => {
  const sesto = (annex: object | null) => ({
    geoUnitId: 3,
    name: 'Sesto San Giovanni',
    territory: {
      id: 'ts',
      name: 'Sesto San Giovanni',
      ownerEmpireId: null,
      protected: false,
      inBattle: false,
      resources: null,
    },
    neighbours: [
      { geoUnitId: 1, name: 'Milano', territoryId: 'ta1', ownerEmpireId: 'anna' },
      { geoUnitId: 2, name: 'Monza', territoryId: 'ta2', ownerEmpireId: 'anna' },
      { geoUnitId: 9, name: 'Lodi', territoryId: 'tb', ownerEmpireId: 'bruno' },
    ],
    annex,
  })
  const milano = {
    geoUnitId: 1,
    name: 'Milano',
    territory: {
      id: 'ta1',
      name: 'Milano',
      ownerEmpireId: 'anna',
      protected: false,
      inBattle: false,
      resources: 200,
    },
    neighbours: [
      { geoUnitId: 3, name: 'Sesto San Giovanni', territoryId: 'ts', ownerEmpireId: null },
      { geoUnitId: 9, name: 'Lodi', territoryId: 'tb', ownerEmpireId: 'bruno' },
    ],
    annex: null,
  }
  const payers = [
    { territoryId: 'ta1', name: 'Milano', resources: 200, usable: true },
    { territoryId: 'ta2', name: 'Monza', resources: 100, usable: true },
  ]

  it('lights the free neighbours of an own municipality and opens them from the card', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(mine) }),
      'GET /api/matches/m1/units/1': () => ({ body: milano }),
      'GET /api/matches/m1/units/3': () => ({
        body: sesto({ cost: 50, left: 1, payFrom: payers }),
      }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()

    act(() => map.click({ id: 1, name: 'Milano' }))
    expect(await screen.findByRole('heading', { name: 'Milano', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText(/Stato: In pace · Capitale/)).toBeInTheDocument()
    // Sesto is free and adjacent: it can be annexed, so it is lit. Lodi is not.
    await waitFor(() => expect(map.state.get(3)).toMatchObject({ highlight: true }))
    expect(map.state.get(9)?.highlight).toBeFalsy()

    await userEvent.click(screen.getByRole('button', { name: /Sesto San Giovanni/ }))
    expect(await screen.findByRole('heading', { name: 'Sesto San Giovanni' })).toBeInTheDocument()
    expect(map.state.get(3)).toMatchObject({ selected: true })
    expect(map.easedTo).toMatchObject({ center: [9.23, 45.53] })
  })

  it('annexes a free municipality, paying from the chosen own neighbour', async () => {
    const after = running(
      [...mine, territory('ts', 'Sesto San Giovanni', 'anna', 3, 61, { protected: true })],
      { annexLeft: 0 },
    )
    let done = false
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: done ? after : running(mine) }),
      'GET /api/matches/m1/units/3': () => ({
        body: done
          ? {
              ...sesto(null),
              territory: {
                ...sesto(null).territory,
                ownerEmpireId: 'anna',
                resources: 61,
                protected: true,
              },
            }
          : sesto({ cost: 50, left: 1, payFrom: payers }),
      }),
      'POST /api/matches/m1/annex': () => {
        done = true
        return { body: after }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 3, name: 'Sesto San Giovanni' }))

    expect(
      await screen.findByText('Costa 50 risorse, pagate da un tuo comune confinante.'),
    ).toBeInTheDocument()
    // A free municipality never shows what it holds.
    expect(screen.queryByText(/Risorse: /)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Paga da' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Monza (100 risorse)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annetti' }))

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/annex')?.body).toEqual({
        geoUnitId: 3,
        payFromTerritoryId: 'ta2',
        turn: 3,
      }),
    )
    // The map takes the empire's colour, and the card now shows what was hidden.
    await waitFor(() => expect(map.state.get(3)).toMatchObject({ color: '#00aa00' }))
    // In the card of the panel and in the box anchored on the map.
    expect(await screen.findAllByText('Risorse: 61')).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Annetti' })).not.toBeInTheDocument()
  })

  it('says why an annexation is not possible', async () => {
    const cases: [object, string][] = [
      [{ cost: 50, left: 0, payFrom: payers }, 'Hai già usato le annessioni di questo turno.'],
      [
        { cost: 50, left: 1, payFrom: [] },
        'Non confina con nessun tuo comune: non puoi annetterlo.',
      ],
      [
        { cost: 50, left: 1, payFrom: [{ ...payers[0], resources: 20, usable: false }] },
        'Nessun tuo comune confinante ha 50 risorse.',
      ],
    ]
    for (const [annex, reason] of cases) {
      resetFakeMaplibre()
      stubApi({
        ...asAnna,
        ...mapRoutes,
        'GET /api/matches/m1/state': () => ({ body: running(mine) }),
        'GET /api/matches/m1/units/3': () => ({ body: sesto(annex) }),
      })
      const view = renderApp('/partite/m1')
      const map = await loadedMap()
      act(() => map.click({ id: 3, name: 'Sesto San Giovanni' }))

      expect(await screen.findByText(reason, { exact: false })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Annetti' })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})
