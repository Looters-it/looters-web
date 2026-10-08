import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { LanguageSelect } from '@/i18n/LanguageSelect'

import { useSession } from './session-context'

/** The player's own page: who they are here, the language, and the way out. */
export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useSession()
  const navigate = useNavigate()

  // A guest has no profile: they are sent to sign in, and brought back.
  useEffect(() => {
    if (user === null) void navigate('/accesso?poi=%2Fprofilo', { replace: true })
  }, [user, navigate])
  if (!user) return null

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10 sm:py-16"
      aria-labelledby="profile-title"
    >
      <h1 id="profile-title" className="text-3xl leading-tight sm:text-4xl">
        {t('profile.title')}
      </h1>
      <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 [&_dd]:font-bold">
          <dt>{t('auth.username')}</dt>
          <dd className="truncate">{user.username}</dd>
          <dt>{t('profile.role')}</dt>
          <dd>{t(`profile.roles.${user.role}`)}</dd>
        </dl>
        <LanguageSelect />
        <div className="flex flex-wrap gap-2 pt-4">
          {user.role === 'ADMIN' && (
            <Button asChild variant="outline">
              <Link to="/admin">{t('nav.admin')}</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => void logout()}>
            {t('auth.logout')}
          </Button>
        </div>
      </div>
    </section>
  )
}
