import { screen, waitFor, within } from '@testing-library/react'
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

const asAdmin = {
  'GET /api/auth/me': () => ({ body: { id: 'a', username: 'admin', role: 'ADMIN' } }),
}
const stats = {
  'GET /api/admin/stats': () => ({ body: { users: 12345, matchesRunning: 3, online: 57 } }),
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole('tab', { name }))
}

describe('admin dashboard', () => {
  it('does not exist for guests and normal users', async () => {
    stubApi({ ...guest })
    renderApp('/admin')
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })

  it('shows registered users, running matches and connected users', async () => {
    stubApi({ ...asAdmin, ...stats })
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'Dashboard admin' })).toBeInTheDocument()
    expect(await screen.findByText('12.345')).toBeInTheDocument()
    expect(screen.getByText('Partite in corso').nextSibling).toHaveTextContent('3')
    expect(screen.getByText('Connessi adesso').nextSibling).toHaveTextContent('57')
  })

  it('lists the sessions and revokes one after confirmation', async () => {
    const session = (id: string, username: string, extra = {}) => ({
      id,
      createdAt: '2026-10-07T10:00:00.000Z',
      lastSeenAt: '2026-10-07T12:00:00.000Z',
      expiresAt: '2026-11-06T10:00:00.000Z',
      ip: '10.0.0.1',
      userAgent: 'test',
      user: { id, username, role: 'USER' },
      connected: false,
      current: false,
      ...extra,
    })
    let revoked = false
    const calls = stubApi({
      ...asAdmin,
      ...stats,
      'GET /api/admin/sessions': () => ({
        body: [
          session('s1', 'admin', { current: true }),
          ...(revoked ? [] : [session('s2', 'mario_rossi', { connected: true })]),
        ],
      }),
      'DELETE /api/admin/sessions/s2': () => {
        revoked = true
        return { status: 204 }
      },
    })
    renderApp('/admin')
    await openTab('Sessioni')

    expect(await screen.findByText('2 sessioni attive')).toBeInTheDocument()
    const [own, other] = screen.getAllByRole('button', { name: 'Revoca' })
    // The admin cannot cut the branch it sits on.
    expect(own).toBeDisabled()

    await userEvent.click(other!)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Revocare la sessione di mario_rossi?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoca' }))

    expect(await screen.findByText('1 sessione attiva')).toBeInTheDocument()
    expect(calls.some((call) => call.key === 'DELETE /api/admin/sessions/s2')).toBe(true)
  })
})

