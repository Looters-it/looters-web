import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { matchApi } from '@/features/matches/api'

import { ProfileFrame } from './ProfileFrame'

/** The player's own page: who they are here, and where to go from it. */
export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useSession()
  const invitations = useQuery({
    queryKey: ['invitations'],
    queryFn: matchApi.invitations,
    enabled: Boolean(user),
  })
  const waiting = invitations.data?.length ?? 0

  return (
    <ProfileFrame title={t('profile.title')}>
      {(me) => (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 [&_dd]:font-bold">
            <dt>{t('auth.username')}</dt>
            <dd className="truncate">{me.username}</dd>
            <dt>{t('profile.role')}</dt>
            <dd>{t(`profile.roles.${me.role}`)}</dd>
          </dl>
          <div className="flex flex-col gap-3">
            <Button asChild variant="inverted" className="min-h-11 w-full text-[17px]">
              <Link to="/profile/invitations">
                {waiting > 0
                  ? t('profile.invitations.linkCount', { count: waiting })
                  : t('profile.invitations.title')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full text-[17px]">
              <Link to="/profile/change-password">{t('profile.password.title')}</Link>
            </Button>
            {me.role === 'ADMIN' && (
              <Button asChild variant="outline" className="min-h-11 w-full text-[17px]">
                <Link to="/admin">{t('nav.admin')}</Link>
              </Button>
            )}
            <Button className="min-h-11 w-full text-[17px]" onClick={() => void logout()}>
              {t('auth.logout')}
            </Button>
          </div>
        </>
      )}
    </ProfileFrame>
  )
}
