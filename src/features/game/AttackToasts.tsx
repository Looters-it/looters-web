import { Swords, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { MatchState } from '@/features/matches/api'

/**
 * A warning over the map for every attack on a municipality of the player: who
 * attacks what, with the other announcements at the top of the map. It does not go away by itself: it stays until the player closes
 * it with its X, or the battle is over.
 */
export function AttackToasts(props: {
  state: MatchState
  /** Opens the dialog where the attack is answered. */
  onRespond: () => void
}) {
  const { t } = useTranslation()
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const { state } = props
  const attacks = state.battles.filter(
    (battle) => battle.role === 'defender' && battle.status === 'OPEN' && !closed.has(battle.id),
  )
  if (attacks.length === 0) return null

  return (
    <ul
      aria-label={t('game.attackToast.label')}
      className="pointer-events-auto flex flex-col gap-2"
    >
      {attacks.map((battle) => {
        const attacker = state.empires.find((empire) => empire.id === battle.attackerEmpireId)
        return (
          <li
            key={battle.id}
            role="alert"
            className="bg-destructive text-on-danger animate-in fade-in slide-in-from-top-2 flex items-center gap-3 rounded-lg py-2 pr-2 pl-4 shadow-lg duration-300"
          >
            <Swords aria-hidden="true" className="size-5 flex-none" />
            <p className="min-w-0 flex-1 font-bold">
              {t('game.alert.title', { empire: attacker?.name ?? '', name: battle.targetName })}
            </p>
            {!battle.response && (
              <Button variant="inverted" size="sm" onClick={props.onRespond}>
                {t('game.attackToast.respond')}
              </Button>
            )}
            <button
              type="button"
              aria-label={t('game.attackToast.close')}
              onClick={() => setClosed((current) => new Set(current).add(battle.id))}
              className="hover:bg-on-danger/15 flex size-9 flex-none cursor-pointer items-center justify-center rounded-full"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
