import { CircleUserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { LoginForm, RegisterForm } from './AuthForms'
import { useSession } from './session-context'
import { LanguageSelect } from '@/i18n/LanguageSelect'

/** Sign-in and registration live in a popover opened from the navbar (PROMPT §11). */
export function AccountPopover() {
  const { t } = useTranslation()
  const { user, sessionEnded, logout, dismissSessionEnded } = useSession()
  const [open, setOpen] = useState(false)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) dismissSessionEnded()
  }

  return (
    // A session ended by the server opens the popover to explain what happened.
    <Popover open={open || sessionEnded} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={user ? 'sm' : 'icon'}
          aria-label={user ? t('nav.accountOf', { username: user.username }) : t('nav.account')}
          className="text-primary-foreground hover:bg-primary-hover tracking-normal normal-case"
        >
          <CircleUserRound className="size-5" />
          {/* On a phone the icon is enough: the name is in its label and in the panel. */}
          {user && <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        aria-label={user ? t('nav.accountOf', { username: user.username }) : t('nav.account')}
      >
        {user ? (
          <div className="flex flex-col gap-3">
            <p>
              {t('auth.signedInAs')} <b>{user.username}</b>
            </p>
            {user.role === 'ADMIN' && (
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/admin">{t('nav.admin')}</Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => void logout()}>
              {t('auth.logout')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessionEnded && (
              <p role="alert" className="text-danger">
                {t('auth.sessionEnded')}
              </p>
            )}
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login">{t('auth.login.tab')}</TabsTrigger>
                <TabsTrigger value="register">{t('auth.register.tab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onSuccess={() => setOpen(false)} />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm onSuccess={() => setOpen(false)} />
              </TabsContent>
            </Tabs>
          </div>
        )}
        <LanguageSelect />
      </PopoverContent>
    </Popover>
  )
}
