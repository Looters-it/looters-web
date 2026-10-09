import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { openRealtimeSocket, type RealtimeSocket } from '@/features/realtime/socket'

import * as authApi from './api'
import type { Credentials, Registration, User } from './api'
import { CURTAIN_MS, CURTAIN_STAY_MS, SessionCurtain, type Curtain } from './SessionCurtain'
import { SessionContext, type SessionState } from './session-context'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Owns the signed-in user and the realtime socket together: the socket is
 * authenticated by the session cookie, so every change of session reopens it.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [online, setOnline] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const socketRef = useRef<RealtimeSocket | null>(null)
  const navigate = useNavigate()
  const [curtain, setCurtain] = useState<Curtain | null>(null)

  // The curtain covers the page, the session changes behind it, then it lifts on
  // whatever page comes next. It is a moment long by design: see SessionCurtain.
  const behindCurtain = useCallback(
    async (kind: Curtain['kind'], name: string, change: () => void | Promise<void>) => {
      setCurtain({ kind, name, lifting: false })
      await pause(CURTAIN_MS.cover)
      try {
        await change()
      } finally {
        void pause(CURTAIN_STAY_MS[kind])
          .then(() => setCurtain((current) => current && { ...current, lifting: true }))
          .then(() => pause(CURTAIN_MS.lift))
          .then(() => setCurtain(null))
      }
    },
    [],
  )

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
      login: async (credentials: Credentials) => {
        const next = await authApi.login(credentials)
        await behindCurtain('in', next.username, () => signedIn(next))
      },
      register: async (registration: Registration) => {
        const next = await authApi.register(registration)
        await behindCurtain('new', next.username, () => signedIn(next))
      },
      logout: () =>
        behindCurtain('out', user?.username ?? '', async () => {
          // To the homepage first: a page for who is signed in would otherwise send its
          // new guest to sign in again.
          await navigate('/')
          // Leave before asking, so the server closing the socket is not read as a revocation.
          setUser(null)
          await authApi.logout()
          socketRef.current?.reconnect()
          // A page that had already sent its guest to sign in gives way: out means home.
          if (window.location.pathname !== '/') await navigate('/', { replace: true })
        }),
      dismissSessionEnded: () => setSessionEnded(false),
      followMatch: (matchId, handler) =>
        socketRef.current?.followMatch(matchId, handler) ?? (() => undefined),
    }),
    [user, online, sessionEnded, signedIn, behindCurtain, navigate],
  )

  return (
    <SessionContext value={value}>
      {children}
      {curtain && <SessionCurtain curtain={curtain} />}
    </SessionContext>
  )
}
