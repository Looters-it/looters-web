import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { MatchState } from '@/features/matches/api'

import { useEntryText } from './entry-text'
import { historyQuery, turnQuery } from './history'

function TurnEvents(props: {
  matchId: string
  turn: number
  onGoTo: (geoUnitId: number, name: string) => void
}) {
  const { t } = useTranslation()
  const entryText = useEntryText()
  const turn = useQuery(turnQuery(props.matchId, props.turn))
  if (!turn.data) return <p className="text-muted-foreground">{t('match.loading')}</p>
  if (turn.data.events.length === 0) {
    return <p className="text-muted-foreground">{t('game.history.nothing')}</p>
  }
  return (
    <ul className="flex flex-col">
      {turn.data.events.map((entry) => {
        const place = entry.data.territoryName
        return (
          <li key={entry.id} className="py-2">
            <p className="break-words">{entryText(entry)}</p>
            {entry.geoUnitId !== null && place && (
              <button
                type="button"
                className="hover:text-primary cursor-pointer text-base underline underline-offset-2"
                onClick={() => props.onGoTo(entry.geoUnitId ?? 0, place)}
              >
                {t('game.board.goTo', { name: place })}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The history of the match (PROMPT §2.12): a card per closed turn, newest
 * first, with what happened in it and the way to see the map as it was.
 */
export function HistoryPage(props: {
  state: MatchState
  /** The turn shown on the map instead of the present, if any. */
  review: number | null
  onReview: (turn: number | null) => void
  onGoTo: (geoUnitId: number, name: string) => void
}) {
  const { t } = useTranslation()
  const matchId = props.state.match.id
  const [open, setOpen] = useState<number | null>(null)
  const turns = useQuery(historyQuery(matchId))

  return (
    <section className="flex flex-col gap-3" aria-labelledby="history-title">
      <h2 id="history-title" className="text-lg">
        {t('game.history.title')}
      </h2>
      {turns.data?.length === 0 && (
        <p className="text-muted-foreground">{t('game.history.empty')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {turns.data?.map(({ turn, events }) => {
          const expanded = open === turn
          return (
            <li key={turn} className="rounded-md border">
              <button
                type="button"
                aria-expanded={expanded}
                className="hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left transition-colors"
                onClick={() => setOpen(expanded ? null : turn)}
              >
                <span className="flex-1 font-bold">{t('game.history.turn', { turn })}</span>
                <span className="text-muted-foreground text-base">
                  {t('game.history.events', { count: events })}
                </span>
                {expanded ? (
                  <ChevronUp aria-hidden className="size-4" />
                ) : (
                  <ChevronDown aria-hidden className="size-4" />
                )}
              </button>
              {expanded && (
                <div className="flex flex-col gap-3 px-3 py-3">
                  <TurnEvents matchId={matchId} turn={turn} onGoTo={props.onGoTo} />
                  <Button
                    variant={props.review === turn ? 'default' : 'quiet'}
                    size="sm"
                    className="self-start"
                    aria-pressed={props.review === turn}
                    onClick={() => props.onReview(props.review === turn ? null : turn)}
                  >
                    {props.review === turn ? t('game.history.present') : t('game.history.review')}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