describe('geographic data', () => {
  const italy = { id: 'it', name: 'Italia', parentId: null, uploadCount: 0, unitCount: 133 }
  const north = { id: 'no', name: 'Nord', parentId: 'it', uploadCount: 1, unitCount: 133 }
  const upload = (extra: object) => ({
    id: 'u1',
    areaId: 'no',
    filename: 'milano.geojson',
    format: 'GEOJSON',
    status: 'DONE',
    progress: 100,
    unitCount: 133,
    adjacencyCount: 360,
    sizeBytes: 2_097_152,
    error: null,
    createdAt: '2026-10-07T10:00:00.000Z',
    finishedAt: '2026-10-07T10:00:05.000Z',
    ...extra,
  })

  it('creates an area, then shows the tree with the municipalities of each folder', async () => {
    let areas: object[] = []
    const calls = stubApi({
      ...asAdmin,
      ...stats,
      'GET /api/admin/geo/areas': () => ({ body: areas }),
      'POST /api/admin/geo/areas': () => {
        areas = [italy, north]
        return { status: 201, body: italy }
      },
      'GET /api/admin/geo/uploads?areaId=it': () => ({ body: [] }),
    })
    renderApp('/admin')
    await openTab('Dati geografici')

    expect(await screen.findByText(/Nessuna area/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuova area' }))
    await userEvent.type(await screen.findByLabelText('Nome'), 'Italia')
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }))

    const tree = await screen.findByRole('list', { name: 'Aree e cartelle' })
    expect(await within(tree).findByRole('button', { name: /Italia/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(tree).getByRole('button', { name: /Nord/ })).toHaveTextContent('133')
    expect(calls.find((call) => call.key === 'POST /api/admin/geo/areas')?.body).toEqual({
      name: 'Italia',
    })
    expect(await screen.findByText('Nessun file caricato in questa cartella.')).toBeInTheDocument()
  })

  it('uploads a file and follows its processing until the result', async () => {
    let state: object[] = []
    const calls = stubApi({
      ...asAdmin,
      ...stats,
      'GET /api/admin/geo/areas': () => ({ body: [italy, north] }),
      'GET /api/admin/geo/uploads?areaId=no': () => {
        const current = state
        // The next poll finds the processing finished.
        if (state.length) state = [upload({})]
        return { body: current }
      },
      'POST /api/admin/geo/areas/no/uploads': () => {
        state = [upload({ status: 'PROCESSING', progress: 40 })]
        return { status: 201, body: state[0] }
      },
    })
    renderApp('/admin')
    await openTab('Dati geografici')
    await userEvent.click(await screen.findByRole('button', { name: /Nord/ }))

    const file = new File(['{"type":"FeatureCollection"}'], 'milano.geojson')
    await userEvent.upload(await screen.findByLabelText('File da caricare'), file)

    const bar = await screen.findByRole('progressbar', { name: 'Elaborazione di milano.geojson' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(await screen.findByText('133 comuni · 360 confini', {}, { timeout: 4000 })).toBeVisible()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(calls.some((call) => call.key === 'POST /api/admin/geo/areas/no/uploads')).toBe(true)
  })

  it('explains why a file was refused, feature by feature', async () => {
    const error = JSON.stringify({
      code: 'FEATURE_PROBLEMS',
      total: 5,
      problems: [
        { feature: 2, code: 'MISSING_NAME' },
        { feature: 7, name: 'Metri', code: 'BAD_COORDINATES' },
      ],
    })
    stubApi({
      ...asAdmin,
      ...stats,
      'GET /api/admin/geo/areas': () => ({ body: [italy, north] }),
      'GET /api/admin/geo/uploads?areaId=no': () => ({
        body: [upload({ status: 'FAILED', progress: 0, error })],
      }),
    })
    renderApp('/admin')
    await openTab('Dati geografici')
    await userEvent.click(await screen.findByRole('button', { name: /Nord/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Nessun comune è stato caricato.')
    expect(alert).toHaveTextContent('Elemento 2 (senza nome): manca il nome.')
    expect(alert).toHaveTextContent('Elemento 7 (Metri): le coordinate non sono in WGS84')
    expect(alert).toHaveTextContent('e altri 3 elementi')
  })

  it('shows the neighbours of a municipality and adds one by hand', async () => {
    const unit = (id: number, name: string) => ({ id, name, code: null, area: { name: 'Italia' } })
    let neighbours: object[] = []
    const calls = stubApi({
      ...asAdmin,
      ...stats,
      'GET /api/admin/geo/areas': () => ({ body: [italy] }),
      'GET /api/admin/geo/units?q=mes': () => ({ body: [unit(1, 'Messina')] }),
      'GET /api/admin/geo/units?q=villa': () => ({ body: [unit(2, 'Villa San Giovanni')] }),
      'GET /api/admin/geo/units/1/neighbours': () => ({ body: neighbours }),
      'POST /api/admin/geo/adjacency': () => {
        neighbours = [{ ...unit(2, 'Villa San Giovanni'), manual: true }]
        return { status: 201, body: {} }
      },
    })
    renderApp('/admin')
    await openTab('Dati geografici')

    await userEvent.type(await screen.findByLabelText('Comune'), 'mes')
    await userEvent.click(await screen.findByRole('button', { name: /Messina/ }))
    expect(await screen.findByText('Nessun comune confinante.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Aggiungi un confinante a Messina'), 'villa')
    await userEvent.click(await screen.findByRole('button', { name: /Villa San Giovanni/ }))

    expect(await screen.findByText('aggiunto a mano')).toBeInTheDocument()
    await waitFor(() =>
      expect(calls.find((call) => call.key === 'POST /api/admin/geo/adjacency')?.body).toEqual({
        aId: 1,
        bId: 2,
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Rimuovi il confine con Villa San Giovanni' }),
    ).toBeInTheDocument()
  })
})
