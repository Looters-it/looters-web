import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState } from 'react'
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
import { matchApi, type MatchState, type Territory } from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

import { rebalance, sameAmounts, splitEqually, totalOf, type Amounts } from './allocation'
import { AllocationRadar } from './AllocationRadar'
import { usePhase } from './phase'

/**
 * The radar of the empire: dragging the point of a municipality changes its share
 * and the others give way in proportion, so the whole is always assigned and the new
 * balance is saved as the finger lifts. Only in the preliminary part of a turn
 * (PROMPT §2.4, §11).
 */
function Editor(props: {
  state: MatchState
  territories: Territory[]
  capitalId: string | null
  editable: boolean
}) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, territories, editable } = props
  const matchId = state.match.id

  const saved = useMemo<Amounts>(
    () =>
      Object.fromEntries(territories.map((territory) => [territory.id, territory.resources ?? 0])),
    [territories],
  )
  const total = totalOf(saved)
  const [draft, setDraft] = useState(saved)
  // What a gesture has reached, read when it ends: the state itself is a render behind.
  const latest = useRef(draft)
  const origin = useRef<Amounts | null>(null)
  const lockedIds = territories
    .filter((territory) => territory.battleId !== null)
    .map((territory) => territory.id)
  const free = territories.filter((territory) => territory.battleId === null)

  const apply = useMutation({
    mutationFn: (amounts: Amounts) =>
      matchApi.allocate(matchId, {
        // Only what can move is sent: the api refuses a territory in a battle.
        amounts: Object.fromEntries(
          free.map((territory) => [territory.id, amounts[territory.id] ?? 0]),
        ),
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
    // Refused: back to what the server holds.
    onError: () => change(saved),
  })
  const change = (next: Amounts) => {
    latest.current = next
    setDraft(next)
  }
  const commit = (amounts = latest.current) => {
    if (!sameAmounts(amounts, saved)) apply.mutate(amounts)
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="[&_dt]:text-muted-foreground grid grid-cols-2 gap-2 text-center [&_dd]:font-mono [&_dd]:text-xl [&_dd]:font-bold [&_dt]:text-base">
        <div>
          <dt>{t('game.resources.units')}</dt>
          <dd>{territories.reduce((sum, territory) => sum + territory.geoUnitIds.length, 0)}</dd>
        </div>
        <div>
          <dt>{t('game.resources.total')}</dt>
          <dd>{total}</dd>
        </div>
      </dl>

      <p className={editable ? 'text-muted-foreground' : 'text-danger'}>
        {t(editable ? 'game.resources.radarHint' : 'game.resources.onlyPreliminary')}
      </p>
      {territories.length < 2 ? (
        <p className="text-muted-foreground">{t('game.resources.single')}</p>
      ) : (
        <AllocationRadar
          axes={territories.map((territory) => ({
            id: territory.id,
            name: territory.name,
            locked: !editable || territory.battleId !== null,
          }))}
          amounts={draft}
          total={total}
          onChange={(id, wanted) => {
            apply.reset()
            // Always from where the gesture began: rebalancing step after step would
            // let the rounding of each step pile up on the same territories.
            origin.current ??= latest.current
            change(rebalance(origin.current, id, wanted, lockedIds))
          }}
          onCommit={() => {
            origin.current = null
            commit()
          }}
        />
      )}

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {territories.map((territory) => {
          const amount = draft[territory.id] ?? 0
          return (
            <li key={territory.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">
                {territory.name}
                {territory.battleId && (
                  <span className="text-danger"> · {t('game.resources.locked')}</span>
                )}
                {territory.id === props.capitalId && (
                  <span className="text-muted-foreground"> · {t('match.unit.capital')}</span>
                )}
              </span>
              <span className="font-mono font-bold whitespace-nowrap">
                {amount}{' '}
                <span className="text-muted-foreground font-normal">
                  {total > 0 ? Math.round((amount / total) * 100) : 0}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      {apply.error && (
        <p role="alert" className="text-danger">
          {errorText(apply.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!editable || free.length < 2 || apply.isPending}
          onClick={() => {
            const next = {
              // Municipalities in a battle keep what they have; the rest is divided.
              ...draft,
              ...splitEqually(
                free.map((territory) => territory.id),
                free.reduce((sum, territory) => sum + (draft[territory.id] ?? 0), 0),
                props.capitalId,
              ),
            }
            change(next)
            commit(next)
          }}
        >
          {t('game.resources.equal')}
        </Button>
        <p role="status" className="text-muted-foreground text-base">
          {apply.isPending
            ? t('game.resources.saving')
            : apply.isSuccess
              ? t('game.resources.saved')
              : ''}
        </p>
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
  const phase = usePhase(state.match)
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
        editable={phase === 'PRELIMINARY'}
      />
      <IncomeRule state={state} territories={territories} />
    </section>
  )
}
