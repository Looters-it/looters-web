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

import { pendingAttacks } from './battles'

/**
 * The red button that appears in the navbar while an attack waits for an
 * answer, and the modal dialog where the answer is always given: defend or
 * surrender. The outcome is read in the same dialog (PROMPT §3, §11).
 */
export function BattleAlert(props: {
  state: MatchState
  open: boolean
  onOpenChange: (open: boolean) => void
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
    state.battles.find((candidate) => candidate.id === shownId) ?? pending[0]

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
                {t('game.alert.title', { empire: attacker?.name ?? '', name: battle.targetName })}
              </DialogTitle>
              <DialogDescription>
                {battle.status === 'OPEN' && !battle.response && t('game.alert.intro')}
              </DialogDescription>
            </DialogHeader>

            {battle.status === 'RESOLVED' && battle.outcome ? (
              <p role="status" className="text-lg">
                {t(`game.battles.outcome.defender.${battle.outcome}`, { name: battle.targetName })}
              </p>
            ) : battle.response ? (
              <p role="status">{t('game.alert.resolving')}</p>
            ) : (
              <>
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
                  <li>{t('game.alert.defendHint', { count: battle.defenseCost ?? 0 })}</li>
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
                  <Button
                    disabled={respond.isPending}
                    onClick={() => {
                      setShownId(battle.id)
                      respond.mutate('DEFEND')
                    }}
                  >
                    {t('game.alert.defend')}
                  </Button>
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
