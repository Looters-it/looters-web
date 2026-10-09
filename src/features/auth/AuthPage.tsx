import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { LoginForm, RegisterForm } from './AuthForms'
import { useSession } from './session-context'

/** Only a path of this site: never an address somebody put in a link. */
const safeNext = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/'

/**
 * Signing in (`/auth/login`) and registering (`/auth/register`): two pages,
 * each with its form standing on the page itself and a way to the other.
 * Once in, the player goes on to where they were headed (`?next=`).
 */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation()
  const { user } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  // The other page keeps where the player was headed.
  const query = params.get('next') ? `?next=${encodeURIComponent(next)}` : ''

  // Already in, or just in: nothing to do here.
  useEffect(() => {
    if (user) void navigate(next, { replace: true })
  }, [user, next, navigate])

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16"
      aria-labelledby="auth-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="auth-title" className="text-3xl leading-tight sm:text-4xl">
          {t(`auth.${mode}.title`)}
        </h1>
        <p className="text-muted-foreground text-lg">{t(`auth.${mode}.intro`)}</p>
      </div>
      {mode === 'login' ? <LoginForm /> : <RegisterForm />}
      <p>
        {t(`auth.${mode}.other`)}{' '}
        <Link
          to={mode === 'login' ? `/auth/register${query}` : `/auth/login${query}`}
          className="font-bold underline underline-offset-4"
        >
          {t(`auth.${mode === 'login' ? 'register' : 'login'}.tab`)}
        </Link>
      </p>
    </section>
  )
}
