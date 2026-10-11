import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useMatch } from 'react-router'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useSession } from '@/features/auth/session-context'
import { LanguageSelect } from '@/i18n/LanguageSelect'
import { cn } from '@/lib/utils'

import { OnlineCounter } from './OnlineCounter'

/**
 * An entry of the menu: plain words in the heading font.
 */
function Item(props: { to: string; children: string; onClick?: () => void }) {
  return (
    <Link
      to={props.to}
      onClick={props.onClick}
      className="font-display focus-visible:outline-ring rounded-md px-3 py-1 text-center text-base tracking-[0.02em] focus-visible:outline-2"
    >
      {props.children}
    </Link>
  )
}

/** True on the page of a match (not on the one that creates it). */
export function useInMatch() {
  const match = useMatch('/match/:id')
  return match !== null && match.params.id !== 'new'
}

/**
 * What the sidebar holds, on the side of a wide screen and in the drawer of a
 * narrow one: the name of the game, then the entries of who is signed in
 * ("Le mie partite", "Profilo", "Esci") or of a guest ("Come funziona",
 * "Vedi partite in corso", and the way in).
 */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, sessionEnded, logout, dismissSessionEnded } = useSession()
  const { pathname } = useLocation()
  const inMatch = useInMatch()
  // After signing in, back to the page the guest was on (a match, for instance).
  const signIn =
    pathname === '/' || pathname === '/auth/login'
      ? '/auth/login'
      : `/auth/login?next=${encodeURIComponent(pathname)}`

  return (
    <>
      <Link to="/" onClick={onNavigate} className="flex items-center justify-center gap-3 px-3">
        <b className="font-display text-2xl font-normal">{t('app.name')}</b>
      </Link>

      {/* Above the entries: who opens the menu sees first that the game is alive. */}
      {!inMatch && <OnlineCounter />}
      <nav className="flex flex-col gap-0" aria-label={t('nav.main')}>
        {user ? (
          <>
            <Item to="/matches" onClick={onNavigate}>
              {t('nav.myMatches')}
            </Item>
            <Item to="/match/new" onClick={onNavigate}>
              {t('nav.newMatch')}
            </Item>
            <Item to="/leaderboard" onClick={onNavigate}>
              {t('nav.leaderboard')}
            </Item>
            {user.role === 'ADMIN' && (
              <Item to="/admin" onClick={onNavigate}>
                {t('nav.admin')}
              </Item>
            )}
          </>
        ) : (
          <>
            <Item to="/come-funziona" onClick={onNavigate}>
              {t('nav.how')}
            </Item>
            <Item to="/matches" onClick={onNavigate}>
              {t('nav.matches')}
            </Item>
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-3">
        {/* The language is chosen here, by guests and players alike. */}
        <LanguageSelect />
        {user ? (
          <>
            {/* The player's name is the way to their profile. */}
            <Button asChild variant="outline">
              <Link to="/profile" onClick={onNavigate} title={t('nav.profile')}>
                <span className="sr-only">{t('nav.profile')}: </span>
                <span className="truncate">{user.username}</span>
              </Link>
            </Button>
            {inMatch ? (
              // In a match the way out is out of its page, back to the menu of the game:
              // the player stays in the match.
              <Button asChild variant="secondary">
                <Link to="/matches" onClick={onNavigate}>
                  {t('nav.leaveMatch')}
                </Link>
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  onNavigate?.()
                  void logout()
                }}
              >
                {t('auth.logout')}
              </Button>
            )}
          </>
        ) : (
          // Unknown while the session is being read: nothing that would change under the finger.
          user === null && (
            <>
              {sessionEnded && (
                <p role="alert" className="bg-background text-danger rounded-md p-2 text-base">
                  {t('auth.sessionEnded')}
                </p>
              )}
              <Button asChild variant="secondary">
                <Link
                  to={signIn}
                  onClick={() => {
                    dismissSessionEnded()
                    onNavigate?.()
                  }}
                >
                  {t('auth.login.submit')}
                </Link>
              </Button>
            </>
          )
        )}
      </div>
    </>
  )
}

/**
 * The frame of the game: no bar on top, a sidebar instead. On a wide screen
 * it stands on the left for the whole height; on a narrow one it is a drawer,
 * opened by a button that floats over the page. Inside a match it is a drawer at
 * every width.
 */
export function Sidebar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Inside a match the screen is for the match: the menu shrinks to its button at
  // every width, and holds nothing about the match itself.
  const reduced = useInMatch()

  return (
    <header
      className={cn(
        // Narrow, or in a match: a strip that lets the page through, holding the button.
        'pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start gap-2 p-2',
        // Wide: the sidebar itself, a card floating over the page with air on every side.
        !reduced &&
          'card-scope-lg lg:bg-card lg:text-card-foreground lg:pointer-events-auto lg:inset-y-3 lg:right-auto lg:left-3 lg:w-60 lg:flex-col lg:items-stretch lg:gap-6 lg:rounded-xl lg:p-0 lg:py-5 lg:shadow-lg',
      )}
    >
      <Button
        size="icon"
        aria-label={t('nav.menu')}
        className={cn('pointer-events-auto size-11 shadow-md', !reduced && 'lg:hidden')}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      {!reduced && (
        <div className="hidden min-h-0 flex-1 flex-col gap-6 lg:flex lg:px-2">
          <SidebarBody />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card text-card-foreground top-3 left-3 flex h-[calc(100dvh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] translate-x-0 translate-y-0 flex-col gap-6 rounded-xl border-0 px-2 py-5 sm:max-w-[calc(100vw-1.5rem)]">
          <DialogTitle className="sr-only">{t('nav.menu')}</DialogTitle>
          <DialogDescription className="sr-only">{t('nav.main')}</DialogDescription>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  )
}
