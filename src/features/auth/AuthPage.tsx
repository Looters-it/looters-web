import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { LanguageSelect } from '@/i18n/LanguageSelect'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { LoginForm, RegisterForm } from './AuthForms'
import { useSession } from './session-context'

/** Only a path of this site: never an address somebody put in a link. */
const safeNext = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/'

/**
 * Sign-in and registration on a page of their own (`/accesso`), where the
 * homepage sends who wants to play. Once in, the player goes on to where
 * they were headed.
 */
export function AuthPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const next = safeNext(params.get('poi'))
  const tab = params.get('modo') === 'registrati' ? 'register' : 'login'

  // Already in, or just in: nothing to do here.
  useEffect(() => {
    if (user) void navigate(next, { replace: true })
  }, [user, next, navigate])

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10 sm:py-16"
      aria-labelledby="auth-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="auth-title" className="text-3xl leading-tight sm:text-4xl">
          {t('auth.page.title')}
        </h1>
        <p className="text-muted-foreground text-lg">{t('auth.page.intro')}</p>
      </div>
      <div className="bg-card text-card-foreground rounded-lg border p-4 sm:p-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            const query = new URLSearchParams(params)
            if (value === 'register') query.set('modo', 'registrati')
            else query.delete('modo')
            setParams(query, { replace: true })
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="login">{t('auth.login.tab')}</TabsTrigger>
            <TabsTrigger value="register">{t('auth.register.tab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </div>
      {/* A guest has no account panel: the language is chosen here. */}
      <LanguageSelect />
      <Link to="/" className="hover:text-primary self-start underline underline-offset-2">
        {t('notFound.back')}
      </Link>
    </section>
  )
}
