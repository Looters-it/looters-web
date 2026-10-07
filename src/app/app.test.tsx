import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderApp } from '@/test/render'

function stubStatus(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  )
}

describe('homepage', () => {
  it('shows the Italian interface and the state of each service', async () => {
    stubStatus({
      status: 'ok',
      database: true,
      jobs: { lastPongAt: '2026-01-01T00:00:00.000Z' },
      battleQueue: true,
    })
    renderApp()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conquista i comuni')
    expect(await screen.findAllByText('attivo')).toHaveLength(4)
    expect(fetch).toHaveBeenCalledWith('/api/health/ready', expect.anything())
  })

  it('reports the database down and jobs still waiting', async () => {
    stubStatus(
      { status: 'unavailable', database: false, jobs: { lastPongAt: null }, battleQueue: true },
      503,
    )
    renderApp()

    expect(await screen.findByText('non raggiungibile')).toBeInTheDocument()
    expect(screen.getAllByText('attivo')).toHaveLength(2)
    expect(screen.getByText('in attesa')).toBeInTheDocument()
  })

  it('reports the API unreachable when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network'))),
    )
    renderApp()

    expect(await screen.findByText('non raggiungibile')).toBeInTheDocument()
    expect(screen.getAllByText('in attesa')).toHaveLength(3)
  })

  it('opens the account popover from the navbar', async () => {
    stubStatus({ status: 'ok', database: true, jobs: { lastPongAt: null }, battleQueue: true })
    renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Accesso e registrazione' }))
    expect(await screen.findByText(/non sono ancora disponibili/)).toBeInTheDocument()
  })
})

describe('routing', () => {
  it('shows the not-found page for unknown paths', () => {
    stubStatus({})
    renderApp('/non-esiste')

    expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alla homepage' })).toHaveAttribute('href', '/')
  })
})
