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
  fallenTurn: null,
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
  battleId: null,
  alert: false,
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
      finishedAt: null,
      winnerEmpireId: null,
      players: 2,
      hasInviteCode: false,
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
      ...me,
    },
    empires: [
      empire('bruno', 'Repubblica Ambrosiana', 'bruno', '#aa0000', 'tb', 1),
      empire('anna', 'Ducato del Ticino', 'anna', '#00aa00', 'ta1', territories.length - 1),
    ],
    territories,
    online: { connected: 1, total: 2 },
    battles: [] as object[],
    structures: [] as object[],
    alliances: [] as object[],
    invites: [] as object[],
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
    expect(cards[0]).toHaveTextContent('1Ducato del TicinoDTanna2 comuni')
    expect(cards[1]).toHaveTextContent('2Repubblica AmbrosianaRAbruno1 comune')
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
    attack: null,
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
    attack: null,
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

// ---------- Battles ----------

describe('attack', () => {
  const lodi = (attack: object | null) => ({
    geoUnitId: 9,
    name: 'Lodi',
    territory: {
      id: 'tb',
      name: 'Lodi',
      ownerEmpireId: 'bruno',
      protected: false,
      inBattle: false,
      resources: null,
    },
    neighbours: [
      { geoUnitId: 1, name: 'Milano', territoryId: 'ta1', ownerEmpireId: 'anna' },
      { geoUnitId: 2, name: 'Monza', territoryId: 'ta2', ownerEmpireId: 'anna' },
    ],
    annex: null,
    attack,
  })
  const sources = [
    { territoryId: 'ta1', name: 'Milano', resources: 200, usable: true },
    { territoryId: 'ta2', name: 'Monza', resources: 100, usable: true },
  ]
  /** The api's answer for a set of territories: 50%, plus 10% for each further one. */
  const previewFor = (ids: string[]) => {
    const pct = 50 + 10 * (ids.length - 1)
    const from = sources
      .filter((source) => ids.includes(source.territoryId))
      .map((source) => ({ ...source, cost: Math.ceil((source.resources * pct) / 100) }))
    return {
      pct,
      totalCost: from.reduce((sum, source) => sum + source.cost, 0),
      force: from.reduce((sum, source) => sum + source.resources, 0),
      from,
    }
  }

  it('prepares an attack from one or more territories, chosen in the list or on the map', async () => {
    let declared = false
    const battle = {
      id: 'b1',
      turn: 3,
      status: 'OPEN',
      outcome: null,
      targetTerritoryId: 'tb',
      targetName: 'Lodi',
      attackerEmpireId: 'anna',
      defenderEmpireId: 'bruno',
      role: 'attacker',
      fromTerritoryIds: ['ta1', 'ta2'],
      attackCost: 180,
      attackForce: 300,
    }
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({
        body: declared ? { ...running(mine), battles: [battle] } : running(mine),
      }),
      'GET /api/matches/m1/units/9': () => ({ body: lodi({ blocked: null, from: sources }) }),
      'POST /api/matches/m1/attacks/preview': (body) => ({
        body: previewFor((body as { fromTerritoryIds: string[] }).fromTerritoryIds),
      }),
      'POST /api/matches/m1/attacks': () => {
        declared = true
        return { status: 201, body: { ...running(mine), battles: [battle] } }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 9, name: 'Lodi' }))

    // The card of an enemy municipality never shows what it holds.
    expect(await screen.findAllByText('Risorse: nascoste')).not.toHaveLength(0)
    await userEvent.click(await screen.findByRole('button', { name: 'Prepara attacco' }))
    expect(screen.getByRole('heading', { name: 'Attacco a Lodi' })).toBeInTheDocument()

    // The strongest territory is proposed: strength 200, half of it as cost.
    expect(screen.getByRole('checkbox', { name: /Milano \(200 risorse\)/ })).toBeChecked()
    const figure = (label: string) => screen.getByText(label).nextSibling
    await waitFor(() => expect(figure('Forza in campo')).toHaveTextContent('200'))
    expect(figure('Costo totale')).toHaveTextContent('100')
    // The territories that can join are lit on the map.
    await waitFor(() => expect(map.state.get(2)).toMatchObject({ highlight: true }))

    // Tapping Monza on the map adds it: more strength, a higher share for each.
    act(() => map.click({ id: 2, name: 'Monza' }))
    await waitFor(() => expect(figure('Forza in campo')).toHaveTextContent('300'))
    expect(figure('Quota pagata da ogni comune')).toHaveTextContent('60%')
    expect(figure('Costo totale')).toHaveTextContent('180')
    expect(screen.getByRole('checkbox', { name: /Monza/ })).toBeChecked()
    // No chance of victory: the enemy's resources are hidden.
    expect(screen.getByText(/Le risorse del nemico sono nascoste/)).toBeInTheDocument()
    expect(screen.queryByText(/probabilit/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: "Dichiara l'attacco" }))
    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/attacks')?.body).toEqual({
        targetGeoUnitId: 9,
        fromTerritoryIds: ['ta1', 'ta2'],
        turn: 3,
      }),
    )
    // The attacked municipality is marked on the map.
    await waitFor(() => expect(map.state.get(9)).toMatchObject({ attacked: true }))
  })

  it('says why a territory cannot be attacked', async () => {
    const cases: [object, string][] = [
      [{ blocked: 'PROTECTED', from: sources }, 'è protetto fino alla fine del turno'],
      [{ blocked: 'IN_BATTLE', from: sources }, 'è già coinvolto in uno scontro'],
      [
        { blocked: 'NOT_ADJACENT', from: [] },
        'Non confina con nessun tuo comune: non puoi attaccarlo.',
      ],
      [
        { blocked: null, from: [{ ...sources[0], resources: 0, usable: false }] },
        'Nessun tuo comune confinante può attaccare',
      ],
    ]
    for (const [attack, reason] of cases) {
      resetFakeMaplibre()
      stubApi({
        ...asAnna,
        ...mapRoutes,
        'GET /api/matches/m1/state': () => ({ body: running(mine) }),
        'GET /api/matches/m1/units/9': () => ({ body: lodi(attack) }),
      })
      const view = renderApp('/partite/m1')
      const map = await loadedMap()
      act(() => map.click({ id: 9, name: 'Lodi' }))

      expect(await screen.findByText(reason, { exact: false })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Prepara attacco' })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})

describe('answering an attack', () => {
  const incoming = (extra: object = {}) => ({
    id: 'b7',
    turn: 3,
    status: 'OPEN',
    outcome: null,
    targetTerritoryId: 'ta2',
    targetName: 'Monza',
    attackerEmpireId: 'bruno',
    defenderEmpireId: 'anna',
    role: 'defender',
    response: null,
    defenseForce: 100,
    defenseCost: 50,
    ...extra,
  })
  const attackedState = (battle: object) => ({
    ...running(mine.map((t) => (t.id === 'ta2' ? { ...t, battleId: 'b7' } : t))),
    battles: [battle],
  })

  it('raises a red alert in the navbar and answers in a dialog, where the outcome is read', async () => {
    let battle: object = incoming()
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: attackedState(battle) }),
      'POST /api/matches/m1/battles/b7/respond': () => {
        battle = incoming({ response: 'DEFEND' })
        return { body: attackedState(battle) }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()

    const alert = await within(await screen.findByRole('banner')).findByRole('button', {
      name: 'Sotto attacco',
    })
    await waitFor(() => expect(map.state.get(2)).toMatchObject({ attacked: true }))
    await userEvent.click(alert)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Repubblica Ambrosiana attacca Monza')
    expect(within(dialog).getByText('Risorse nel comune').nextSibling).toHaveTextContent('100')
    expect(within(dialog).getByText('Costo della difesa').nextSibling).toHaveTextContent('50')
    // Nothing about the attacker's strength.
    expect(dialog).not.toHaveTextContent(/forza/i)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Difenditi' }))
    await waitFor(() =>
      expect(
        calls.find((call) => call.key === 'POST /api/matches/m1/battles/b7/respond')?.body,
      ).toEqual({
        action: 'DEFEND',
      }),
    )
    expect(await within(dialog).findByText(/In attesa dell'esito/)).toBeInTheDocument()
    // Answered: the alert is gone, the dialog stays for the outcome.
    // (While a dialog is open the rest of the page is hidden from assistive technology.)
    expect(
      screen.queryByRole('button', { name: 'Sotto attacco', hidden: true }),
    ).not.toBeInTheDocument()

    // jobs resolves the battle and the server says so.
    battle = incoming({ response: 'DEFEND', status: 'RESOLVED', outcome: 'DEFENDER_WON' })
    act(() => {
      FakeWebSocket.latest.open()
      FakeWebSocket.latest.receive({ t: 'match.update', matchId: 'm1', kinds: ['battle.resolved'] })
    })
    expect(await within(dialog).findByText('Hai difeso Monza.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('surrenders, and warns when the capital is at stake', async () => {
    let battle: object = incoming({
      targetTerritoryId: 'ta1',
      targetName: 'Milano',
      defenseForce: 200,
      defenseCost: 100,
    })
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: attackedState(battle) }),
      'POST /api/matches/m1/battles/b7/respond': () => {
        battle = { ...battle, response: 'SURRENDER', status: 'RESOLVED', outcome: 'SURRENDER' }
        return { body: attackedState(battle) }
      },
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Sotto attacco' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('È la tua capitale: se la perdi, il tuo impero cade.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Arrenditi' }))

    expect(await within(dialog).findByText('Hai ceduto Milano.')).toBeInTheDocument()
    expect(
      calls.find((call) => call.key === 'POST /api/matches/m1/battles/b7/respond')?.body,
    ).toEqual({
      action: 'SURRENDER',
    })
  })

  it('locks the resources of a municipality in a battle', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: attackedState(incoming()) }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Risorse per comune' }))

    expect(screen.getByText(/bloccato: in uno scontro/)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Risorse a Monza' })).toHaveAttribute('data-disabled')
    expect(screen.getByRole('slider', { name: 'Risorse a Milano' })).not.toHaveAttribute(
      'data-disabled',
    )
  })

  it('lists the battles in progress and the latest outcomes', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({
        body: {
          ...running(mine),
          battles: [
            incoming(),
            {
              id: 'b8',
              turn: 3,
              status: 'OPEN',
              outcome: null,
              targetTerritoryId: 'tb',
              targetName: 'Lodi',
              attackerEmpireId: 'anna',
              defenderEmpireId: 'bruno',
              role: 'attacker',
              fromTerritoryIds: ['ta1'],
              attackCost: 100,
              attackForce: 200,
            },
            {
              ...incoming(),
              id: 'b6',
              status: 'RESOLVED',
              outcome: 'ATTACKER_WON',
              role: 'attacker',
              targetName: 'Crema',
            },
          ],
        },
      }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Scontri' }))

    expect(screen.getByText('Repubblica Ambrosiana attacca Monza')).toBeInTheDocument()
    expect(screen.getByText('Attacchi Lodi (Repubblica Ambrosiana)')).toBeInTheDocument()
    expect(screen.getByText(/Hai impegnato 100 risorse/)).toBeInTheDocument()
    expect(screen.getByText('Hai conquistato Crema.')).toBeInTheDocument()

    // "Rispondi" opens the same dialog as the alert.
    await userEvent.click(screen.getByRole('button', { name: 'Rispondi' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Repubblica Ambrosiana attacca Monza',
    )
  })
})

// ---------- Capital, fall and end of the match ----------

describe('capital and end of the match', () => {
  const monza = {
    geoUnitId: 2,
    name: 'Monza',
    territory: {
      id: 'ta2',
      name: 'Monza',
      ownerEmpireId: 'anna',
      protected: false,
      inBattle: false,
      resources: 100,
    },
    neighbours: [],
    annex: null,
    attack: null,
  }

  it('marks capitals and accumulation alerts on the map', async () => {
    const withAlert = mine.map((t) => (t.id === 'ta2' ? { ...t, alert: true } : t))
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(withAlert) }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()

    await waitFor(() =>
      expect(map.sourceData.get('markers')).toMatchObject({
        features: [
          // Anna's capital, Milano, in her colour.
          {
            geometry: { coordinates: [9.19, 45.46] },
            properties: { kind: 'capital', color: '#00aa00' },
          },
          { geometry: { coordinates: [9.27, 45.58] }, properties: { kind: 'alert' } },
        ],
      }),
    )
  })

  it('moves the capital to another own municipality', async () => {
    let moved = false
    const after = () => {
      const state = running(mine, { capitalMoveInTurns: 3 })
      state.empires[1]!.capitalTerritoryId = 'ta2'
      return state
    }
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: moved ? after() : running(mine) }),
      'GET /api/matches/m1/units/2': () => ({ body: monza }),
      'POST /api/matches/m1/capital': () => {
        moved = true
        return { body: after() }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 2, name: 'Monza' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Sposta qui la capitale' }))
    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/capital')?.body).toEqual({
        territoryId: 'ta2',
        turn: 3,
      }),
    )
    // Now it is the capital, and the next move has to wait.
    expect(
      await screen.findByText('Se la capitale viene conquistata, il tuo impero cade.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sposta qui la capitale' })).not.toBeInTheDocument()
  })

  it('says how long to wait before the capital can move again', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: running(mine, { capitalMoveInTurns: 2 }) }),
      'GET /api/matches/m1/units/2': () => ({ body: monza }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 2, name: 'Monza' }))

    expect(await screen.findByText('Potrai spostare la capitale tra 2 turni.')).toBeInTheDocument()
  })

  it('turns the player of a fallen empire into a spectator', async () => {
    const state = running([mine[2]!], { status: 'FALLEN' })
    state.empires[1] = {
      ...state.empires[1]!,
      status: 'FALLEN',
      capitalTerritoryId: null as never,
      units: 0,
      fallenTurn: 2 as never,
    }
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: state }),
      'GET /api/matches/m1/units/9': () => ({
        body: {
          ...monza,
          geoUnitId: 9,
          name: 'Lodi',
          territory: { ...monza.territory, id: 'tb', ownerEmpireId: 'bruno', resources: null },
        },
      }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()

    expect(
      await screen.findByText('Il tuo impero è caduto. Resti nella partita come spettatore.'),
    ).toBeInTheDocument()
    // A spectator can look, not act.
    act(() => map.click({ id: 9, name: 'Lodi' }))
    expect(await screen.findByRole('heading', { name: 'Lodi', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prepara attacco' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'Classifica' }))
    expect(screen.getByText(/caduto al turno 2/)).toBeInTheDocument()
  })

  it('announces the winner and reveals the resources of every empire when the match is over', async () => {
    const state = running(mine)
    state.match = {
      ...state.match,
      status: 'FINISHED',
      winnerEmpireId: 'anna' as never,
      finishedAt: new Date().toISOString() as never,
    }
    state.empires = [
      { ...state.empires[0]!, resources: 410 } as never,
      { ...state.empires[1]!, resources: 300 } as never,
    ]
    stubApi({ ...asAnna, ...mapRoutes, 'GET /api/matches/m1/state': () => ({ body: state }) })
    renderApp('/partite/m1')

    expect(await screen.findByText(/Partita conclusa\. Hai vinto!/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Classifica' }))
    expect(screen.getByText('vincitore')).toBeInTheDocument()
    expect(screen.getByText(/300 risorse/)).toBeInTheDocument()
    expect(screen.getByText(/410 risorse/)).toBeInTheDocument()
  })
})

// ---------- Structures and merged areas ----------

describe('structures', () => {
  const catalogue = [
    {
      type: 'BLOCK',
      cost: 300,
      durationTurns: 5,
      cooldownTurns: 5,
      effects: ['NO_ATTACK_ON', 'NO_ATTACK_FROM'],
      sites: [
        { territoryId: 'ta1', name: 'Milano', resources: 200, blocked: 'NOT_ENOUGH_RESOURCES' },
        { territoryId: 'ta2', name: 'Monza', resources: 400, blocked: null },
      ],
    },
    {
      type: 'SECOND_CAPITAL',
      cost: 1400,
      durationTurns: null,
      cooldownTurns: 0,
      effects: ['BACKUP_CAPITAL'],
      sites: [
        { territoryId: 'ta1', name: 'Milano', resources: 200, blocked: 'ON_CAPITAL' },
        { territoryId: 'ta2', name: 'Monza', resources: 400, blocked: 'NOT_ENOUGH_RESOURCES' },
      ],
    },
    // A structure the interface has never heard of still shows up, by its key.
    {
      type: 'WATCHTOWER',
      cost: 140,
      durationTurns: 2,
      cooldownTurns: 0,
      effects: ['NO_ATTACK_ON'],
      sites: [],
    },
  ]
  const block = {
    id: 's1',
    type: 'BLOCK',
    territoryId: 'ta2',
    empireId: 'anna',
    effects: ['NO_ATTACK_ON', 'NO_ATTACK_FROM'],
    turnsLeft: 5,
  }

  it('lists the catalogue as cards and builds on the municipality chosen in the list or on the map', async () => {
    let built = false
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({
        body: built ? { ...running(mine), structures: [block] } : running(mine),
      }),
      'GET /api/matches/m1/structures/catalogue': () => ({ body: catalogue }),
      'POST /api/matches/m1/structures': () => {
        built = true
        return { status: 201, body: { ...running(mine), structures: [block] } }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Costruzioni' }))

    const cards = await screen.findAllByRole('listitem')
    const blockCard = cards.find((card) =>
      within(card).queryByRole('heading', { name: 'Blocco militare' }),
    )!
    expect(blockCard).toHaveTextContent('Costo: 300 risorse')
    expect(blockCard).toHaveTextContent('Per 5 turni il comune non può essere attaccato')
    expect(screen.getByRole('heading', { name: 'Seconda capitale' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'WATCHTOWER' })).toBeInTheDocument()
    expect(within(blockCard).getByRole('button', { name: 'Costruisci' })).toBeDisabled()

    // Choosing a municipality that cannot afford it says why.
    await userEvent.click(within(blockCard).getByRole('combobox', { name: 'Dove' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Milano (200 risorse)' }))
    expect(within(blockCard).getByText('Il comune non ha abbastanza risorse.')).toBeInTheDocument()
    expect(within(blockCard).getByRole('button', { name: 'Costruisci' })).toBeDisabled()

    // Tapping Monza on the map chooses it for the card being used.
    act(() => map.click({ id: 2, name: 'Monza' }))
    await waitFor(() =>
      expect(within(blockCard).getByRole('button', { name: 'Costruisci' })).toBeEnabled(),
    )
    await userEvent.click(within(blockCard).getByRole('button', { name: 'Costruisci' }))

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/structures')?.body).toEqual({
        type: 'BLOCK',
        territoryId: 'ta2',
        turn: 3,
      }),
    )
    expect(await screen.findByText('Blocco militare a Monza')).toBeInTheDocument()
    expect(screen.getByText('ancora 5 turni')).toBeInTheDocument()
    // The block is drawn on the map with the turns it still lasts.
    await waitFor(() =>
      expect(JSON.stringify(map.sourceData.get('markers'))).toContain(
        '"kind":"block","color":"","text":"5"',
      ),
    )
  })

  it('says that a blocked municipality cannot be attacked', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({
        body: {
          ...running(mine),
          structures: [{ ...block, territoryId: 'tb', empireId: 'bruno' }],
        },
      }),
      'GET /api/matches/m1/units/9': () => ({
        body: {
          geoUnitId: 9,
          name: 'Lodi',
          territory: {
            id: 'tb',
            name: 'Lodi',
            ownerEmpireId: 'bruno',
            protected: false,
            inBattle: false,
            resources: null,
          },
          neighbours: [],
          annex: null,
          attack: { blocked: 'BLOCKED', from: [] },
        },
      }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 9, name: 'Lodi' }))

    expect(await screen.findByText(/Un blocco militare protegge questo comune/)).toBeInTheDocument()
    expect(screen.getByText('Costruzioni presenti: Blocco militare')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prepara attacco' })).not.toBeInTheDocument()
  })
})

describe('merging territories', () => {
  const three = [
    ...mine.slice(0, 2),
    territory('ta3', 'Sesto San Giovanni', 'anna', 3, 80),
    mine[2]!,
  ]
  const previews: Record<string, object> = {
    '': { perTerritory: 40, cost: 0, available: 0, maxUnits: 5, problem: 'TOO_FEW' },
    ta2: { perTerritory: 40, cost: 40, available: 100, maxUnits: 5, problem: 'TOO_FEW' },
    'ta2,ta3': { perTerritory: 40, cost: 80, available: 180, maxUnits: 5, problem: null },
    'ta1,ta2,ta3': {
      perTerritory: 40,
      cost: 120,
      available: 380,
      maxUnits: 5,
      problem: 'NOT_CONTIGUOUS',
    },
  }
  const area = {
    ...territory('ta2', 'Brianza Unita', 'anna', 2, 100),
    geoUnitIds: [2, 3],
    isArea: true,
  }

  it('chooses the municipalities in the list or on the map, shows the cost and merges them', async () => {
    let merged = false
    const after = () => running([mine[0]!, area, mine[2]!])
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: merged ? after() : running(three) }),
      'POST /api/matches/m1/merge/preview': (body) => ({
        body: previews[[...(body as { territoryIds: string[] }).territoryIds].sort().join(',')],
      }),
      'POST /api/matches/m1/merge': () => {
        merged = true
        return { status: 201, body: after() }
      },
      'GET /api/matches/m1/areas': () => ({
        body: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'ta2',
              geometry: { type: 'Polygon', coordinates: [] },
              properties: { name: 'Brianza Unita', ownerEmpireId: 'anna', lon: 9.25, lat: 45.55 },
            },
          ],
        },
      }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Unisci territori' }))

    // The pages of the empire share a bar with their three links.
    expect(screen.getByRole('button', { name: 'Unisci territori' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Costruzioni' })).toBeInTheDocument()
    expect(await screen.findByText('Scegli almeno due comuni.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unisci' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /Monza/ }))
    // Tapping an own municipality on the map adds it.
    act(() => map.click({ id: 3, name: 'Sesto San Giovanni' }))
    expect(screen.getByRole('checkbox', { name: /Sesto San Giovanni/ })).toBeChecked()
    const figure = (label: string) => screen.getByText(label).nextSibling
    await waitFor(() => expect(figure('Costo totale')).toHaveTextContent('80'))
    expect(figure('Costo per comune')).toHaveTextContent('40')

    // A third one that does not touch the others: the reason is written.
    await userEvent.click(screen.getByRole('checkbox', { name: /Milano/ }))
    expect(
      await screen.findByText('I comuni scelti non sono tutti confinanti tra loro.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unisci' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Milano/ }))

    await userEvent.type(screen.getByLabelText("Nome dell'area"), 'Brianza Unita')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unisci' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Unisci' }))

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/merge')?.body).toEqual({
        territoryIds: ['ta2', 'ta3'],
        name: 'Brianza Unita',
        turn: 3,
      }),
    )
    expect(await screen.findByText('Brianza Unita (2 comuni)')).toBeInTheDocument()
    // The area is drawn as one polygon with its name.
    await waitFor(() =>
      expect(map.sourceData.get('areas')).toMatchObject({
        features: [{ properties: { name: 'Brianza Unita' } }],
      }),
    )
  })

  it('renames an area from its card', async () => {
    let name = 'Brianza Unita'
    const current = () => running([mine[0]!, { ...area, name }, mine[2]!])
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      'GET /api/matches/m1/state': () => ({ body: current() }),
      'GET /api/matches/m1/areas': () => ({ body: { type: 'FeatureCollection', features: [] } }),
      'GET /api/matches/m1/units/3': () => ({
        body: {
          geoUnitId: 3,
          name: 'Sesto San Giovanni',
          territory: {
            id: 'ta2',
            name,
            ownerEmpireId: 'anna',
            protected: false,
            inBattle: false,
            resources: 100,
          },
          neighbours: [],
          annex: null,
          attack: null,
        },
      }),
      'PATCH /api/matches/m1/territories/ta2': (body) => {
        name = (body as { name: string }).name
        return { body: current() }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 3, name: 'Sesto San Giovanni' }))

    expect(
      await screen.findByText(/Fa parte dell'area Brianza Unita\. Area di 2 comuni/),
    ).toBeInTheDocument()
    const input = screen.getByLabelText("Nome dell'area")
    await userEvent.clear(input)
    await userEvent.type(input, 'Contado di Monza')
    await userEvent.click(screen.getByRole('button', { name: 'Rinomina' }))

    await waitFor(() =>
      expect(
        calls.find((call) => call.key === 'PATCH /api/matches/m1/territories/ta2')?.body,
      ).toEqual({
        name: 'Contado di Monza',
      }),
    )
    expect(await screen.findByText(/Fa parte dell'area Contado di Monza/)).toBeInTheDocument()
  })
})

