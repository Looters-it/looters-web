import { vi } from 'vitest'

type Handler = (body: unknown) => { status?: number; body?: unknown }

/**
 * Replaces `fetch` with a table of `"METHOD /api/path"` handlers.
 * Unlisted requests answer 404, so a test notices an unexpected call.
 */
export function stubApi(routes: Record<string, Handler>) {
  // What every page asks for when nothing has been created yet.
  const defaults: Record<string, Handler> = {
    'GET /api/geo/areas': () => ({ body: [] }),
    'GET /api/matches?page=1': () => ({ body: { page: 1, pageSize: 6, total: 0, matches: [] } }),
    'GET /api/matches/mine': () => ({ body: [] }),
    'GET /api/matches/m1/board?': () => ({ body: [] }),
  }
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${input}`
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
      calls.push({ key, body })
      const result = (routes[key] ?? defaults[key])?.(body) ?? {
        status: 404,
        body: { error: { code: 'NOT_FOUND' } },
      }
      const status = result.status ?? 200
      return Promise.resolve(
        new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), { status }),
      )
    }),
  )
  return calls
}

/** A stand-in for the browser WebSocket that tests drive by hand. */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static get latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) throw new Error('no socket was opened')
    return socket
  }

  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  readyState = 0
  /** What the page sent to the server. */
  readonly sent: unknown[] = []
  static readonly OPEN = 1
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.closed = true
    this.readyState = 3
    this.onclose?.()
  }

  /** The server accepts the connection. */
  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  /** The server pushes a message. */
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  static install() {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  }
}

export const healthy = {
  'GET /api/health/ready': () => ({
    body: {
      status: 'ok',
      database: true,
      jobs: { lastPongAt: '2026-01-01T00:00:00.000Z' },
      battleQueue: true,
    },
  }),
}

/** No geographic data loaded: the homepage shows a placeholder instead of the map. */
export const noMap = { 'GET /api/geo/areas': () => ({ body: [] }) }

export const guest = { 'GET /api/auth/me': () => ({ status: 401, body: { error: {} } }) }
