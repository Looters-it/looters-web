/** Messages pushed by the server (docs/ARCHITECTURE.md, WebSocket). */
export type ServerMessage = { t: 'online'; n: number } | { t: 'session.revoked' }

export interface RealtimeSocket {
  /** Drops the connection and opens a new one, to pick up a changed session cookie. */
  reconnect(): void
  close(): void
}

interface Options {
  onMessage: (message: ServerMessage) => void
  onStatus: (connected: boolean) => void
}

const RETRY_MIN_MS = 1000
const RETRY_MAX_MS = 30_000

function socketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

/**
 * Keeps one WebSocket open, reconnecting with growing pauses when it drops.
 * The socket is authenticated by the session cookie at the handshake, so it
 * must be reopened after login and logout.
 */
export function openRealtimeSocket(options: Options): RealtimeSocket {
  let socket: WebSocket | null = null
  let retryMs = RETRY_MIN_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const connect = () => {
    const current = new WebSocket(socketUrl())
    socket = current
    current.onopen = () => {
      retryMs = RETRY_MIN_MS
      options.onStatus(true)
    }
    current.onmessage = (event) => {
      try {
        options.onMessage(JSON.parse(String(event.data)) as ServerMessage)
      } catch {
        // Not a message we understand: ignore it.
      }
    }
    current.onclose = () => {
      if (socket !== current || closed) return
      options.onStatus(false)
      timer = setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
    }
  }

  const drop = () => {
    clearTimeout(timer)
    const current = socket
    socket = null
    current?.close()
  }

  connect()

  return {
    reconnect() {
      if (closed) return
      drop()
      retryMs = RETRY_MIN_MS
      connect()
    },
    close() {
      closed = true
      drop()
    },
  }
}
