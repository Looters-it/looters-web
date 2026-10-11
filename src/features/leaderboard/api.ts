import { apiGet } from '@/lib/api'

export type LeaderboardSort = 'rank' | 'username' | 'matches' | 'elo' | 'turns'

export interface LeaderboardPlayer {
  /** The place in the whole ranking, whatever is searched: level players share it. */
  rank: number
  username: string
  /** Matches played to their end. */
  matches: number
  elo: number
  /** Turns played in those matches. */
  turns: number
}

export interface LeaderboardPageData {
  players: LeaderboardPlayer[]
  total: number
  page: number
  pageSize: number
}

export const leaderboardApi = {
  list: (query: {
    search: string
    minMatches: number
    sort: LeaderboardSort
    order: 'asc' | 'desc'
    page: number
    pageSize: number
  }) => {
    const params = new URLSearchParams({
      sort: query.sort,
      order: query.order,
      page: String(query.page),
      pageSize: String(query.pageSize),
      minMatches: String(query.minMatches),
    })
    if (query.search.trim() !== '') params.set('search', query.search.trim())
    return apiGet<LeaderboardPageData>(`/leaderboard?${params.toString()}`)
  },
}
