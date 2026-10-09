import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/admin/shared'

import { matchApi, type MatchSettings, type MatchSummary } from './api'
import { useMatchErrorText } from './errors'
import { draftFromMatch, settingsFromDraft } from './match-draft'
import { MatchFields } from './MatchForm'

/** What the owner may still change before the start (as the api enforces). */
const PLANNED_EDITABLE = ['name', 'startAt', 'maxDays', 'maxPlayers', 'inviteCode'] as const

const asSettings = (match: MatchSummary): MatchSettings => ({
  name: match.name,
  areaIds: match.areas.map((area) => area.id),
  mode: match.mode,
  pace: match.pace,
  visibility: match.visibility,
  startAt: match.startAt,
  maxDays: match.maxDays,
  maxPlayers: match.maxPlayers,
  turnHours: match.turnHours,
  inviteCode: match.inviteCode ?? null,
  config: match.config,
})

/**
 * The owner's controls, while the match is planned: change what can still
 * change, read the invite code, delete the match if nobody else is in it.
 */
export function OwnerPanel({ match }: { match: MatchSummary }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => draftFromMatch(asSettings(match)))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const options = useQuery({ queryKey: ['matches', 'options'], queryFn: matchApi.options })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['matches'] })

  const save = useMutation({
    mutationFn: () => {
      const settings = settingsFromDraft(draft)
      const changes: Partial<MatchSettings> = Object.fromEntries(
        PLANNED_EDITABLE.map((key) => [key, settings[key]]),
      )
      // A public match has no code, and the date of a match stays a date.
      if (match.visibility === 'PUBLIC') delete changes.inviteCode
      return matchApi.update(match.id, changes)
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => matchApi.remove(match.id),
    onSuccess: async () => {
      await refresh()
      await navigate('/matches')
    },
  })

  if (match.status !== 'PLANNED') return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="owner-title">
      <h2 id="owner-title" className="text-lg">
        {t('match.owner.title')}
      </h2>
      <p className="text-muted-foreground">
        {match.mode === 'SINGLEPLAYER'
          ? t('match.owner.single')
          : match.inviteCode
            ? t('match.owner.inviteCode', { code: match.inviteCode })
            : t('match.owner.public')}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <MatchFields
          draft={draft}
          onChange={(next) => {
            save.reset()
            setDraft({ ...next, startNow: false })
          }}
          maxPlayersLimit={options.data?.maxPlayersLimit ?? 100}
          locked
          omit={match.visibility === 'PUBLIC' ? ['inviteCode'] : []}
        />
        {save.error && (
          <p role="alert" className="text-danger">
            {errorText(save.error)}
          </p>
        )}
        {save.isSuccess && <p role="status">{t('match.owner.saved')}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline" disabled={save.isPending}>
            {t('match.owner.save')}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              remove.reset()
              setConfirmDelete(true)
            }}
          >
            {t('match.owner.delete')}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title={t('match.owner.deleteTitle')}
        description={t('match.owner.deleteText')}
        confirmLabel={t('match.owner.delete')}
        pending={remove.isPending}
        error={remove.error ? errorText(remove.error) : null}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  )
}
