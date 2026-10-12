import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Swords } from 'lucide-react'
import { useState } from 'react'
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
import { matchApi, type Battle, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

import { pendingAttacks, scoreOf } from './battles'

/**
 * The red button that appears in the navbar while an attack waits for an
 * answer, and the modal dialog where the answer is always given: defend or
 * surrender. The outcome is read in the same dialog (PROMPT §3, §11).
 */
export function BattleAlert(props: {
  state: MatchState
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The attack to show first when the dialog opens by itself: the one on the capital. */
  firstId?: string
}) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state } = props
  const matchId = state.match.id
  const pending = pendingAttacks(state)
  // The battle on screen stays the same while it is answered and resolved,
  // even when it is no longer among the pending ones.
  const [shownId, setShownId] = useState<string | null>(null)
  const battle: Battle | undefined =
    state.battles.find((candidate) => candidate.id === shownId) ??
    pending.find((candidate) => candidate.id === props.firstId) ??
    pending[0]

  const respond = useMutation({
    mutationFn: (action: 'DEFEND' | 'SURRENDER') =>
      matchApi.respond(matchId, battle?.id ?? '', action),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })
  const close = (open: boolean) => {
    if (!open) {
      setShownId(null)
      respond.reset()
    }
    props.onOpenChange(open)
  }

  const attacker = state.empires.find((empire) => empire.id === battle?.attackerEmpireId)
  const mine = state.empires.find((empire) => empire.id === state.me?.empireId)
  const others = pending.filter((candidate) => candidate.id !== battle?.id)
  const score = scoreOf(battle?.share)
  const waiting = battle?.status === 'OPEN' && !battle.response && !battle.foughtThisTurn

  return (
    <>
      {pending.length > 0 && (
        <Button
          variant="destructive"
          size="sm"
          className="animate-pulse motion-reduce:animate-none"
          onClick={() => {
            setShownId(pending[0]?.id ?? null)
            props.onOpenChange(true)
          }}
        >
          <Swords />
          {t('game.alert.button', { count: pending.length })}
        </Button>
      )}

      <Dialog open={props.open && battle !== undefined} onOpenChange={close}>
        {battle && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t(battle.round > 1 ? 'game.siege.defending' : 'game.alert.title', {
                  empire: attacker?.name ?? '',
                  name: battle.targetName,
                  round: battle.round,
                })}
              </DialogTitle>
              <DialogDescription>
                {t('game.battles.from', { names: battle.fromNames.join(', ') })}{' '}
                {waiting && t('game.alert.intro')}
              </DialogDescription>
            </DialogHeader>

            {battle.status === 'RESOLVED' && battle.outcome ? (
              <p role="status" className="text-lg">
                {t(`game.battles.outcome.defender.${battle.outcome}`, { name: battle.targetName })}
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
            ) : battle.response ? (
              <p role="status">{t('game.alert.resolving')}</p>
            ) : battle.foughtThisTurn ? (
              <>
                <p role="status" className="text-lg">
                  {t('game.siege.drawn')} {score && t('game.siege.lastRound', score)}
                </p>
                <p className="text-muted-foreground text-base">{t('game.siege.defenderNext')}</p>
                {respond.error && (
                  <p role="alert" className="text-danger">
                    {errorText(respond.error)}
                  </p>
                )}
              </>
            ) : (
              <>
                {battle.round > 1 && score && (
                  <p className="text-base">{t('game.siege.lastRound', score)}</p>
                )}
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 [&_dd]:text-right [&_dd]:font-mono [&_dd]:font-bold">
                  <dt>{t('game.alert.resources')}</dt>
                  <dd>{battle.defenseForce}</dd>
                  <dt>{t('game.alert.defenseCost')}</dt>
                  <dd>{battle.defenseCost}</dd>
                </dl>
                {mine?.capitalTerritoryId === battle.targetTerritoryId && (
                  <p className="text-danger">{t('game.alert.capital')}</p>
                )}
                <ul className="text-muted-foreground text-base">
                  <li>
                    {t('game.alert.defendHint', {
                      count: battle.defenseCost ?? 0,
                      pct: state.match.config.battleSpoilsPct,
                    })}
                  </li>
                  <li>{t('game.alert.surrenderHint')}</li>
                </ul>
                {respond.error && (
                  <p role="alert" className="text-danger">
                    {errorText(respond.error)}
                  </p>
                )}
              </>
            )}

            <DialogFooter>
              {battle.status === 'OPEN' && !battle.response ? (
                <>
                  <Button
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => {
                      setShownId(battle.id)
                      respond.mutate('SURRENDER')
                    }}
                  >
                    {t('game.alert.surrender')}
                  </Button>
                  {battle.foughtThisTurn ? (
                    <Button variant="quiet" onClick={() => close(false)}>
                      {t('game.alert.close')}
                    </Button>
                  ) : (
                    <Button
                      disabled={respond.isPending}
                      onClick={() => {
                        setShownId(battle.id)
                        respond.mutate('DEFEND')
                      }}
                    >
                      {t('game.alert.defend')}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {others.length > 0 && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        respond.reset()
                        setShownId(others[0]?.id ?? null)
                      }}
                    >
                      {t('game.alert.next')}
                    </Button>
                  )}
                  <Button variant="quiet" onClick={() => close(false)}>
                    {t('game.alert.close')}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
