/** Messages pushed by the server (docs/ARCHITECTURE.md, WebSocket). */
export type ServerMessage = { t: 'online'; n: number } | { t: 'session.revoked' } | MatchMessage

/** What the server says about a match the socket follows. */
export type MatchMessage =
  | { t: 'match.update'; matchId: string; kinds: string[] }
  | { t: 'match.online'; matchId: string; connected: number }

export interface RealtimeSocket {
  /** Drops the connection and opens a new one, to pick up a changed session cookie. */
  reconnect(): void
  /**
   * Follows a match: the handler receives what the server says about it,
   * across reconnections. Returns the function that stops following.
   */
  followMatch(matchId: string, handler: (message: MatchMessage) => void): () => void
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
  const followers = new Map<string, Set<(message: MatchMessage) => void>>()
  const tell = (message: object) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  const connect = () => {
    const current = new WebSocket(socketUrl())
    socket = current
    current.onopen = () => {
      retryMs = RETRY_MIN_MS
      options.onStatus(true)
      // A new connection knows nothing of what the old one followed.
      for (const matchId of followers.keys()) tell({ t: 'sub', matchId })
    }
    current.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage
        options.onMessage(message)
        if ('matchId' in message) {
          for (const handler of followers.get(message.matchId) ?? []) handler(message)
        }
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
    followMatch(matchId, handler) {
      const handlers = followers.get(matchId) ?? new Set()
      if (handlers.size === 0) tell({ t: 'sub', matchId })
      handlers.add(handler)
      followers.set(matchId, handlers)
      return () => {
        handlers.delete(handler)
        if (handlers.size > 0) return
        followers.delete(matchId)
        tell({ t: 'unsub', matchId })
      }
    },
    close() {
      closed = true
      drop()
    },
  }
}