// ---------- Board ----------

describe('board', () => {
  const entry = (id: string, type: string, data: object, extra: object = {}) => ({
    id,
    type,
    turn: 3,
    createdAt: `2026-10-08T10:00:0${id.slice(-1)}.000Z`,
    empireId: 'bruno',
    territoryId: null,
    geoUnitId: null,
    data,
    ...extra,
  })
  const entries = [
    entry('e4', 'MESSAGE', {
      empireName: 'Repubblica Ambrosiana',
      text: 'Di qua dal fiume non si passa.',
    }),
    entry(
      'e3',
      'BATTLE_RESOLVED',
      {
        attackerName: 'Ducato del Ticino',
        defenderName: 'Repubblica Ambrosiana',
        territoryName: 'Lodi',
        outcome: 'DEFENDER_WON',
        defenderEmpireId: 'bruno',
      },
      { empireId: 'anna', territoryId: 'tb', geoUnitId: 9 },
    ),
    entry(
      'e2',
      'ANNEXED',
      { empireName: 'Ducato del Ticino', territoryName: 'Monza' },
      { empireId: 'anna', territoryId: 'ta2', geoUnitId: 2 },
    ),
    entry('e1', 'EMPIRE_FALLEN', {
      empireName: 'Contea di Rho',
      byEmpireName: 'Ducato del Ticino',
    }),
  ]
  const boardOf = (state: object, list: () => object[] = () => entries, extra: object = {}) => ({
    ...asAnna,
    ...mapRoutes,
    'GET /api/matches/m1/state': () => ({ body: state }),
    'GET /api/matches/m1/board?': () => ({ body: list() }),
    ...extra,
  })
  const board = () => screen.getByRole('region', { name: 'Bacheca' })

  beforeEach(() => localStorage.clear())

  it('shows the latest entry and how many are new, then the whole list when opened', async () => {
    stubApi(boardOf(running(mine)))
    renderApp('/partite/m1')
    await loadedMap()

    // Closed: only the latest entry, and the badge of what is new.
    expect(await within(board()).findByText('Di qua dal fiume non si passa.')).toBeInTheDocument()
    expect(within(board()).getByText('4 nuovi')).toBeInTheDocument()
    expect(within(board()).queryByText(/ha annesso/)).not.toBeInTheDocument()

    await userEvent.click(within(board()).getByRole('button', { name: 'Apri la bacheca' }))
    // Announcements are written from the events, in Italian, with no number in them.
    expect(within(board()).getByText('Ducato del Ticino ha annesso Monza.')).toBeInTheDocument()
    expect(
      within(board()).getByText(
        "Repubblica Ambrosiana ha difeso Lodi dall'attacco di Ducato del Ticino.",
      ),
    ).toBeInTheDocument()
    expect(
      within(board()).getByText('Contea di Rho è caduto, sconfitto da Ducato del Ticino.'),
    ).toBeInTheDocument()

    // Read: closing it again shows no badge.
    await userEvent.click(within(board()).getByRole('button', { name: 'Chiudi la bacheca' }))
    expect(within(board()).queryByText(/nuov/)).not.toBeInTheDocument()
  })

  it('centres the map on the municipality an announcement names', async () => {
    stubApi(
      boardOf(running(mine), () => entries, {
        'GET /api/matches/m1/units/2': () => ({
          body: {
            geoUnitId: 2,
            name: 'Monza',
            territory: {
              id: 'ta2',
              name: 'Monza',
              ownerEmpireId: 'anna',
              protected: false,
              inBattle: false,
              resources: 100,
            },
            neighbours: [],
            annex: null,
            attack: null,
          },
        }),
      }),
    )
    renderApp('/partite/m1')
    const map = await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))

    await userEvent.click(within(board()).getByRole('button', { name: 'Mostra Monza sulla mappa' }))
    expect(map.easedTo).toMatchObject({ center: [9.27, 45.58] })
    expect(map.state.get(2)).toMatchObject({ selected: true })
  })

  it('filters by kind and by empire', async () => {
    const calls = stubApi(
      boardOf(running(mine), () => entries, {
        'GET /api/matches/m1/board?kind=battles': () => ({ body: [entries[1]] }),
        'GET /api/matches/m1/board?kind=battles&empireId=bruno': () => ({ body: [] }),
      }),
    )
    renderApp('/partite/m1')
    await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))

    await userEvent.click(within(board()).getByRole('combobox', { name: 'Mostra' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Conflitti' }))
    await waitFor(() => expect(within(board()).queryByText(/ha annesso/)).not.toBeInTheDocument())
    expect(within(board()).getByText(/ha difeso Lodi/)).toBeInTheDocument()

    await userEvent.click(within(board()).getByRole('combobox', { name: 'Impero' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Repubblica Ambrosiana' }))
    expect(await within(board()).findByText('Ancora nessun annuncio.')).toBeInTheDocument()
    expect(
      calls.some((call) => call.key === 'GET /api/matches/m1/board?kind=battles&empireId=bruno'),
    ).toBe(true)
  })

  it('posts a message in the name of the empire and shows it', async () => {
    let list = [...entries]
    const calls = stubApi(
      boardOf(running(mine), () => list, {
        'POST /api/matches/m1/board': (body: unknown) => {
          list = [
            entry(
              'e5',
              'MESSAGE',
              { empireName: 'Ducato del Ticino', text: (body as { text: string }).text },
              { empireId: 'anna' },
            ),
            ...list,
          ]
          return { status: 201, body: { id: 'e5' } }
        },
      }),
    )
    renderApp('/partite/m1')
    await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))

    await userEvent.type(
      within(board()).getByRole('textbox', { name: 'Scrivi a nome del tuo impero' }),
      'Pace a chi la vuole.',
    )
    await userEvent.click(within(board()).getByRole('button', { name: 'Invia' }))

    expect(await within(board()).findByText('Pace a chi la vuole.')).toBeInTheDocument()
    expect(calls.find((call) => call.key === 'POST /api/matches/m1/board')?.body).toEqual({
      text: 'Pace a chi la vuole.',
    })
    expect(
      within(board()).getByRole('textbox', { name: 'Scrivi a nome del tuo impero' }),
    ).toHaveValue('')
  })

  it('says when the empire has to wait before writing again', async () => {
    stubApi(
      boardOf(running(mine), () => entries, {
        'POST /api/matches/m1/board': () => ({
          status: 429,
          body: { error: { code: 'RATE_LIMITED', message: 'x' } },
        }),
      }),
    )
    renderApp('/partite/m1')
    await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))
    await userEvent.type(within(board()).getByRole('textbox'), 'Ancora io')
    await userEvent.click(within(board()).getByRole('button', { name: 'Invia' }))

    expect(await within(board()).findByRole('alert')).toHaveTextContent(
      'Devi aspettare qualche secondo',
    )
  })

  it('is read-only for spectators', async () => {
    stubApi(boardOf(running([mine[2]!], { status: 'FALLEN' })))
    renderApp('/partite/m1')
    await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))

    expect(within(board()).getByText('Puoi leggere la bacheca, non scriverci.')).toBeInTheDocument()
    expect(within(board()).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(board()).getByText('Di qua dal fiume non si passa.')).toBeInTheDocument()
  })

  it('lets the owner of the match remove a message, and only a message', async () => {
    let list = [...entries]
    const owned = running(mine)
    owned.match = { ...owned.match, isOwner: true }
    const calls = stubApi(
      boardOf(owned, () => list, {
        'DELETE /api/matches/m1/board/e4': () => {
          list = list.filter((candidate) => candidate.id !== 'e4')
          return { status: 204 }
        },
      }),
    )
    renderApp('/partite/m1')
    await loadedMap()
    await userEvent.click(await within(board()).findByRole('button', { name: 'Apri la bacheca' }))

    // One removable entry: the message. Announcements have no such button.
    const remove = within(board()).getAllByRole('button', { name: /Rimuovi il messaggio/ })
    expect(remove).toHaveLength(1)
    await userEvent.click(remove[0]!)

    await waitFor(() =>
      expect(within(board()).queryByText('Di qua dal fiume non si passa.')).not.toBeInTheDocument(),
    )
    expect(calls.some((call) => call.key === 'DELETE /api/matches/m1/board/e4')).toBe(true)
  })
})

