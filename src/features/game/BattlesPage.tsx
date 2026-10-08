import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { Battle, MatchState } from '@/features/matches/api'

/** The battles in progress, and for a player the outcome of their latest ones. */
export function BattlesPage(props: { state: MatchState; onRespond: () => void }) {
  const { t } = useTranslation()
  const { state } = props
  const name = (empireId: string) =>
    state.empires.find((empire) => empire.id === empireId)?.name ?? ''
  const open = state.battles.filter((battle) => battle.status === 'OPEN')
  const recent = state.battles.filter((battle) => battle.status === 'RESOLVED' && battle.role)

  const headline = (battle: Battle) =>
    battle.role === 'attacker'
      ? t('game.battles.attacking', {
          name: battle.targetName,
          empire: name(battle.defenderEmpireId),
        })
      : battle.role === 'defender'
        ? t('game.battles.defending', {
            name: battle.targetName,
            empire: name(battle.attackerEmpireId),
          })
        : t('game.battles.watching', {
            name: battle.targetName,
            attacker: name(battle.attackerEmpireId),
            defender: name(battle.defenderEmpireId),
          })

  return (
    <section className="flex flex-col gap-4" aria-labelledby="battles-title">
      <h2 id="battles-title" className="text-lg">
        {t('game.battles.title')}
      </h2>
      {open.length === 0 && recent.length === 0 && (
        <p className="text-muted-foreground">{t('game.battles.none')}</p>
      )}

      {open.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{t('game.battles.open')}</h3>
          <ul className="flex flex-col gap-2">
            {open.map((battle) => (
              <li key={battle.id} className="flex flex-col gap-1 rounded-md border p-3">
                <p className="font-bold">{headline(battle)}</p>
                <p className="text-base">
                  {t('game.battles.from', { names: battle.fromNames.join(', ') })}
                </p>
                {battle.role === 'attacker' && (
                  <p className="text-muted-foreground text-base">
                    {t('game.battles.yourCost', { count: battle.attackCost ?? 0 })}{' '}
                    {t('game.battles.waiting')}
                  </p>
                )}
                {battle.role === 'defender' &&
                  (battle.response ? (
                    <p className="text-muted-foreground text-base">{t('game.battles.answered')}</p>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="self-start"
                      onClick={props.onRespond}
                    >
                      {t('game.battles.respond')}
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{t('game.battles.recent')}</h3>
          <ul className="flex flex-col gap-2">
            {recent.map(
              (battle) =>
                battle.role &&
                battle.outcome && (
                  <li key={battle.id} className="rounded-md border p-3">
                    {t(`game.battles.outcome.${battle.role}.${battle.outcome}`, {
                      name: battle.targetName,
                    })}
                  </li>
                ),
            )}
          </ul>
        </div>
      )}
    </section>
  )
}
