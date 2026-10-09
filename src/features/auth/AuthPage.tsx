import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'

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
      className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col justify-center gap-6 px-4 py-10 lg:min-h-dvh"
      aria-labelledby="auth-title"
    >
      <h1 id="auth-title" className="text-center text-3xl leading-tight sm:text-4xl">
        {t(`auth.${mode}.title`)}
      </h1>
      {mode === 'login' ? <LoginForm /> : <RegisterForm />}
      {/* The way to the other page: a button like the form's own, its colours swapped. */}
      <div className="flex flex-col gap-3">
        <p className="text-center">{t(`auth.${mode}.other`)}</p>
        <Button asChild variant="inverted" className="min-h-11 w-full text-[17px]">
          <Link to={mode === 'login' ? `/auth/register${query}` : `/auth/login${query}`}>
            {t(`auth.${mode === 'login' ? 'register' : 'login'}.tab`)}
          </Link>
        </Button>
      </div>
    </section>
  )
}
