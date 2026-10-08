import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { matchApi, type MatchState } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

/**
 * Merging own territories into one area: chosen here or on the map, with
 * the cost and, when it cannot be done, the reason (PROMPT §2.10, §11).
 */
export function MergePage(props: {
  state: MatchState
  chosen: string[]
  onChoose: (territoryIds: string[]) => void
}) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const nameId = useId()
  const [name, setName] = useState('')
  const { state, chosen } = props
  const matchId = state.match.id
  const mine = state.territories
    .filter((territory) => territory.ownerEmpireId === state.me?.empireId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const preview = useQuery({
    queryKey: ['matches', 'merge-preview', matchId, [...chosen].sort(), state.match.currentTurn],
    queryFn: () => matchApi.previewMerge(matchId, chosen),
    placeholderData: keepPreviousData,
  })
  const merge = useMutation({
    mutationFn: () =>
      matchApi.merge(matchId, {
        territoryIds: chosen,
        name: name.trim(),
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      void queryClient.invalidateQueries({ queryKey: ['matches', 'areas', matchId] })
      props.onChoose([])
      setName('')
    },
  })
  const toggle = (territoryId: string) => {
    merge.reset()
    props.onChoose(
      chosen.includes(territoryId)
        ? chosen.filter((id) => id !== territoryId)
        : [...chosen, territoryId],
    )
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    merge.mutate()
  }
  const plan = preview.data
  const areas = mine.filter((territory) => territory.isArea)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="merge-title">
      <h2 id="merge-title" className="text-lg">
        {t('game.merge.title')}
      </h2>
      <p className="text-muted-foreground text-base">{t('game.merge.intro')}</p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="font-display mb-1 text-base">{t('game.merge.pick')}</legend>
          <p className="text-muted-foreground text-base">{t('game.merge.pickHint')}</p>
          {mine.map((territory) => (
            <label
              key={territory.id}
              className="has-[:checked]:border-foreground flex items-center gap-2 rounded-md border px-3 py-2 has-[:disabled]:opacity-60"
            >
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={chosen.includes(territory.id)}
                disabled={territory.battleId !== null}
                onChange={() => toggle(territory.id)}
              />
              <span className="flex-1">
                {t('game.merge.option', { name: territory.name, count: territory.resources ?? 0 })}
              </span>
              {territory.battleId !== null && (
                <span className="text-muted-foreground text-base">
                  {t('game.merge.lockedOption')}
                </span>
              )}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <Label htmlFor={nameId}>{t('game.merge.name')}</Label>
          <Input
            id={nameId}
            required
            minLength={2}
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {plan && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 [&_dd]:text-right [&_dd]:font-mono [&_dd]:font-bold">
            <dt>{t('game.merge.perTerritory')}</dt>
            <dd>{plan.perTerritory}</dd>
            <dt>{t('game.merge.total')}</dt>
            <dd>{plan.cost}</dd>
            <dt>{t('game.merge.available')}</dt>
            <dd>{plan.available}</dd>
          </dl>
        )}
        {/* The reason is always spelled out when the merge is not possible. */}
        {plan?.problem && (
          <p className="text-danger">
            {t(`game.merge.problem.${plan.problem}` as 'game.merge.problem.TOO_FEW', {
              max: plan.maxUnits,
            })}
          </p>
        )}
        {merge.error && (
          <p role="alert" className="text-danger">
            {errorText(merge.error)}
          </p>
        )}
        <Button
          type="submit"
          className="self-start"
          disabled={!plan || plan.problem !== null || merge.isPending}
        >
          {t('game.merge.submit')}
        </Button>
      </form>

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-base">{t('game.merge.areas')}</h3>
        {areas.length === 0 && <p className="text-muted-foreground">{t('game.merge.noAreas')}</p>}
        <ul className="flex flex-col gap-1">
          {areas.map((area) => (
            <li key={area.id}>
              {t('game.merge.areaItem', { name: area.name, count: area.geoUnitIds.length })}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
