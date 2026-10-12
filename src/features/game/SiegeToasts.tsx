import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Castle, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { matchApi, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

import { scoreOf } from './battles'

/**
 * The attacks of the player, over the map: a siege that goes on, with how its last
 * round went and what the next costs, and the way out of it; then how each attack
 * ended, and by how much. A siege stays until it is over; an outcome until it is closed.
 */
export function SiegeToasts(props: { state: MatchState }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state } = props
  const matchId = state.match.id
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const withdraw = useMutation({
    mutationFn: (battleId: string) => matchApi.liftSiege(matchId, battleId),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })
  const mine = state.battles.filter((battle) => battle.role === 'attacker')
  const sieges = mine.filter((battle) => battle.status === 'OPEN' && battle.round > 1)
  const ended = mine.filter(
    (battle) => battle.status === 'RESOLVED' && battle.outcome && !closed.has(battle.id),
  )
  if (sieges.length === 0 && ended.length === 0) return null

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
      {ended.map((battle) => {
        const score = scoreOf(battle.share)
        return (
          <li
            key={battle.id}
            role="status"
            className="bg-card text-card-foreground animate-in fade-in slide-in-from-top-2 flex items-center gap-3 rounded-lg border py-2 pr-2 pl-4 shadow-lg duration-300"
          >
            <p className="min-w-0 flex-1">
              <span className="font-bold">
                {t(`game.battles.outcome.attacker.${battle.outcome ?? 'CANCELLED'}`, {
                  name: battle.targetName,
                })}
              </span>
              {score && battle.rounds.length > 0 && (
                <span className="block">
                  {t('game.battles.score', score)}
                  {battle.rounds.length > 1 &&
                    ` ${t('game.battles.rounds', { count: battle.rounds.length })}`}
                </span>
              )}
              {battle.spoils !== undefined && (
                <span className="block font-bold text-[#1f9d55]">
                  {t('game.battles.spoils', { count: battle.spoils })}
                </span>
              )}
            </p>
            <button
              type="button"
              aria-label={t('game.attackToast.close')}
              onClick={() => setClosed((current) => new Set(current).add(battle.id))}
              className="hover:bg-foreground/10 flex size-9 flex-none cursor-pointer items-center justify-center rounded-full"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
