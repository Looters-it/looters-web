import { createContext, useContext } from 'react'

import type { MatchMessage } from '@/features/realtime/socket'

import type { Credentials, Registration, User } from './api'

export interface SessionState {
  /** `undefined` while the first check is still running, `null` for a guest. */
  user: User | null | undefined
  /** Users connected right now across the platform; null until the server says. */
  online: number | null
  /** True when the server ended the session (revoked or expired) under the user. */
  sessionEnded: boolean
  login(credentials: Credentials): Promise<void>
  register(registration: Registration): Promise<void>
  logout(): Promise<void>
  dismissSessionEnded(): void
  /** Follows the live updates of a match; returns the function that stops. */
  followMatch(matchId: string, handler: (message: MatchMessage) => void): () => void
}

export const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}
