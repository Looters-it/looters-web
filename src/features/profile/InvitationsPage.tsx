import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { matchApi } from '@/features/matches/api'
import { useMatchFormat } from '@/features/matches/format'

import { ProfileFrame } from './ProfileFrame'

/**
 * `/profile/invitations`: the private matches the player has been asked into
 * and has not entered yet. Each can be opened, to choose a capital, or turned down.
 */
export function InvitationsPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const format = useMatchFormat()
  const queryClient = useQueryClient()
  const invitations = useQuery({
    queryKey: ['invitations'],
    queryFn: matchApi.invitations,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  })
  const decline = useMutation({
    mutationFn: (id: string) => matchApi.declineInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  return (
    <ProfileFrame title={t('profile.invitations.title')} back>
      {() => (
        <>
          {invitations.error && (
            <p role="alert" className="text-danger">
              {t('profile.invitations.error')}
            </p>
          )}
          {invitations.data?.length === 0 && (
            <p className="text-muted-foreground">{t('profile.invitations.none')}</p>
          )}
          <ul className="flex flex-col gap-4">
            {invitations.data?.map(({ id, match }) => (
              <li
                key={id}
                className="bg-card text-card-foreground flex flex-col gap-3 rounded-lg p-4"
              >
                <div className="min-w-0">
                  <b className="block truncate text-lg">{match.name}</b>
                  <p className="text-muted-foreground truncate text-base">
                    {t('profile.invitations.from', { name: match.owner })} ·{' '}
                    {match.areas.map((area) => area.name).join(', ')}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {match.status === 'ONGOING'
                      ? t('home.matches.turn', { turn: match.currentTurn })
                      : t('home.matches.starts', { when: format.fromNow(match.startAt) })}{' '}
                    · {t('home.matches.players', { players: match.players, max: match.maxPlayers })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to={`/match/${match.id}`}>{t('profile.invitations.open')}</Link>
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={decline.isPending}
                    onClick={() => decline.mutate(id)}
                  >
                    {t('profile.invitations.decline')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </ProfileFrame>
  )
}
