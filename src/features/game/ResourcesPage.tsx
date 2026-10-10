import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { matchApi, type MatchState, type Territory } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

import { sameAmounts, setAmount, splitEqually, totalOf, type Amounts } from './allocation'

/**
 * One slider per municipality. The total stays fixed: lowering one frees
 * resources for the others, and nothing is saved until "Applica", which is
 * available only when nothing is left unallocated (PROMPT §2.4, §11).
 */
function Editor(props: { state: MatchState; territories: Territory[]; capitalId: string | null }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, territories } = props
  const matchId = state.match.id

  const saved = useMemo<Amounts>(
    () =>
      Object.fromEntries(territories.map((territory) => [territory.id, territory.resources ?? 0])),
    [territories],
  )
  const total = totalOf(saved)
  const [draft, setDraft] = useState(saved)
  const unallocated = total - totalOf(draft)
  const locked = territories.filter((territory) => territory.battleId !== null)
  const free = territories.filter((territory) => territory.battleId === null)
  const dirty = !sameAmounts(draft, saved)

  const apply = useMutation({
    mutationFn: () =>
      matchApi.allocate(matchId, {
        // Only what can move is sent: the api refuses a territory in a battle.
        amounts: Object.fromEntries(
          free.map((territory) => [territory.id, draft[territory.id] ?? 0]),
        ),
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })
  const change = (next: Amounts) => {
    apply.reset()
    setDraft(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="[&_dt]:text-muted-foreground grid grid-cols-3 gap-2 text-center [&_dd]:font-mono [&_dd]:text-xl [&_dd]:font-bold [&_dt]:text-base">
        <div>
          <dt>{t('game.resources.units')}</dt>
          <dd>{territories.reduce((sum, territory) => sum + territory.geoUnitIds.length, 0)}</dd>
        </div>
        <div>
          <dt>{t('game.resources.total')}</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>{t('game.resources.unallocated')}</dt>
          <dd aria-live="polite" className={unallocated > 0 ? 'text-danger' : undefined}>
            {unallocated}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-col gap-3">
        {territories.map((territory) => {
          const amount = draft[territory.id] ?? 0
          return (
            <li key={territory.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  {territory.name}
                  {territory.battleId && (
                    <span className="text-danger"> · {t('game.resources.locked')}</span>
                  )}
                  {territory.id === props.capitalId && (
                    <span className="text-muted-foreground"> · {t('match.unit.capital')}</span>
                  )}
                </span>
                <span className="font-mono font-bold">{amount}</span>
              </div>
              <Slider
                aria-label={t('game.resources.sliderOf', { name: territory.name })}
                min={0}
                // The scale is the whole treasury, so every slider reads the same way.
                max={Math.max(total, 1)}
                step={1}
                value={[amount]}
                // A municipality in a battle can neither give nor receive resources.
                disabled={territory.battleId !== null}
                onValueChange={([wanted]) =>
                  change(setAmount(draft, total, territory.id, wanted ?? 0))
                }
              />
            </li>
          )
        })}
      </ul>

      {apply.error && (
        <p role="alert" className="text-danger">
          {errorText(apply.error)}
        </p>
      )}
      {unallocated > 0 && (
        <p className="text-muted-foreground">
          {t('game.resources.assignAll', { count: unallocated })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            change({
              // Municipalities in a battle keep what they have; the rest is divided.
              ...draft,
              ...splitEqually(
                free.map((territory) => territory.id),
                total - locked.reduce((sum, territory) => sum + (territory.resources ?? 0), 0),
                props.capitalId,
              ),
            })
          }
        >
          {t('game.resources.equal')}
        </Button>
        <Button variant="quiet" size="sm" disabled={!dirty} onClick={() => change(saved)}>
          {t('game.resources.cancel')}
        </Button>
        <Button
          size="sm"
          disabled={!dirty || unallocated !== 0 || apply.isPending}
          onClick={() => apply.mutate()}
        >
          {t('game.resources.apply')}
        </Button>
      </div>
    </div>
  )
}

/** How each turn's income is split among the territories: a permanent rule of the empire. */
function IncomeRule({ state, territories }: { state: MatchState; territories: Territory[] }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const id = useId()
  const matchId = state.match.id
  const mode = state.me?.allocationMode ?? 'EQUAL'

  const save = useMutation({
    mutationFn: (next: 'EQUAL' | 'WEIGHTED') =>
      matchApi.setAllocationRule(matchId, {
        mode: next,
        // "As now": each territory weighs what it holds at this moment.
        ...(next === 'WEIGHTED'
          ? {
              weights: Object.fromEntries(
                territories.map((territory) => [territory.id, territory.resources ?? 0]),
              ),
            }
          : {}),
      }),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })

  return (
    <div className="flex flex-col gap-1 pt-4">
      <Label htmlFor={id}>{t('game.resources.rule', { count: state.me?.turnValue ?? 0 })}</Label>
      <Select
        value={mode}
        onValueChange={(next) => save.mutate(next as 'EQUAL' | 'WEIGHTED')}
        disabled={save.isPending}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EQUAL">{t('game.resources.ruleEqual')}</SelectItem>
          <SelectItem value="WEIGHTED">{t('game.resources.ruleWeighted')}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-base">{t('game.resources.ruleHint')}</p>
      {save.error && (
        <p role="alert" className="text-danger">
          {errorText(save.error)}
        </p>
      )}
    </div>
  )
}

export function ResourcesPage({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const mine = state.empires.find((empire) => empire.id === state.me?.empireId)
  const territories = useMemo(
    () =>
      state.territories
        .filter((territory) => territory.ownerEmpireId === mine?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mine?.id, state.territories],
  )
  if (!mine) return null
  const total = territories.reduce((sum, territory) => sum + (territory.resources ?? 0), 0)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="resources-title">
      <h2 id="resources-title" className="sr-only">
        {t('game.resources.title')}
      </h2>
      {/* Keyed by what the server holds: income or an annexation restarts the editor from the truth. */}
      <Editor
        key={`${state.match.currentTurn}:${total}:${territories.length}`}
        state={state}
        territories={territories}
        capitalId={mine.capitalTerritoryId}
      />
      <IncomeRule state={state} territories={territories} />
    </section>
  )
}
