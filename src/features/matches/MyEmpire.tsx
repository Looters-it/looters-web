import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/admin/shared'

import { matchApi, type Empire, type EmpireIdentity, type MatchState } from './api'
import { EmpireShield } from './Emblem'
import { EmpireFields } from './EmpireFields'
import { useMatchErrorText } from './errors'

/** The same limit the api applies, checked here first to spare the upload. */
const LOGO_MAX_BYTES = 200 * 1024

/** The player's own empire; name, colour, emblem and motto can change until the match starts. */
export function MyEmpire({ state, empire }: { state: MatchState; empire: Empire }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<EmpireIdentity | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [logoProblem, setLogoProblem] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileId = useId()
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
  const withdraw = useMutation({
    mutationFn: () => matchApi.withdraw(match.id),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', match.id], next)
      setLeaving(false)
    },
  })
  // An image in place of the emblem: a file sets it, null removes it.
  const logo = useMutation({
    mutationFn: (file: File | null) =>
      file ? matchApi.setLogo(match.id, file) : matchApi.removeLogo(match.id, empire.id),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', match.id], next),
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
            <EmpireShield
              color={empire.color}
              emblem={empire.emblem}
              logo={empire.logoUrl}
              className="size-12"
            />
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
          {match.status !== 'FINISHED' && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* A real file input, hidden: the button next to it opens it. */}
                <input
                  ref={fileInput}
                  id={fileId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    logo.reset()
                    if (!file) return
                    if (file.size > LOGO_MAX_BYTES) {
                      setLogoProblem(t('match.empire.logoTooLarge'))
                      return
                    }
                    setLogoProblem(null)
                    logo.mutate(file)
                  }}
                />
                <label htmlFor={fileId} className="sr-only">
                  {t('match.empire.logoFile')}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logo.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {empire.logoUrl ? t('match.empire.logoChange') : t('match.empire.logoAdd')}
                </Button>
                {empire.logoUrl && (
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={logo.isPending}
                    onClick={() => {
                      setLogoProblem(null)
                      logo.mutate(null)
                    }}
                  >
                    {t('match.empire.logoRemove')}
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-base">{t('match.empire.logoHint')}</p>
              {(logoProblem ?? logo.error) && (
                <p role="alert" className="text-danger">
                  {logoProblem ?? (logo.error ? errorText(logo.error) : '')}
                </p>
              )}
            </div>
          )}
          {match.status === 'PLANNED' ? (
            <div className="flex flex-wrap gap-2">
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
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  withdraw.reset()
                  setLeaving(true)
                }}
              >
                {t('match.empire.withdraw')}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-base">{t('match.empire.editLocked')}</p>
          )}
        </>
      )}
      <ConfirmDialog
        open={leaving}
        title={t('match.empire.withdrawTitle')}
        description={t('match.empire.withdrawText')}
        confirmLabel={t('match.empire.withdraw')}
        pending={withdraw.isPending}
        error={withdraw.error ? errorText(withdraw.error) : null}
        onConfirm={() => withdraw.mutate()}
        onClose={() => setLeaving(false)}
      />
    </section>
  )
}
