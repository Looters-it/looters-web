import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const asAnna = {
  'GET /api/auth/me': () => ({ body: { id: 'u1', username: 'anna', role: 'USER' } }),
}

const rules = {
  minPlayersToStart: 1,
  lateJoin: true,
  botsEnabled: false,
  botsMax: 5,
  startResources: 200,
  annexCost: 50,
}
const options = {
  'GET /api/matches/options': () => ({
    body: {
      rules,
      maxPlayersLimit: 120,
      colors: ['#aa0000', '#00aa00', '#0000aa'],
      emblems: ['torre', 'stella', 'luna'],
    },
  }),
}

const match = (extra: object = {}) => ({
  id: 'm1',
  name: 'Milano e provincia',
  status: 'OPEN',
  startAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  maxDays: null,
  maxPlayers: 100,
  turnHours: 24,
  currentTurn: 0,
  turnEndsAt: null,
  players: 1,
  hasInviteCode: false,
  owner: 'bruno',
  areas: [{ id: 'a1', name: 'Provincia di Milano' }],
  config: rules,
  isOwner: false,
  winnerEmpireIds: [] as string[],
  ...extra,
})

const bruno = {
  id: 'e1',
  name: 'Repubblica Ambrosiana',
  color: '#aa0000',
  emblem: 'stella',
  motto: null,
  status: 'ACTIVE',
  username: 'bruno',
  capitalTerritoryId: 't1',
  units: 1,
}
const brunoCapital = {
  id: 't1',
  name: 'Milano',
  ownerEmpireId: 'e1',
  geoUnitIds: [1],
  isArea: false,
  protected: true,
  resources: null,
  weight: null,
  battleId: null,
  alert: false,
}

const online = { connected: 0, total: 1 }
const battles: object[] = []

const mapOf = {
  'GET /api/matches/m1/map': () => ({
    body: {
      id: 'm1',
      name: 'Milano e provincia',
      unitCount: 3,
      bounds: [8.7, 45.1, 9.6, 45.7],
      version: '3',
      tiles: '/api/matches/m1/tiles/{z}/{x}/{y}.mvt?v=3',
      minZoom: 4,
      maxZoom: 12,
      labelMinZoom: 9,
    },
  }),
  'GET /api/matches/m1/units': () => ({
    body: [
      { id: 1, name: 'Milano', lon: 9.19, lat: 45.46 },
      { id: 2, name: 'Monza', lon: 9.27, lat: 45.58 },
    ],
  }),
}

