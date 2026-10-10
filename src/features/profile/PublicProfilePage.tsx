import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { NotFoundPage } from '@/app/NotFoundPage'
import { Button } from '@/components/ui/button'
import { publicUser } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { useMatchFormat } from '@/features/matches/format'
import { ApiError } from '@/lib/api'

/** The page of a player as anybody sees it: the name, since when, how many matches. */
export function PublicProfilePage() {
  const { t } = useTranslation()
  const { username = '' } = useParams()
  const { user: me } = useSession()
  const format = useMatchFormat()
  const player = useQuery({
    queryKey: ['users', username.toLowerCase()],
    queryFn: () => publicUser(username),
    retry: false,
  })

  if (player.error instanceof ApiError && player.error.status === 404) return <NotFoundPage />
  if (!player.data) return null
  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16"
      aria-labelledby="player-title"
    >
      <h1 id="player-title" className="truncate text-3xl leading-tight sm:text-4xl">
        {player.data.username}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 [&_dd]:font-bold">
        <dt>{t('profile.public.since')}</dt>
        <dd>{format.date(player.data.createdAt)}</dd>
        <dt>{t('profile.public.matches')}</dt>
        <dd>{player.data.matches}</dd>
      </dl>
      {me?.username === player.data.username && (
        <Button asChild variant="outline" className="min-h-11 w-full text-[17px]">
          <Link to="/profile">{t('profile.public.mine')}</Link>
        </Button>
      )}
    </section>
  )
}
