import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { matchApi, type BoardEntry, type MatchState } from '@/features/matches/api'

import { useEntryText } from './entry-text'

/** How long an entry stays on the map, and how many at most at once. */
const TOAST_MS = 9000
const TOAST_MAX = 4

/**
 * What is written on the board while the match is watched, shown over the map
 * as it arrives: a line that comes up, stays a few seconds and goes. The board
 * itself keeps them all; these are only the news of the moment.
 */
export function BoardToasts({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const entryText = useEntryText()
  const matchId = state.match.id
  // The same reading as the board: one request for both.
  const board = useQuery({
    queryKey: ['matches', 'board', matchId, '', ''],
    queryFn: () => matchApi.board(matchId, {}),
  })
  const [shown, setShown] = useState<BoardEntry[]>([])
  // What was already there when the page opened is not news.
  const known = useRef<Set<string> | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!board.data) return
    if (known.current === null) {
      known.current = new Set(board.data.map((entry) => entry.id))
      return
    }
    const seen = known.current
    const fresh = board.data.filter((entry) => !seen.has(entry.id))
    if (fresh.length === 0) return
    for (const entry of fresh) seen.add(entry.id)
    setShown((current) => [...fresh, ...current].slice(0, TOAST_MAX))
    const ids = new Set(fresh.map((entry) => entry.id))
    // Each batch leaves at its own time, whatever arrives meanwhile.
    timers.current.push(
      setTimeout(
        () => setShown((current) => current.filter((entry) => !ids.has(entry.id))),
        TOAST_MS,
      ),
    )
  }, [board.data])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  if (shown.length === 0) return null
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))

  return (
    // Decoration for who looks at the map: the board is where they are announced.
    <ol
      aria-label={t('game.board.latest')}
      aria-live="off"
      className="pointer-events-none flex max-w-[min(26rem,calc(100vw-1.5rem))] flex-col-reverse gap-1.5"
    >
      {shown.map((entry, index) => (
        <li
          key={entry.id}
          className="bg-background/95 animate-in fade-in slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-base shadow-sm duration-300"
          style={{ opacity: 1 - index * 0.22 }}
        >
          {entry.empireId && empires.has(entry.empireId) && (
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2.5 rounded-full align-middle"
              style={{ backgroundColor: empires.get(entry.empireId)?.color }}
            />
          )}
          {entry.type === 'MESSAGE' && <b>{entry.data.empireName}: </b>}
          {entryText(entry)}
        </li>
      ))}
    </ol>
  )
}
