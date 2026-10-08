import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'

import { matchApi, type MatchOptions } from './api'
import { useMatchErrorText } from './errors'
import { emptyDraft, settingsFromDraft } from './match-draft'
import { MatchFields } from './MatchForm'

function NewMatchForm({ options }: { options: MatchOptions }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useMatchErrorText()
  const [draft, setDraft] = useState(() => emptyDraft(options.rules))

  const create = useMutation({
    // A match is always born a draft; opening registrations is a second step.
    mutationFn: async (open: boolean) => {
      const match = await matchApi.create(settingsFromDraft(draft))
      // If opening fails the draft is kept: the owner fixes it from its page.
      if (open) await matchApi.open(match.id).catch(() => undefined)
      return match
    },
    onSuccess: (match) => navigate(`/match/${match.id}`),
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const open = (event.nativeEvent as SubmitEvent).submitter?.dataset.open === 'true'
    create.mutate(open)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <MatchFields draft={draft} onChange={setDraft} maxPlayersLimit={options.maxPlayersLimit} />
      {create.error && (
        <p role="alert" className="text-danger">
          {errorText(create.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" data-open="true" disabled={create.isPending || !draft.areaId}>
          {t('match.new.createAndOpen')}
        </Button>
        <Button type="submit" variant="outline" disabled={create.isPending || !draft.areaId}>
          {t('match.new.saveDraft')}
        </Button>
      </div>
    </form>
  )
}

export function NewMatchPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const options = useQuery({ queryKey: ['matches', 'options'], queryFn: matchApi.options })

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
      <h1 className="text-3xl">{t('match.new.title')}</h1>
      {user === null ? (
        <p className="text-muted-foreground">{t('match.new.guest')}</p>
      ) : (
        <>
          <p className="text-muted-foreground">{t('match.new.intro')}</p>
          {options.data && user && <NewMatchForm options={options.data} />}
        </>
      )}
    </div>
  )
}
