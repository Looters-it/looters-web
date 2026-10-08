import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useSession } from '@/features/auth/session-context'
import { matchApi } from '@/features/matches/api'

/**
 * The state of a match, kept current: the server says when something
 * changed and the state is read again. Nothing but a hint travels on the
 * socket, so what a viewer may see is decided in one place, the state route.
 */
export function useMatchLive(matchId: string) {
  const queryClient = useQueryClient()
  const { followMatch, user } = useSession()
  const [connected, setConnected] = useState<number | null>(null)

  const state = useQuery({
    queryKey: ['matches', 'state', matchId],
    queryFn: () => matchApi.state(matchId),
    // A safety net for a hint lost while the socket was reconnecting.
    refetchInterval: 30_000,
    retry: false,
  })

  // What a viewer may see depends on who they are: signing in or out reads everything again.
  const userId = user?.id
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['matches', 'state', matchId] })
    void queryClient.invalidateQueries({ queryKey: ['matches', 'unit', matchId] })
  }, [matchId, queryClient, userId])

  useEffect(
    () =>
      followMatch(matchId, (message) => {
        if (message.t === 'match.online') setConnected(message.connected)
        if (message.t === 'match.update') {
          void queryClient.invalidateQueries({ queryKey: ['matches', 'state', matchId] })
          void queryClient.invalidateQueries({ queryKey: ['matches', 'unit', matchId] })
        }
      }),
    // The socket is reopened when the session changes: follow again as the new user.
    [followMatch, matchId, queryClient, userId],
  )

  return { state, connected: connected ?? state.data?.online.connected ?? 0 }
}
