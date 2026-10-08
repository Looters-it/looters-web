import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { openRealtimeSocket, type RealtimeSocket } from '@/features/realtime/socket'

import * as authApi from './api'
import type { Credentials, Registration, User } from './api'
import { SessionContext, type SessionState } from './session-context'

/**
 * Owns the signed-in user and the realtime socket together: the socket is
 * authenticated by the session cookie, so every change of session reopens it.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [online, setOnline] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const socketRef = useRef<RealtimeSocket | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    authApi
      .fetchCurrentUser(controller.signal)
      .then(setUser)
      .catch(() => {
        if (!controller.signal.aborted) setUser(null)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const socket = openRealtimeSocket({
      onStatus: (connected) => {
        if (!connected) setOnline(null)
      },
      onMessage: (message) => {
        if (message.t === 'online') setOnline(message.n)
        if (message.t === 'session.revoked') {
          // The server ended the session: become a guest and say why.
          setUser((current) => {
            if (current) setSessionEnded(true)
            return null
          })
          socket.reconnect()
        }
      },
    })
    socketRef.current = socket
    return () => socket.close()
  }, [])

  const signedIn = useCallback((next: User) => {
    setSessionEnded(false)
    setUser(next)
    socketRef.current?.reconnect()
  }, [])

  const value = useMemo<SessionState>(
    () => ({
      user,
      online,
      sessionEnded,
      login: async (credentials: Credentials) => signedIn(await authApi.login(credentials)),
      register: async (registration: Registration) =>
        signedIn(await authApi.register(registration)),
      logout: async () => {
        // Leave first, so the server closing the socket is not read as a revocation.
        setUser(null)
        await authApi.logout()
        socketRef.current?.reconnect()
      },
      dismissSessionEnded: () => setSessionEnded(false),
      followMatch: (matchId, handler) =>
        socketRef.current?.followMatch(matchId, handler) ?? (() => undefined),
    }),
    [user, online, sessionEnded, signedIn],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
