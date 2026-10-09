import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/session-context'
import type { User } from '@/features/auth/api'

/**
 * What the pages of the profile share: they are for who is signed in (a guest
 * is sent to sign in, and brought back), with a title and, below the first
 * page, the way back to it.
 */
export function ProfileFrame(props: {
  title: string
  back?: boolean
  children: (user: User) => ReactNode
}) {
  const { t } = useTranslation()
  const { user } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (user === null) {
      void navigate(`/auth/login?next=${encodeURIComponent(pathname)}`, { replace: true })
    }
  }, [user, pathname, navigate])
  if (!user) return null

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16"
      aria-labelledby="profile-title"
    >
      {props.back && (
        <Link to="/profile" className="font-bold underline underline-offset-4">
          {t('profile.back')}
        </Link>
      )}
      <h1 id="profile-title" className="text-3xl leading-tight sm:text-4xl">
        {props.title}
      </h1>
      {props.children(user)}
    </section>
  )
}