describe('alliances', () => {
  const carla = empire('carla', 'Contea di Pavia', 'carla', '#0000aa', 'tc', 1)
  const board = { 'GET /api/matches/m1/board': () => ({ body: [] }) }
  const withAlly = (extra: object = {}) => {
    const base = running([
      ...mine,
      territory('tb2', 'Crema', 'bruno', 3, 40),
      territory('tc', 'Pavia', 'carla', 8, null),
    ])
    return {
      ...base,
      empires: [...base.empires, carla],
      alliances: [
        {
          id: 'al1',
          members: [
            { empireId: 'anna', leavesAtTurn: null },
            { empireId: 'bruno', leavesAtTurn: null },
          ],
        },
      ],
      ...extra,
    }
  }

  it('proposes an alliance and answers the proposals received', async () => {
    const base = running(mine)
    const state = {
      ...base,
      empires: [...base.empires, carla],
      invites: [{ id: 'i1', fromEmpireId: 'carla', toEmpireId: 'anna' }],
    }
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      ...board,
      'GET /api/matches/m1/state': () => ({ body: state }),
      'POST /api/matches/m1/alliances/invites': () => ({
        body: { ...state, invites: [{ id: 'i2', fromEmpireId: 'anna', toEmpireId: 'bruno' }] },
      }),
      'POST /api/matches/m1/alliances/invites/i1/accept': () => ({
        body: {
          ...state,
          invites: [],
          alliances: [
            {
              id: 'al1',
              members: [
                { empireId: 'carla', leavesAtTurn: null },
                { empireId: 'anna', leavesAtTurn: null },
              ],
            },
          ],
        },
      }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Alleanza' }))

    expect(screen.getByText('Non fai parte di nessuna alleanza.')).toBeInTheDocument()
    expect(screen.getByText("Contea di Pavia ti propone un'alleanza.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'A quale impero' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Repubblica Ambrosiana' }))
    await userEvent.click(screen.getByRole('button', { name: 'Invia la proposta' }))
    expect(
      await screen.findByText('In attesa della risposta di Repubblica Ambrosiana.'),
    ).toBeInTheDocument()
    expect(
      calls.find((call) => call.key === 'POST /api/matches/m1/alliances/invites')?.body,
    ).toEqual({ toEmpireId: 'bruno' })
  })

  it('accepts a proposal and lists the members', async () => {
    const base = running(mine)
    const state = {
      ...base,
      empires: [...base.empires, carla],
      invites: [{ id: 'i1', fromEmpireId: 'carla', toEmpireId: 'anna' }],
    }
    stubApi({
      ...asAnna,
      ...mapRoutes,
      ...board,
      'GET /api/matches/m1/alliances/chat': () => ({ body: [] }),
      'GET /api/matches/m1/state': () => ({ body: state }),
      'POST /api/matches/m1/alliances/invites/i1/accept': () => ({
        body: {
          ...state,
          invites: [],
          alliances: [
            {
              id: 'al1',
              members: [
                { empireId: 'carla', leavesAtTurn: null },
                { empireId: 'anna', leavesAtTurn: null },
              ],
            },
          ],
        },
      }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Alleanza' }))
    await userEvent.click(screen.getByRole('button', { name: 'Accetta' }))

    const members = await screen.findByRole('heading', { name: 'Membri' })
    const list = members.nextElementSibling as HTMLElement
    expect(within(list).getByText('Contea di Pavia')).toBeInTheDocument()
    expect(within(list).getByText(/Ducato del Ticino/)).toHaveTextContent('(tu)')
    // A third member may still be invited: the limit is three.
    expect(screen.getByRole('heading', { name: "Invita nell'alleanza" })).toBeInTheDocument()
  })

  it('sends resources to a territory of an ally and writes in the private chat', async () => {
    let messages = [{ id: 'c1', empireId: 'bruno', text: 'Tieni Monza', createdAt: '2026-01-01' }]
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      ...board,
      'GET /api/matches/m1/state': () => ({ body: withAlly() }),
      'GET /api/matches/m1/alliances/chat': () => ({ body: messages }),
      'POST /api/matches/m1/alliances/chat': (body) => {
        messages = [
          { id: 'c2', empireId: 'anna', text: (body as { text: string }).text, createdAt: 'x' },
          ...messages,
        ]
        return { body: messages }
      },
      'POST /api/matches/m1/alliances/transfer': () => ({ body: withAlly() }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Alleanza' }))

    await userEvent.click(await screen.findByRole('combobox', { name: 'Dal tuo comune' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Milano (200 risorse)' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Al comune alleato' }))
    // Only the allies' territories are offered, with the resources an ally may see.
    expect(screen.queryByRole('option', { name: /Pavia/ })).not.toBeInTheDocument()
    await userEvent.click(
      await screen.findByRole('option', { name: 'Crema di Repubblica Ambrosiana (40 risorse)' }),
    )
    await userEvent.type(screen.getByLabelText('Quante risorse'), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Invia le risorse' }))
    await waitFor(() =>
      expect(
        calls.find((call) => call.key === 'POST /api/matches/m1/alliances/transfer')?.body,
      ).toEqual({ fromTerritoryId: 'ta1', toTerritoryId: 'tb2', amount: 50, turn: 3 }),
    )

    expect(await screen.findByText('Tieni Monza')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Scrivi agli alleati' }), 'Arrivo')
    await userEvent.click(screen.getByRole('button', { name: 'Invia' }))
    expect(await screen.findByText('Arrivo')).toBeInTheDocument()
  })

  it('leaves with a notice, after a confirmation', async () => {
    const leaving = withAlly({
      alliances: [
        {
          id: 'al1',
          members: [
            { empireId: 'anna', leavesAtTurn: 4 },
            { empireId: 'bruno', leavesAtTurn: null },
          ],
        },
      ],
    })
    const calls = stubApi({
      ...asAnna,
      ...mapRoutes,
      ...board,
      'GET /api/matches/m1/state': () => ({ body: withAlly() }),
      'GET /api/matches/m1/alliances/chat': () => ({ body: [] }),
      'POST /api/matches/m1/alliances/leave': () => ({ body: leaving }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Alleanza' }))
    await userEvent.click(await screen.findByRole('button', { name: "Esci dall'alleanza" }))
    expect(calls.some((call) => call.key === 'POST /api/matches/m1/alliances/leave')).toBe(false)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('fino ad allora resti alleato')
    await userEvent.click(within(dialog).getByRole('button', { name: "Esci dall'alleanza" }))

    expect(
      await screen.findByText("Hai annunciato l'uscita: avrà effetto alla fine del turno 4."),
    ).toBeInTheDocument()
    expect(screen.getByText('esce alla fine del turno 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "Esci dall'alleanza" })).not.toBeInTheDocument()
  })

  it('colours the map by alliance or by resources', async () => {
    stubApi({
      ...asAnna,
      ...mapRoutes,
      ...board,
      'GET /api/matches/m1/state': () => ({ body: withAlly() }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    const colorOf = (id: number) => map.state.get(id)?.color

    await waitFor(() => expect(colorOf(1)).toBe('#00aa00'))
    expect(colorOf(9)).toBe('#aa0000')

    const views = screen.getByRole('group', { name: 'Vista della mappa' })
    await userEvent.click(within(views).getByRole('button', { name: 'Alleanze' }))
    // Allies share a colour; an empire outside any alliance is neutral.
    await waitFor(() => expect(colorOf(9)).toBe(colorOf(1)))
    expect(colorOf(8)).not.toBe(colorOf(1))

    await userEvent.click(within(views).getByRole('button', { name: 'Risorse' }))
    // Deeper where there is more; what the viewer may not see stays neutral.
    await waitFor(() => expect(colorOf(1)).toBe('#2c4224'))
    expect(colorOf(3)).not.toBe(colorOf(1))
    expect(colorOf(8)).toBe('#d9ccbf')
  })
})

describe('history of the turns', () => {
  const routes = (calls: { turns?: number[] } = {}) => ({
    ...asAnna,
    ...mapRoutes,
    'GET /api/matches/m1/board': () => ({ body: [] }),
    'GET /api/matches/m1/state': () => ({ body: running(mine) }),
    'GET /api/matches/m1/history': () => ({
      body: [
        { turn: 2, closedAt: '2026-01-02', events: 1 },
        { turn: 1, closedAt: '2026-01-01', events: 0 },
      ],
    }),
    'GET /api/matches/m1/history/2': () => {
      calls.turns?.push(2)
      return {
        body: {
          turn: 2,
          closedAt: '2026-01-02',
          events: [
            {
              id: 'e1',
              type: 'ANNEXED',
              turn: 2,
              createdAt: '2026-01-02',
              empireId: 'anna',
              territoryId: 'ta2',
              geoUnitId: 2,
              data: { empireName: 'Ducato del Ticino', territoryName: 'Monza' },
            },
          ],
          // At the end of turn 2 Lodi was Anna's and Monza still Bruno's.
          ownership: { '1': 'anna', '9': 'anna', '2': 'bruno' },
        },
      }
    },
    'GET /api/matches/m1/history/1': () => ({
      body: { turn: 1, closedAt: '2026-01-01', events: [], ownership: { '1': 'anna' } },
    }),
  })

  it('lists the closed turns as cards that open on what happened', async () => {
    stubApi(routes())
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'Storico dei turni' }))

    const second = await screen.findByRole('button', { name: /Turno 2/ })
    expect(second).toHaveTextContent('1 evento')
    expect(second).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Turno 1/ })).toHaveTextContent('0 eventi')

    await userEvent.click(second)
    expect(second).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText(/Ducato del Ticino.*Monza/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostra Monza sulla mappa' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Turno 1/ }))
    expect(
      await screen.findByText('In questo turno non è successo niente da annunciare.'),
    ).toBeInTheDocument()
  })

  it('shows the map as it was, moves between turns and comes back to the present', async () => {
    stubApi(routes())
    renderApp('/partite/m1')
    const map = await loadedMap()
    const colorOf = (id: number) => map.state.get(id)?.color
    await waitFor(() => expect(colorOf(9)).toBe('#aa0000'))

    await userEvent.click(await screen.findByRole('button', { name: 'Storico dei turni' }))
    await userEvent.click(await screen.findByRole('button', { name: /Turno 2/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rivedi sulla mappa' }))

    const bar = await screen.findByRole('group', { name: 'Revisione dello storico' })
    expect(within(bar).getByRole('status')).toHaveTextContent('Mappa alla fine del turno 2')
    // The colours are those of the owners of then; the views of the present give way.
    await waitFor(() => expect(colorOf(9)).toBe('#00aa00'))
    expect(colorOf(2)).toBe('#aa0000')
    expect(screen.queryByRole('group', { name: 'Vista della mappa' })).not.toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Turno successivo' })).toBeDisabled()

    // A tap on the map says who owned the municipality then, without opening its card.
    act(() => map.click({ id: 9, name: 'Lodi' }))
    expect(await screen.findByText('Impero: Ducato del Ticino')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Storico dei turni' })).toBeInTheDocument()

    await userEvent.click(within(bar).getByRole('button', { name: 'Turno precedente' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Mappa alla fine del turno 1'),
    )
    await waitFor(() => expect(colorOf(9)).toBeUndefined())
    expect(screen.getByRole('button', { name: 'Turno precedente' })).toBeDisabled()

    await userEvent.click(screen.getAllByRole('button', { name: 'Torna al presente' })[0])
    await waitFor(() => expect(colorOf(9)).toBe('#aa0000'))
    expect(screen.getByRole('group', { name: 'Vista della mappa' })).toBeInTheDocument()
  })
})
