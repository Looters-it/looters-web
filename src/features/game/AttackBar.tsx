import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Anchor, Plane, Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { matchApi, type MatchState, type UnitCardData } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

/**
 * An attack prepared on the map: the target is chosen, and the player taps the own
 * territories it starts from, ports and airports among them, each lit on the map and
 * joined to the target by a curve once chosen. Here, over the map, what it adds up to
 * (strength and cost) and the two ways out: attack, or leave it.
 */
export function AttackBar(props: {
  state: MatchState
  card: UnitCardData
  chosen: string[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, card, chosen } = props
  const matchId = state.match.id
  const sources = card.attack?.from.filter((source) => source.usable) ?? []
  const count = (via: 'land' | 'sea' | 'air') =>
    sources.filter((source) => source.via === via).length

  const preview = useQuery({
    queryKey: ['matches', 'attack-preview', matchId, card.geoUnitId, [...chosen].sort()],
    queryFn: () =>
      matchApi.previewAttack(matchId, {
        targetGeoUnitId: card.geoUnitId,
        fromTerritoryIds: chosen,
      }),
    enabled: chosen.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const declare = useMutation({
    mutationFn: () =>
      matchApi.attack(matchId, {
        targetGeoUnitId: card.geoUnitId,
        fromTerritoryIds: chosen,
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      void queryClient.invalidateQueries({ queryKey: ['matches', 'unit', matchId] })
      props.onDone()
    },
  })
  const shown = chosen.length > 0 ? preview.data : undefined
  const error = declare.error ?? (chosen.length > 0 ? preview.error : null)

  return (
    <section
      aria-labelledby="attack-bar-title"
      className="bg-card text-card-foreground animate-in fade-in slide-in-from-top-2 pointer-events-auto flex flex-col gap-2 rounded-lg border-2 px-4 py-3 shadow-lg duration-300"
    >
      <h2 id="attack-bar-title" className="flex items-center gap-2 font-bold">
        <Swords aria-hidden="true" className="size-5 flex-none" />
        {t('game.attackBar.title', { name: card.name })}
      </h2>
      <p className="text-muted-foreground text-base">{t('game.attackBar.hint')}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
        {count('sea') > 0 && (
          <span className="flex items-center gap-1">
            <Anchor aria-hidden="true" className="size-4" />
            {t('game.attackBar.ports', { count: count('sea') })}
          </span>
        )}
        {count('air') > 0 && (
          <span className="flex items-center gap-1">
            <Plane aria-hidden="true" className="size-4" />
            {t('game.attackBar.airports', { count: count('air') })}
          </span>
        )}
        {count('land') > 0 && <span>{t('game.attackBar.borders', { count: count('land') })}</span>}
      </p>
      {shown ? (
        <p role="status" className="text-lg">
          {t('game.attackBar.sum', {
            count: chosen.length,
            force: shown.force,
            cost: shown.totalCost,
            pct: shown.pct,
          })}
        </p>
      ) : (
        <p role="status" className="text-lg">
          {t('game.attackBar.none')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {errorText(error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={chosen.length === 0 || !shown || declare.isPending}
          onClick={() => declare.mutate()}
        >
          {t('game.attack.confirm')}
        </Button>
        <Button variant="quiet" size="sm" onClick={props.onDone}>
          {t('game.attackBar.cancel')}
        </Button>
      </div>
    </section>
  )
}
