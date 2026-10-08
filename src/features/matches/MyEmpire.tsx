import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { matchApi, type Empire, type EmpireIdentity, type MatchState } from './api'
import { EmpireShield } from './Emblem'
import { EmpireFields } from './EmpireFields'
import { useMatchErrorText } from './errors'

/** The player's own empire; name, colour, emblem and motto can change until the match starts. */
export function MyEmpire({ state, empire }: { state: MatchState; empire: Empire }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<EmpireIdentity | null>(null)
  const { match } = state

  const options = useQuery({ queryKey: ['matches', 'options'], queryFn: matchApi.options })
  const capital = state.territories.find((territory) => territory.id === empire.capitalTerritoryId)
  const others = new Set(
    state.empires.filter((other) => other.id !== empire.id).map((other) => other.color),
  )

  const save = useMutation({
    mutationFn: (identity: EmpireIdentity) =>
      matchApi.updateEmpire(match.id, { ...identity, name: identity.name.trim() }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', match.id], next)
      setEditing(null)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (editing) save.mutate(editing)
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="my-empire-title">
      <h2 id="my-empire-title" className="text-lg">
        {t('match.empire.yours')}
      </h2>
      {editing && options.data ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <EmpireFields
            value={editing}
            onChange={setEditing}
            colors={options.data.colors}
            emblems={options.data.emblems}
            takenColors={others}
          />
          {save.error && (
            <p role="alert" className="text-danger">
              {errorText(save.error)}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {t('match.empire.save')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setEditing(null)}>
              {t('admin.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <EmpireShield color={empire.color} emblem={empire.emblem} className="size-12" />
            <div className="min-w-0">
              <p className="truncate font-bold">{empire.name}</p>
              {empire.motto && <p className="text-muted-foreground italic">{empire.motto}</p>}
            </div>
          </div>
          {capital && (
            <p>
              {t('match.empire.capital', { name: capital.name })}
              {capital.resources !== null && (
                <>
                  <br />
                  {t('match.empire.resources', { count: capital.resources })}
                </>
              )}
            </p>
          )}
          {match.status === 'OPEN' ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                save.reset()
                setEditing({
                  name: empire.name,
                  color: empire.color,
                  emblem: empire.emblem,
                  motto: empire.motto,
                })
              }}
            >
              {t('match.empire.edit')}
            </Button>
          ) : (
            <p className="text-muted-foreground text-base">{t('match.empire.editLocked')}</p>
          )}
        </>
      )}
    </section>
  )
}
