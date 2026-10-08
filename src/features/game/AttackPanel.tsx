import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { matchApi, type MatchState, type UnitCardData } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

/**
 * Preparing an attack: the player picks the own territories it starts from
 * (here or on the map), sees strength and cost, and confirms. No chance of
 * victory is shown: the defender's resources are hidden (PROMPT §2.8).
 */
export function AttackPanel(props: {
  state: MatchState
  card: UnitCardData
  /** Territories chosen so far; the page owns them because the map changes them too. */
  chosen: string[]
  onChoose: (territoryIds: string[]) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, card, chosen } = props
  const matchId = state.match.id
  const sources = card.attack?.from ?? []

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
  const toggle = (territoryId: string) =>
    props.onChoose(
      chosen.includes(territoryId)
        ? chosen.filter((id) => id !== territoryId)
        : [...chosen, territoryId],
    )
  const shown = chosen.length > 0 ? preview.data : undefined
  const error = declare.error ?? (chosen.length > 0 ? preview.error : null)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="attack-title">
      <h2 id="attack-title" className="text-xl">
        {t('game.attack.title', { name: card.name })}
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display mb-1 text-base">{t('game.attack.from')}</legend>
        <p className="text-muted-foreground text-base">{t('game.attack.fromHint')}</p>
        {sources.map((source) => (
          <label
            key={source.territoryId}
            className="has-[:checked]:border-foreground flex items-center gap-2 rounded-md border px-3 py-2 has-[:disabled]:opacity-60"
          >
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={chosen.includes(source.territoryId)}
              disabled={!source.usable}
              onChange={() => toggle(source.territoryId)}
            />
            <span className="flex-1">
              {t('game.attack.option', { name: source.name, count: source.resources })}
            </span>
            {!source.usable && (
              <span className="text-muted-foreground text-base">{t('game.attack.unusable')}</span>
            )}
          </label>
        ))}
      </fieldset>

      {shown ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 [&_dd]:text-right [&_dd]:font-mono [&_dd]:font-bold">
          <dt>{t('game.attack.force')}</dt>
          <dd>{shown.force}</dd>
          <dt>{t('game.attack.pct')}</dt>
          <dd>{shown.pct}%</dd>
          {shown.from.length > 1 &&
            shown.from.map((source) => (
              <div
                key={source.territoryId}
                className="text-muted-foreground col-span-2 flex justify-between gap-4 text-base"
              >
                <dt>{source.name}</dt>
                <dd className="font-normal">{source.cost}</dd>
              </div>
            ))}
          <dt>{t('game.attack.cost')}</dt>
          <dd>{shown.totalCost}</dd>
        </dl>
      ) : (
        <p className="text-muted-foreground">{t('game.attack.pick')}</p>
      )}

      <p className="text-muted-foreground text-base">
        {t('game.attack.hidden')} {t('game.attack.reserved')}
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {errorText(error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={chosen.length === 0 || !shown || declare.isPending}
          onClick={() => declare.mutate()}
        >
          {t('game.attack.confirm')}
        </Button>
        <Button variant="quiet" onClick={props.onDone}>
          {t('game.attack.back')}
        </Button>
      </div>
    </section>
  )
}
