import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Castle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { matchApi, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

import { scoreOf } from './battles'

/**
 * The sieges the player is laying, over the map: how the last round went, what the
 * next costs, and the way out. Each stays until it is over; how it ends is said by the
 * announcement in the middle of the map.
 */
export function SiegeToasts(props: { state: MatchState }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state } = props
  const matchId = state.match.id
  const withdraw = useMutation({
    mutationFn: (battleId: string) => matchApi.liftSiege(matchId, battleId),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })
  const mine = state.battles.filter((battle) => battle.role === 'attacker')
  const sieges = mine.filter((battle) => battle.status === 'OPEN' && battle.round > 1)
  if (sieges.length === 0) return null

  return (
    <ul aria-label={t('game.siege.label')} className="pointer-events-auto flex flex-col gap-2">
      {sieges.map((battle) => {
        const score = scoreOf(battle.share)
        return (
          <li
            key={battle.id}
            className="bg-card text-card-foreground animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 rounded-lg border py-2 pr-2 pl-4 shadow-lg duration-300"
          >
            <div className="flex items-center gap-3">
              <Castle aria-hidden="true" className="size-5 flex-none" />
              <p className="min-w-0 flex-1 font-bold">
                {t('game.siege.attacking', { name: battle.targetName, round: battle.round })}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={withdraw.isPending || battle.withdrawn}
                onClick={() => withdraw.mutate(battle.id)}
              >
                {t('game.siege.withdraw')}
              </Button>
            </div>
            <p className="text-muted-foreground text-base">
              {score && t('game.siege.lastRound', score)}{' '}
              {t(battle.foughtThisTurn ? 'game.siege.nextTurn' : 'game.siege.thisTurn', {
                count: battle.nextCost ?? 0,
              })}
            </p>
            {withdraw.error && withdraw.variables === battle.id && (
              <p role="alert" className="text-danger">
                {errorText(withdraw.error)}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
