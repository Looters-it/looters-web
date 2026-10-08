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

beforeEach(() => FakeWebSocket.install())

describe('homepage', () => {
  it('shows the Italian interface and invites guests to sign in', async () => {
    stubApi({ ...guest })
    renderApp()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Saccheggia i tuoi vicini!')
    // A guest is not offered to create a match: the call to action leads to the sign-in page.
    expect(screen.queryByRole('link', { name: 'Crea una partita' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: 'Accedi per giocare' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Entra in Looters' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Accedi' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Registrati' })).toBeInTheDocument()
  })

  it('signs in on its own page and goes on to where the player was headed', async () => {
    let signedIn = false
    const calls = stubApi({
      'GET /api/auth/me': () =>
        signedIn
          ? { body: { id: 'u1', username: 'anna', role: 'USER' } }
          : { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } },
      'POST /api/auth/login': () => {
        signedIn = true
        return { body: { id: 'u1', username: 'anna', role: 'USER' } }
      },
    })
    // An address from outside is never followed: only a path of this site.
    renderApp('/auth/login?next=https://altrove.example')
    await userEvent.type(await screen.findByLabelText('Nome utente'), 'anna')
    await userEvent.type(screen.getByLabelText('Password'), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    // Back on the homepage, now with the way to create a match.
    expect(await screen.findByRole('link', { name: 'Crea una partita' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Entra in Looters' })).not.toBeInTheDocument()
    expect(calls.find((call) => call.key === 'POST /api/auth/login')?.body).toEqual({
      username: 'anna',
      password: 'password-123',
    })
  })

  it('opens the sign-in page on registration when asked to', async () => {
    stubApi({ ...guest })
    renderApp('/auth/register')
    expect(await screen.findByRole('tab', { name: 'Registrati' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('plays a demonstration on the map: empires grow, and a chronicle says what happens', async () => {
    resetFakeMaplibre()
    // A grid of municipalities, enough for a few empires to have neighbours.
    const units = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `Comune ${String(i + 1)}`,
      lon: 9 + (i % 10) * 0.05,
      lat: 45 + Math.floor(i / 10) * 0.05,
    }))
    stubApi({
      ...guest,
      'GET /api/geo/areas': () => ({ body: [{ id: 'a1', name: 'Italia', unitCount: 60 }] }),
      'GET /api/geo/areas/a1/map': () => ({
        body: {
          id: 'a1',
          name: 'Italia',
          unitCount: 60,
          bounds: [6, 36, 19, 47],
          version: '60',
          tiles: '/api/geo/areas/a1/tiles/{z}/{x}/{y}.mvt?v=60',
          minZoom: 4,
          maxZoom: 12,
          labelMinZoom: 9,
        },
      }),
      'GET /api/geo/areas/a1/units': () => ({ body: units }),
    })
    renderApp()

    const hero = await screen.findByRole('region', { name: 'Dimostrazione del gioco sulla mappa' })
    await waitFor(() => expect(FakeMap.instances.length).toBeGreaterThan(0))
    act(() => FakeMap.latest.fire('load'))
    // Said on the map: these empires are made up.
    expect(await within(hero).findByText('Dimostrazione: imperi inventati')).toBeInTheDocument()
    // Six empires stand on their capitals, each with its name and its arms…
    const owned = () => [...FakeMap.latest.state.values()].filter((state) => state.color).length
    await waitFor(() => expect(owned()).toBe(6))
    const labels = FakeMap.latest.sourceData.get('empires') as { features: object[] }
    expect(labels.features).toHaveLength(6)
    // …then the map changes by itself, and the chronicle tells it.
    const log = await within(hero).findByRole(
      'list',
      { name: 'Cronaca della dimostrazione' },
      { timeout: 4000 },
    )
    expect(within(log).getAllByRole('listitem')[0]).toHaveTextContent(/ha annesso Comune \d+\./)
    expect(owned()).toBeGreaterThan(6)
  })
})

describe('online counter', () => {
  it('shows the count pushed by the server and follows its changes', async () => {
    stubApi({ ...guest })
    renderApp()
    expect(screen.queryByText(/conness/)).not.toBeInTheDocument()

    act(() => {
      FakeWebSocket.latest.open()
      FakeWebSocket.latest.receive({ t: 'online', n: 1 })
    })
    expect(screen.getByText('giocatore connesso')).toBeInTheDocument()

    act(() => FakeWebSocket.latest.receive({ t: 'online', n: 12 }))
    expect(screen.getByText('giocatori connessi')).toBeInTheDocument()
    expect(screen.getByText('12', { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('hides the count while disconnected and reconnects by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    stubApi({ ...guest })
    renderApp()
    const first = FakeWebSocket.latest
    act(() => {
      first.open()
      first.receive({ t: 'online', n: 3 })
    })

    act(() => first.close())
    expect(screen.queryByText(/connessi/)).not.toBeInTheDocument()

    act(() => void vi.advanceTimersByTime(1000))
    expect(FakeWebSocket.latest).not.toBe(first)
    vi.useRealTimers()
  })
})

describe('account in the navbar', () => {
  const mario = { id: 'u1', username: 'mario_rossi', role: 'USER' }

  async function openAccount() {
    await userEvent.click(await screen.findByRole('link', { name: 'Accedi' }))
  }

  it('signs in with username and password and reopens the socket', async () => {
    const calls = stubApi({ ...guest, 'POST /api/auth/login': () => ({ body: mario }) })
    renderApp()
    const guestSocket = FakeWebSocket.latest

    await openAccount()
    await userEvent.type(screen.getByLabelText('Nome utente'), 'mario_rossi')
    await userEvent.type(screen.getByLabelText('Password'), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('button', { name: 'Esci' })).toBeVisible()
    expect(calls.find((call) => call.key === 'POST /api/auth/login')?.body).toEqual({
      username: 'mario_rossi',
      password: 'password-123',
    })
    // A new socket, so that the server sees the session cookie.
    expect(guestSocket.closed).toBe(true)
    expect(FakeWebSocket.latest).not.toBe(guestSocket)
  })

  it('explains a refused login', async () => {
    stubApi({
      ...guest,
      'POST /api/auth/login': () => ({
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'x' } },
      }),
    })
    renderApp()

    await openAccount()
    await userEvent.type(screen.getByLabelText('Nome utente'), 'mario_rossi')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nome utente o password non corretti.',
    )
  })

  it('registers with username, email and password', async () => {
    const calls = stubApi({
      ...guest,
      'POST /api/auth/register': () => ({ status: 201, body: mario }),
    })
    renderApp()

    await openAccount()
    await userEvent.click(screen.getByRole('tab', { name: 'Registrati' }))
    await userEvent.type(screen.getByLabelText('Nome utente'), 'mario_rossi')
    await userEvent.type(screen.getByLabelText('Email'), 'mario@example.test')
    await userEvent.type(screen.getByLabelText('Password'), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: "Crea l'account" }))

    expect(await screen.findByRole('button', { name: 'Esci' })).toBeVisible()
    expect(calls.find((call) => call.key === 'POST /api/auth/register')?.body).toEqual({
      username: 'mario_rossi',
      email: 'mario@example.test',
      password: 'password-123',
    })
  })

  it('says when the username is taken', async () => {
    stubApi({
      ...guest,
      'POST /api/auth/register': () => ({
        status: 409,
        body: { error: { code: 'USERNAME_TAKEN', message: 'x' } },
      }),
    })
    renderApp()

    await openAccount()
    await userEvent.click(screen.getByRole('tab', { name: 'Registrati' }))
    await userEvent.type(screen.getByLabelText('Nome utente'), 'mario_rossi')
    await userEvent.type(screen.getByLabelText('Email'), 'mario@example.test')
    await userEvent.type(screen.getByLabelText('Password'), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: "Crea l'account" }))

    expect(await screen.findByRole('alert')).toHaveTextContent('già in uso')
  })

  it('restores the session on load and signs out', async () => {
    const calls = stubApi({
      'GET /api/auth/me': () => ({ body: mario }),
      'POST /api/auth/logout': () => ({ status: 204 }),
    })
    renderApp()

    // The sidebar says who is signed in and holds the way out.
    expect(await screen.findByText('mario_rossi')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Le mie partite' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profilo' })).toHaveAttribute('href', '/profilo')
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))

    // A guest again: the entries of a guest, and the way in.
    expect(await screen.findByRole('link', { name: 'Accedi' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Come funziona' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi partite in corso' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Profilo' })).not.toBeInTheDocument()
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/auth/logout')).toBe(true))
  })

  it('signs the user out and explains when the server revokes the session', async () => {
    stubApi({ 'GET /api/auth/me': () => ({ body: mario }) })
    renderApp()
    await screen.findByRole('button', { name: 'Esci' })
    const revoked = FakeWebSocket.latest

    act(() => revoked.receive({ t: 'session.revoked' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La tua sessione è terminata')
    expect(screen.getByRole('link', { name: 'Accedi' })).toBeInTheDocument()
    expect(FakeWebSocket.latest).not.toBe(revoked)
  })
})

describe('routing', () => {
  it('shows the not-found page for unknown paths', () => {
    stubApi({ ...guest })
    renderApp('/non-esiste')

    expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alla homepage' })).toHaveAttribute('href', '/')
  })
})

describe('a page that breaks', () => {
  it('leaves the navbar, offers a way out and reports the error to the server', async () => {
    const { resetReports } = await import('@/lib/report')
    resetReports()
    const noise = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // A state the page cannot draw: it has no empires at all.
    const calls = stubApi({
      ...guest,
      'GET /api/matches/m1/state': () => ({ body: { match: { id: 'm1', status: 'RUNNING' } } }),
    })
    renderApp('/match/m1?token=secret')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Qualcosa si è rotto')
    expect(screen.getByRole('button', { name: 'Ricarica la pagina' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()

    await waitFor(() =>
      expect(calls.some((call) => call.key === 'POST /api/client-errors')).toBe(true),
    )
    const report = calls.find((call) => call.key === 'POST /api/client-errors')?.body as {
      message: string
      path: string
      kind: string
      stack?: string
    }
    expect(report.kind).toBe('render')
    // The path of the page, never its query string.
    expect(report.path).toBe('/match/m1')
    expect(report.message).not.toBe('')
    // Reported once, however many times the page tries again.
    expect(calls.filter((call) => call.key === 'POST /api/client-errors')).toHaveLength(1)
    noise.mockRestore()
  })
})

describe('profile page', () => {
  it('shows who the player is and lets them change the language; a guest is sent to sign in', async () => {
    stubApi({ 'GET /api/auth/me': () => ({ body: { id: 'u1', username: 'anna', role: 'USER' } }) })
    const view = renderApp('/profilo')
    expect(await screen.findByRole('heading', { level: 1, name: 'Profilo' })).toBeVisible()
    expect(screen.getByText('Giocatore')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lingua' })).toBeInTheDocument()
    view.unmount()

    stubApi({ ...guest })
    renderApp('/profilo')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entra in Looters' })).toBeVisible()
  })
})
