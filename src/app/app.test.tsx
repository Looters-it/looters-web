import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conquista i comuni')
    expect(await screen.findByText(/Accedi per creare una partita/)).toBeInTheDocument()
    expect(await screen.findByText(/Non ci sono ancora partite/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crea una partita' })).not.toBeInTheDocument()
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

describe('account popover', () => {
  const mario = { id: 'u1', username: 'mario_rossi', role: 'USER' }

  async function openAccount() {
    await userEvent.click(await screen.findByRole('button', { name: 'Accesso e registrazione' }))
  }

  it('signs in with username and password and reopens the socket', async () => {
    const calls = stubApi({ ...guest, 'POST /api/auth/login': () => ({ body: mario }) })
    renderApp()
    const guestSocket = FakeWebSocket.latest

    await openAccount()
    await userEvent.type(screen.getByLabelText('Nome utente'), 'mario_rossi')
    await userEvent.type(screen.getByLabelText('Password'), 'password-123')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('button', { name: 'Account di mario_rossi' })).toBeVisible()
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

    expect(await screen.findByRole('button', { name: 'Account di mario_rossi' })).toBeVisible()
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

    await userEvent.click(await screen.findByRole('button', { name: 'Account di mario_rossi' }))
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }))

    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeVisible()
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/auth/logout')).toBe(true))
  })

  it('signs the user out and explains when the server revokes the session', async () => {
    stubApi({ 'GET /api/auth/me': () => ({ body: mario }) })
    renderApp()
    await screen.findByRole('button', { name: 'Account di mario_rossi' })
    const revoked = FakeWebSocket.latest

    act(() => revoked.receive({ t: 'session.revoked' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La tua sessione è terminata')
    expect(screen.getByRole('button', { name: 'Accesso e registrazione' })).toBeInTheDocument()
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
    renderApp('/partite/m1?token=secret')

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
    expect(report.path).toBe('/partite/m1')
    expect(report.message).not.toBe('')
    // Reported once, however many times the page tries again.
    expect(calls.filter((call) => call.key === 'POST /api/client-errors')).toHaveLength(1)
    noise.mockRestore()
  })
})
