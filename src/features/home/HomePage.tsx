import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { openAccountPanel } from '@/features/auth/account-panel'
import { useSession } from '@/features/auth/session-context'

import { HeroMap } from './HeroMap'
import { MatchList } from './MatchList'

/**
 * The homepage: a large hero with the map playing a demonstration by itself
 * and, beside it, what the game is and the way in; underneath, the matches
 * being played, side by side.
 */
export function HomePage() {
  const { t } = useTranslation()
  const { user } = useSession()

  return (
    <div className="flex flex-col">
      <div className="bg-surface border-b">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(22rem,3fr)]">
          <HeroMap className="h-[52vh] min-h-80 lg:h-[calc(100vh-3.5rem-13rem)] lg:min-h-[28rem]" />
          <section className="flex max-w-2xl flex-col items-start justify-center gap-5 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
            <h1 className="text-4xl leading-[1.05] text-balance sm:text-5xl">{t('home.title')}</h1>
            <p className="text-muted-foreground max-w-prose text-lg">{t('home.intro')}</p>
            <ul className="flex flex-col gap-1.5">
              {(['real', 'hidden', 'turns'] as const).map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden="true" className="text-primary font-bold">
                    ›
                  </span>
                  {t(`home.points.${point}`)}
                </li>
              ))}
            </ul>
            {user ? (
              <Button asChild size="lg">
                <Link to="/partite/nuova">{t('home.create')}</Link>
              </Button>
            ) : (
              // Unknown while the session is being read: no button that would change under the finger.
              user === null && (
                <div className="flex flex-col items-start gap-2">
                  <Button size="lg" onClick={openAccountPanel}>
                    {t('home.createGuest')}
                  </Button>
                  <p className="text-muted-foreground text-base">{t('home.createGuestHint')}</p>
                </div>
              )
            )}
          </section>
        </div>
      </div>
      <MatchList />
    </div>
  )
}
