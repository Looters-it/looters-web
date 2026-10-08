import { matchApi } from '@/features/matches/api'

/** A closed turn never changes: read once, kept for the map review too. */
export const turnQuery = (matchId: string, turn: number) => ({
  queryKey: ['matches', 'history', matchId, turn],
  queryFn: () => matchApi.turn(matchId, turn),
  staleTime: Infinity,
})

/** Read again when the match changes: a new turn appears when one closes. */
export const historyQuery = (matchId: string) => ({
  queryKey: ['matches', 'unit', matchId, 'history'],
  queryFn: () => matchApi.history(matchId),
})
