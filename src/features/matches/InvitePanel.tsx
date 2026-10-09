import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { matchApi, type MatchGuest, type MatchSummary } from './api'
import { useMatchErrorText } from './errors'

/**
 * The owner of a private match asks players in, by username: nobody else
 * can see the match or enter it. An invitation can be taken back.
 */
export function InvitePanel({ match }: { match: MatchSummary }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const fieldId = useId()
  const [username, setUsername] = useState('')
  const key = ['matches', 'guests', match.id]
  const guests = useQuery({ queryKey: key, queryFn: () => matchApi.guests(match.id) })
  const keep = (next: MatchGuest[]) => queryClient.setQueryData(key, next)

  const invite = useMutation({
    mutationFn: () => matchApi.inviteGuest(match.id, username.trim()),
    onSuccess: (next) => {
      keep(next)
      setUsername('')
    },
  })
  const uninvite = useMutation({
    mutationFn: (id: string) => matchApi.uninviteGuest(match.id, id),
    onSuccess: keep,
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (username.trim()) invite.mutate()
  }
  const error = invite.error ?? uninvite.error

  return (
    <section className="flex flex-col gap-4" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-lg">
        {t('match.invite.title')}
      </h2>
      <p className="text-muted-foreground">{t('match.invite.intro')}</p>
      {match.status !== 'FINISHED' && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={fieldId}>{t('auth.username')}</Label>
            <Input
              id={fieldId}
              autoComplete="off"
              maxLength={20}
              value={username}
              onChange={(event) => {
                invite.reset()
                setUsername(event.target.value)
              }}
            />
          </div>
          <Button type="submit" disabled={invite.isPending || username.trim() === ''}>
            {t('match.invite.send')}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {errorText(error)}
        </p>
      )}
      {guests.data?.length === 0 && (
        <p className="text-muted-foreground">{t('match.invite.none')}</p>
      )}
      {guests.data && guests.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {guests.data.map((guest) => (
            <li key={guest.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <b className="block truncate">{guest.username}</b>
                <span className="text-muted-foreground text-sm">
                  {guest.joined ? t('match.invite.joined') : t('match.invite.waiting')}
                </span>
              </span>
              {!guest.joined && (
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={uninvite.isPending}
                  aria-label={t('match.invite.revokeOf', { name: guest.username })}
                  onClick={() => uninvite.mutate(guest.id)}
                >
                  {t('match.invite.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
