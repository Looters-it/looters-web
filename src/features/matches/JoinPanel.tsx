import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/features/auth/session-context'
import type { MapUnit } from '@/features/map/GameMap'

import { matchApi, type EmpireIdentity, type MatchState } from './api'
import { EmpireFields } from './EmpireFields'
import { useMatchErrorText } from './errors'

/**
 * Registration: the player picks a free municipality on the map, which
 * becomes the capital, then gives the empire its name, colour and emblem.
 */
export function JoinPanel(props: {
  state: MatchState
  /** The municipality picked on the map, when it is free. */
  start: MapUnit | null
}) {
  const { t } = useTranslation()
  const { user } = useSession()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const codeId = useId()
  const { state, start } = props
  const { match } = state

  const options = useQuery({ queryKey: ['matches', 'options'], queryFn: matchApi.options })
  const taken = new Set(state.empires.map((empire) => empire.color))
  const [identity, setIdentity] = useState<EmpireIdentity | null>(null)
  const [inviteCode, setInviteCode] = useState('')

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
        ...(match.hasInviteCode ? { inviteCode: inviteCode.trim() } : {}),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', match.id], next)
      return queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const closed =
    match.status === 'FINISHED' || (match.status === 'ONGOING' && match.config.lateJoin !== true)
  if (closed) return <p className="text-muted-foreground">{t('match.join.closed')}</p>
  if (match.players >= match.maxPlayers) {
    return <p className="text-muted-foreground">{t('match.join.full')}</p>
  }
  if (user === null) return <p className="text-muted-foreground">{t('match.join.guest')}</p>
  if (!user || !options.data) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (start) join.mutate()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-labelledby="join-title">
      <h2 id="join-title" className="text-lg">
        {t('match.join.title')}
      </h2>

      <section className="flex flex-col gap-1">
        <h3 className="text-base">1. {t('match.join.stepPlace')}</h3>
        <p className={start ? 'font-bold' : 'text-muted-foreground'} aria-live="polite">
          {start ? t('match.join.placeChosen', { name: start.name }) : t('match.join.placeHint')}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base">2. {t('match.join.stepEmpire')}</h3>
        <EmpireFields
          value={current}
          onChange={(next) => {
            join.reset()
            setIdentity(next)
          }}
          colors={options.data.colors}
          emblems={options.data.emblems}
          takenColors={taken}
        />
        {match.hasInviteCode && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={codeId}>{t('match.join.inviteCode')}</Label>
            <Input
              id={codeId}
              required
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </div>
        )}
      </section>

      {join.error && (
        <p role="alert" className="text-danger">
          {errorText(join.error)}
        </p>
      )}
      <Button type="submit" disabled={!start || join.isPending}>
        {start ? t('match.join.submit') : t('match.join.submitNoPlace')}
      </Button>
    </form>
  )
}