describe('match list', () => {
  const page = (matches: object[], total = matches.length) => ({
    body: { page: 1, pageSize: 6, total, matches },
  })

  it('lists the active matches with the right way in for each', async () => {
    stubApi({
      ...asAnna,
      'GET /api/matches?page=1': () =>
        page([
          match(),
          match({ id: 'm2', name: 'Brianza', players: 2, maxPlayers: 2 }),
          match({ id: 'm3', name: 'La mia', status: 'RUNNING', currentTurn: 4 }),
        ]),
      'GET /api/matches/mine': () => ({
        body: [match({ id: 'm3', name: 'La mia', status: 'RUNNING', currentTurn: 4 })],
      }),
    })
    renderApp('/partite')

    // The player's own matches come first, in a row of their own.
    const own = await screen.findByRole('region', { name: 'Le tue partite' })
    expect(await within(own).findByRole('link', { name: 'Entra' })).toHaveAttribute(
      'href',
      '/partite/m3',
    )
    const list = await screen.findByRole('region', { name: 'Partite in corso' })
    const rows = await within(list).findAllByRole('listitem')
    expect(within(rows[0]!).getByRole('link', { name: 'Partecipa' })).toHaveAttribute(
      'href',
      '/partite/m1',
    )
    expect(rows[0]).toHaveTextContent('1 di 100 giocatori')
    expect(within(rows[1]!).getByRole('button', { name: 'Al completo' })).toBeDisabled()
    expect(within(rows[2]!).getByRole('link', { name: 'Entra' })).toHaveAttribute(
      'href',
      '/partite/m3',
    )
    expect(rows[2]).toHaveTextContent('turno 4')
    // Among all the matches, the player's own is marked.
    expect(rows[2]).toHaveTextContent('la tua')
    expect(rows[0]).not.toHaveTextContent('la tua')
  })

  it('filters by name and moves between pages', async () => {
    const calls = stubApi({
      ...guest,
      'GET /api/matches?page=1': () => page([match()], 13),
      'GET /api/matches?page=2': () => page([match({ id: 'm9', name: 'Seconda pagina' })], 13),
      'GET /api/matches?page=1&name=brian': () => page([]),
    })
    renderApp('/partite')

    expect(await screen.findByText('Pagina 1 di 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Successiva' }))
    expect(await screen.findByText('Seconda pagina')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nome partita'), 'brian')
    expect(await screen.findByText('Nessuna partita corrisponde ai filtri.')).toBeInTheDocument()
    expect(calls.some((call) => call.key === 'GET /api/matches?page=1&name=brian')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Azzera i filtri' }))
    expect(await screen.findByText('Pagina 1 di 3')).toBeInTheDocument()
  })
})

describe('new match', () => {
  const tree = {
    'GET /api/geo/tree': () => ({
      body: [
        { id: 'it', name: 'Italia', parentId: null, unitCount: 7896 },
        { id: 'lo', name: 'Lombardia', parentId: 'it', unitCount: 1500 },
        { id: 'vuota', name: 'Vuota', parentId: null, unitCount: 0 },
      ],
    }),
  }

  it('asks guests to sign in', async () => {
    stubApi({ ...guest, ...options, ...tree })
    renderApp('/partite/nuova')
    expect(await screen.findByText('Accedi per creare una partita.')).toBeInTheDocument()
  })

  it('creates a match with the chosen settings and opens registrations', async () => {
    const calls = stubApi({
      ...asAnna,
      ...options,
      ...tree,
      'POST /api/matches': () => ({ status: 201, body: match({ status: 'DRAFT', isOwner: true }) }),
      'POST /api/matches/m1/open': () => ({ body: match({ isOwner: true }) }),
      'GET /api/matches/m1/state': () => ({
        body: {
          match: match({ isOwner: true, owner: 'anna', players: 0 }),
          me: null,
          empires: [],
          territories: [],
          online,
          battles,
          structures: [],
          alliances: [],
          invites: [],
        },
      }),
      ...mapOf,
    })
    renderApp('/partite/nuova')

    await userEvent.type(await screen.findByLabelText('Nome'), 'Lombardia in guerra')
    await userEvent.click(screen.getByRole('combobox', { name: 'Area di gioco' }))
    // Folders are shown with their path; the empty one is not offered.
    expect(screen.queryByRole('option', { name: /Vuota/ })).not.toBeInTheDocument()
    await userEvent.click(
      await screen.findByRole('option', { name: 'Italia › Lombardia (1500 comuni)' }),
    )
    await userEvent.clear(screen.getByLabelText('Giocatori massimi'))
    await userEvent.type(screen.getByLabelText('Giocatori massimi'), '30')

    // Bots are asked for in the main form: one player is then enough for a match.
    const bots = screen.getByRole('checkbox', { name: 'Aggiungi imperi bot' })
    expect(bots).not.toBeChecked()
    await userEvent.click(bots)

    // A rule changed from its default travels with the match.
    await userEvent.click(screen.getByRole('button', { name: /Regole di gioco/ }))
    expect(screen.getByRole('spinbutton', { name: 'Bot al massimo in una partita' })).toHaveValue(5)
    const cost = screen.getByRole('spinbutton', { name: "Costo di un'annessione" })
    await userEvent.clear(cost)
    await userEvent.type(cost, '80')

    await userEvent.click(screen.getByRole('button', { name: 'Crea e apri le iscrizioni' }))

    expect(await screen.findByRole('heading', { name: 'Milano e provincia' })).toBeInTheDocument()
    const created = calls.find((call) => call.key === 'POST /api/matches')?.body
    expect(created).toMatchObject({
      name: 'Lombardia in guerra',
      areaIds: ['lo'],
      maxPlayers: 30,
      turnHours: 24,
      maxDays: null,
      inviteCode: null,
      config: { ...rules, annexCost: 80, botsEnabled: true },
    })
    expect(calls.some((call) => call.key === 'POST /api/matches/m1/open')).toBe(true)
  })
})

describe('match page', () => {
  const open = (state: object) => ({ 'GET /api/matches/m1/state': () => ({ body: state }) })
  const loadedMap = async () => {
    await waitFor(() => expect(FakeMap.instances.length).toBeGreaterThan(0))
    act(() => FakeMap.latest.fire('load'))
    return FakeMap.latest
  }

  it('paints the empires on the map and never shows the resources of others', async () => {
    stubApi({
      ...asAnna,
      ...options,
      ...mapOf,
      ...open({
        match: match(),
        me: null,
        empires: [bruno],
        territories: [brunoCapital],
        online,
        battles,
        structures: [],
        alliances: [],
        invites: [],
      }),
    })
    renderApp('/partite/m1')

    expect(await screen.findByRole('heading', { name: 'Milano e provincia' })).toBeInTheDocument()
    expect(screen.getByText('Iscrizioni aperte')).toBeInTheDocument()
    const map = await loadedMap()
    await waitFor(() => expect(map.state.get(1)).toMatchObject({ color: '#aa0000' }))
    await waitFor(() =>
      expect(map.sourceData.get('empires')).toMatchObject({
        features: [{ properties: { name: 'Repubblica Ambrosiana' } }],
      }),
    )

    act(() => map.click({ id: 1, name: 'Milano' }))
    expect(await screen.findByText('Impero: Repubblica Ambrosiana')).toBeInTheDocument()
    expect(screen.getByText('Risorse: nascoste')).toBeInTheDocument()
    expect(screen.getByText('Protetto fino a fine turno')).toBeInTheDocument()
    // A municipality that belongs to someone cannot be a starting point.
    expect(screen.getByRole('status')).toHaveTextContent('Milano appartiene già a un impero')
    expect(screen.getByRole('button', { name: 'Scegli un comune per continuare' })).toBeDisabled()
  })

  it('founds an empire on the chosen municipality', async () => {
    const mine = {
      ...bruno,
      id: 'e2',
      name: 'Ducato del Ticino',
      color: '#00aa00',
      emblem: 'luna',
      username: 'anna',
      capitalTerritoryId: 't2',
    }
    const myCapital = {
      ...brunoCapital,
      id: 't2',
      name: 'Monza',
      ownerEmpireId: 'e2',
      geoUnitIds: [2],
      resources: 263,
    }
    const before = {
      match: match(),
      me: null,
      empires: [bruno],
      territories: [brunoCapital],
      online,
      battles,
      structures: [],
      alliances: [],
      invites: [],
    }
    const after = {
      match: match({ players: 2 }),
      me: { empireId: 'e2', annexLeft: 1, turnValue: 60, allocationMode: 'EQUAL' },
      empires: [bruno, mine],
      territories: [brunoCapital, myCapital],
      online,
      battles,
      structures: [],
      alliances: [],
      invites: [],
    }
    let joined = false
    const calls = stubApi({
      ...asAnna,
      ...options,
      ...mapOf,
      'GET /api/matches/m1/state': () => ({ body: joined ? after : before }),
      'POST /api/matches/m1/join': () => {
        joined = true
        return { status: 201, body: after }
      },
      'DELETE /api/matches/m1/empire': () => {
        joined = false
        return { body: before }
      },
    })
    renderApp('/partite/m1')
    const map = await loadedMap()

    act(() => map.click({ id: 2, name: 'Monza' }))
    expect(await screen.findByText('Parti da Monza.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("Nome dell'impero"), 'Ducato del Ticino')
    // The colour of the other empire is not available; the first free one is proposed.
    expect(screen.getByRole('button', { name: /Colore 1, già scelto/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Colore 2' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Stemma luna' }))
    await userEvent.click(screen.getByRole('button', { name: "Fonda l'impero" }))

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/matches/m1/join')?.body).toEqual({
        geoUnitId: 2,
        empire: { name: 'Ducato del Ticino', color: '#00aa00', emblem: 'luna', motto: null },
      }),
    )
    // A player lands on the menu of the panel; the empire is under "La partita".
    await userEvent.click(await screen.findByRole('button', { name: 'La partita' }))
    expect(await screen.findByRole('heading', { name: 'Il tuo impero' })).toBeInTheDocument()
    // Own resources are shown, and the map gains the new empire without being rebuilt.
    expect(screen.getByText(/Risorse in capitale: 263/)).toBeInTheDocument()
    await waitFor(() => expect(map.state.get(2)).toMatchObject({ color: '#00aa00' }))
    expect(FakeMap.instances).toHaveLength(1)

    // Until the match starts the player can walk away, after confirming.
    await userEvent.click(screen.getByRole('button', { name: 'Ritirati dalla partita' }))
    expect(calls.some((call) => call.key === 'DELETE /api/matches/m1/empire')).toBe(false)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('il comune di partenza torna libero')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ritirati dalla partita' }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Il tuo impero' })).not.toBeInTheDocument(),
    )
    expect(calls.some((call) => call.key === 'DELETE /api/matches/m1/empire')).toBe(true)
    // The municipality is free again on the map.
    await waitFor(() => expect(map.state.get(2)?.color).toBeUndefined())
  })

  it('puts an uploaded logo in place of the emblem, and takes it away again', async () => {
    const mine = {
      ...bruno,
      id: 'e2',
      name: 'Ducato del Ticino',
      username: 'anna',
      capitalTerritoryId: 't2',
      logoUrl: null as string | null,
    }
    const myCapital = {
      ...brunoCapital,
      id: 't2',
      name: 'Monza',
      ownerEmpireId: 'e2',
      geoUnitIds: [2],
      resources: 263,
    }
    const state = (logoUrl: string | null) => ({
      match: match({ players: 2 }),
      me: { empireId: 'e2', annexLeft: 1, turnValue: 60, allocationMode: 'EQUAL' },
      empires: [
        { ...bruno, logoUrl: null },
        { ...mine, logoUrl },
      ],
      territories: [brunoCapital, myCapital],
      online,
      battles,
      structures: [],
      alliances: [],
      invites: [],
    })
    const url = '/api/matches/m1/empires/e2/logo?v=1'
    const calls = stubApi({
      ...asAnna,
      ...options,
      ...mapOf,
      'GET /api/matches/m1/state': () => ({ body: state(null) }),
      'PUT /api/matches/m1/empire/logo': () => ({ body: state(url) }),
      'DELETE /api/matches/m1/empires/e2/logo': () => ({ body: state(null) }),
    })
    renderApp('/partite/m1')
    await userEvent.click(await screen.findByRole('button', { name: 'La partita' }))
    const panel = (await screen.findByRole('heading', { name: 'Il tuo impero' })).parentElement!
    expect(panel.querySelector('image')).toBeNull()

    // Too heavy: said at once, nothing is sent.
    const input = screen.getByLabelText('Immagine del logo')
    await userEvent.upload(
      input,
      new File([new Uint8Array(250_000)], 'big.png', { type: 'image/png' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('supera i 200 KB')
    expect(calls.some((call) => call.key === 'PUT /api/matches/m1/empire/logo')).toBe(false)

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })
    await userEvent.upload(input, file)
    // The file itself is sent, and the picture takes the place of the emblem.
    await waitFor(() =>
      expect(calls.find((call) => call.key === 'PUT /api/matches/m1/empire/logo')?.body).toBe(file),
    )
    await waitFor(() => expect(panel.querySelector('image')).toHaveAttribute('href', url))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Rimuovi il logo' }))
    await waitFor(() => expect(panel.querySelector('image')).toBeNull())
    expect(screen.getByRole('button', { name: 'Carica un logo' })).toBeInTheDocument()
  })

  it('explains a refused registration and asks for the invite code when needed', async () => {
    stubApi({
      ...asAnna,
      ...options,
      ...mapOf,
      ...open({
        match: match({ hasInviteCode: true }),
        me: null,
        empires: [],
        territories: [],
        online,
        battles,
        structures: [],
        alliances: [],
        invites: [],
      }),
      'POST /api/matches/m1/join': () => ({
        status: 403,
        body: { error: { code: 'INVITE_CODE_REQUIRED', message: 'x' } },
      }),
    })
    renderApp('/partite/m1')
    const map = await loadedMap()
    act(() => map.click({ id: 2, name: 'Monza' }))

    await userEvent.type(await screen.findByLabelText("Nome dell'impero"), 'Ducato')
    await userEvent.type(screen.getByLabelText("Codice d'invito"), 'sbagliato')
    await userEvent.click(screen.getByRole('button', { name: "Fonda l'impero" }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Il codice d'invito manca o non è corretto.",
    )
  })

  it('tells guests to sign in and hides the form when the match is full', async () => {
    stubApi({
      ...guest,
      ...options,
      ...mapOf,
      ...open({
        match: match(),
        me: null,
        empires: [],
        territories: [],
        online,
        battles,
        structures: [],
        alliances: [],
        invites: [],
      }),
    })
    renderApp('/partite/m1')
    expect(await screen.findByText('Accedi per partecipare a questa partita.')).toBeInTheDocument()
  })

  it('gives the owner of a draft the settings and the button to open registrations', async () => {
    let status = 'DRAFT'
    const current = () =>
      match({ status, isOwner: true, owner: 'anna', players: 0, inviteCode: null })
    const calls = stubApi({
      ...asAnna,
      ...options,
      ...mapOf,
      'GET /api/geo/tree': () => ({
        body: [{ id: 'a1', name: 'Provincia di Milano', parentId: null, unitCount: 133 }],
      }),
      'GET /api/matches/m1/state': () => ({
        body: {
          match: current(),
          me: null,
          empires: [],
          territories: [],
          online,
          battles,
          structures: [],
          alliances: [],
          invites: [],
        },
      }),
      'PATCH /api/matches/m1': () => ({ body: current() }),
      'POST /api/matches/m1/open': () => {
        status = 'OPEN'
        return { body: current() }
      },
    })
    renderApp('/partite/m1')

    expect(await screen.findByText(/Questa bozza la vedi solo tu/)).toBeInTheDocument()
    // No registration on a draft, and no map yet.
    expect(screen.queryByRole('heading', { name: 'Partecipa' })).not.toBeInTheDocument()
    expect(FakeMap.instances).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Apri le iscrizioni' }))

    expect(await screen.findByText('Iscrizioni aperte')).toBeInTheDocument()
    expect(calls.some((call) => call.key === 'POST /api/matches/m1/open')).toBe(true)
    expect(await screen.findByRole('heading', { name: 'Partecipa' })).toBeInTheDocument()
  })

  it('shows the not-found page for a match that does not exist', async () => {
    stubApi({ ...guest })
    renderApp('/partite/nope')
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })
})

describe('emblems', () => {
  it('are drawings with a surface: every arc reaches its end', async () => {
    const { GLYPHS } = await import('./emblem-glyphs')
    // An arc whose radius is shorter than half the way to its end is stretched into a
    // half circle; two of those back and forth enclose nothing, and the emblem vanishes.
    for (const [name, path] of Object.entries(GLYPHS)) {
      const arcs = [...path.matchAll(/a([\d.]+) [\d.]+ \d [01] [01] ?(-?[\d.]+)[ ,]?(-?[\d.]+)/g)]
      for (const arc of arcs) {
        const [radius, dx, dy] = [Number(arc[1]), Number(arc[2]), Number(arc[3])]
        expect(Math.hypot(dx, dy) / 2, `${name}: ${arc[0]}`).toBeLessThanOrEqual(radius * 1.01)
      }
    }
  })
})
