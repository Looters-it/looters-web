import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MatchState } from '@/features/matches/api'

const keyOf = (matchId: string) => `match.endSeen.${matchId}`

/**
 * The announcement that a match is over, to who played it: who won, where the player
 * came and what it left them. It opens by itself when the match ends under the
 * player's eyes, or the first time its page is opened afterwards, and once only. It
 * waits while something else is being said (`hold`): how the last battle went comes
 * before what it decided.
 */
export function EndAnnouncement(props: {
  state: MatchState
  hold?: boolean
  onRanking: () => void
}) {
  const { t } = useTranslation()
  const { state } = props
  const { match } = state
  const finished = match.status === 'FINISHED'
  const mine = state.empires.find((empire) => empire.id === state.me?.empireId)
  const [open, setOpen] = useState(false)
  const hold = props.hold === true

  useEffect(() => {
    if (!finished || !mine || hold) return
    // A moment, for the outcome of a battle that came with the end to ask for its turn.
    const timer = setTimeout(announce, 400)
    return () => clearTimeout(timer)
    // Once for each match that ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, match.id, hold])

  function announce() {
    try {
      if (localStorage.getItem(keyOf(match.id)) !== null) return
      localStorage.setItem(keyOf(match.id), '1')
    } catch {
      // Not remembered: it is announced again, that is all.
    }
    setOpen(true)
  }

  if (!finished || !mine) return null
  const winners = state.empires.filter((empire) => match.winnerEmpireIds.includes(empire.id))
  const iWon = winners.some((empire) => empire.id === mine.id)
  const others = winners.filter((empire) => empire.id !== mine.id).map((empire) => empire.name)
  const title = iWon
    ? winners.length > 1
      ? t('game.end.youTied', { names: others.join(', ') })
      : t('game.end.youWon')
    : winners.length === 0
      ? t('game.end.noWinner')
      : winners.length > 1
        ? t('game.end.tie', { names: winners.map((empire) => empire.name).join(', ') })
        : t('game.end.winner', { name: winners[0]?.name ?? '' })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="text-center">
        <DialogHeader>
          <DialogTitle className="text-center text-4xl sm:text-5xl">{title}</DialogTitle>
          <DialogDescription className="text-center text-lg">
            {t('game.end.announce', { name: match.name, count: match.currentTurn })}
          </DialogDescription>
        </DialogHeader>
        {mine.place !== null && (
          <p className="text-xl">
            {t('game.end.place', { place: mine.place, of: state.empires.length })}
            {mine.award !== null && (
              <b className="ml-2 font-mono text-[#1f9d55]">
                {t('game.end.award', { count: mine.award })}
              </b>
            )}
          </p>
        )}
        <DialogFooter className="sm:justify-center">
          <Button
            onClick={() => {
              setOpen(false)
              props.onRanking()
            }}
          >
            {t('game.end.seeRanking')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
