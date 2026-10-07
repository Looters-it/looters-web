import { vi } from 'vitest'

type Handler = (body: unknown) => { status?: number; body?: unknown }

/**
 * Replaces `fetch` with a table of `"METHOD /api/path"` handlers.
 * Unlisted requests answer 404, so a test notices an unexpected call.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${input}`
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ key, body })
      const result = routes[key]?.(body) ?? { status: 404, body: { error: { code: 'NOT_FOUND' } } }
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
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  close() {
    this.closed = true
    this.onclose?.()
  }

  /** The server accepts the connection. */
  open() {
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

export const guest = { 'GET /api/auth/me': () => ({ status: 401, body: { error: {} } }) }
