import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import type { MapUnit } from '@/features/map/GameMap'
import { cn } from '@/lib/utils'

import { matchApi, type EmpireIdentity, type MatchState } from './api'
import { EmpireFields } from './EmpireFields'
import { useMatchErrorText } from './errors'

type Step = 'place' | 'words' | 'looks'
const STEPS: Step[] = ['place', 'words', 'looks']

/**
 * Registration, a step at a time: the player picks a free municipality on the map,
 * which becomes the capital, and confirms it; then gives the empire its name and
 * motto; then its colour and emblem, and founds it.
 */
export function JoinPanel(props: {
  state: MatchState
  /** The municipality picked on the map, when it is free. */
  start: MapUnit | null
  /** Said above the buttons: that the municipality picked is taken, for one. */
  notice?: ReactNode
  /** Shown with the reason, when the viewer cannot register. */
  header?: ReactNode
}) {
  const { t } = useTranslation()
  const { user } = useSession()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, start } = props
  const { match } = state

  const options = useQuery({ queryKey: ['matches', 'options'], queryFn: matchApi.options })
  const taken = new Set(state.empires.map((empire) => empire.color))
  const [identity, setIdentity] = useState<EmpireIdentity | null>(null)
  const [step, setStep] = useState<Step>('place')

  // The first free colour is proposed; it moves on if someone else takes it meanwhile.
  const firstFree = options.data?.colors.find((color) => !taken.has(color))
  const value: EmpireIdentity = identity ?? {
    name: '',
    color: firstFree ?? '',
    emblem: options.data?.emblems[0] ?? '',
    motto: null,
  }
  const current = taken.has(value.color) && firstFree ? { ...value, color: firstFree } : value

  const join = useMutation({
    mutationFn: () =>
      matchApi.join(match.id, {
        geoUnitId: start?.id ?? 0,
        empire: { ...current, name: current.name.trim() },
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', match.id], next)
      return queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const closed =
    match.status === 'FINISHED' || (match.status === 'ONGOING' && match.config.lateJoin !== true)
  const cannot = closed
    ? t('match.join.closed')
    : match.players >= match.maxPlayers
      ? t('match.join.full')
      : user === null
        ? t('match.join.guest')
        : null
  if (cannot) {
    return (
      <>
        {props.header}
        <p className="text-muted-foreground">{cannot}</p>
      </>
    )
  }
  if (!user || !options.data) return null

  // Three steps, one thing at a time: where, then the words, then the looks. Without
  // a place there is only the first; a place that is lost brings back to it.
  const shown: Step = start ? step : 'place'
  const named = current.name.trim().length >= 3
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (shown === 'place') {
      if (start) setStep('words')
    } else if (shown === 'words') {
      if (named) setStep('looks')
    } else if (start) join.mutate()
  }
  const change = (next: EmpireIdentity) => {
    join.reset()
    setIdentity(next)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-labelledby="join-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="join-title" className="text-lg">
          {t('match.join.title')}
        </h2>
        <ol aria-label={t('match.join.steps')} className="flex items-center gap-1.5">
          {STEPS.map((name, index) => (
            <li
              key={name}
              aria-current={name === shown ? 'step' : undefined}
              className={cn(
                'rounded-pill flex size-7 items-center justify-center font-mono text-sm font-bold',
                name === shown
                  ? 'bg-secondary text-white'
                  : index < STEPS.indexOf(shown)
                    ? 'bg-card text-card-foreground'
                    : 'border-border text-muted-foreground border',
              )}
            >
              {index + 1}
            </li>
          ))}
        </ol>
      </div>

      {shown === 'place' ? (
        <p className={start ? 'font-bold' : undefined} aria-live="polite">
          {start ? t('match.join.placeChosen', { name: start.name }) : t('match.join.placeHint')}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            {t('match.join.placeChosen', { name: start?.name ?? '' })}
          </p>
          <EmpireFields
            part={shown}
            value={current}
            onChange={change}
            colors={options.data.colors}
            emblems={options.data.emblems}
            takenColors={taken}
          />
        </>
      )}

      {props.notice}
      {join.error && (
        <p role="alert" className="text-danger">
          {errorText(join.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {shown !== 'place' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(shown === 'looks' ? 'words' : 'place')}
          >
            {t('match.join.back')}
          </Button>
        )}
        {(shown !== 'place' || start) && (
          <Button
            type="submit"
            className="flex-1"
            disabled={(shown === 'words' && !named) || join.isPending}
          >
            {shown === 'place'
              ? t('match.join.confirmPlace')
              : shown === 'words'
                ? t('match.join.next')
                : t('match.join.submit')}
          </Button>
        )}
      </div>
    </form>
  )
}
