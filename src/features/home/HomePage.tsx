import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'

import { HeroMap } from './HeroMap'
import { HowItWorks } from './HowItWorks'
import { MatchList } from './MatchList'

/**
 * The homepage: a hero as wide as the page, all map, playing a demonstration
 * by itself; on its right the map fades into the page and carries what the
 * game is and the way in. Underneath, the matches being played, side by side.
 */
export function HomePage() {
  const { t } = useTranslation()
  const { user } = useSession()
  // On a wide screen the right of the map is under the text: the stage keeps to the left.
  const [fitPadding] = useState(() => {
    const wide = typeof window !== 'undefined' && window.innerWidth >= 1024
    return {
      top: 48,
      bottom: 48,
      left: 32,
      // (The sidebar takes 15rem of the width on a wide screen.)
      right: wide ? Math.round((window.innerWidth - 240) * 0.42) : 32,
    }
  })

  return (
    <div className="flex flex-col max-lg:-mt-14">
      <div className="bg-surface relative border-b">
        <HeroMap
          fitPadding={fitPadding}
          className="h-[52vh] min-h-80 lg:h-[calc(100vh-13rem)] lg:min-h-[30rem]"
        />
        {/* The map fades into the page: to the right on a wide screen, downwards on a phone. */}
        <div
          aria-hidden="true"
          className="from-surface pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t to-transparent lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[58%] lg:bg-gradient-to-l lg:from-45%"
        />
        <section className="relative z-20 flex flex-col items-start gap-5 px-4 py-8 sm:px-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[42%] lg:max-w-2xl lg:justify-center lg:py-10 lg:pr-12 lg:pl-0">
          <h1 className="text-3xl leading-[1.1] text-balance sm:text-4xl xl:text-5xl">
            {t('home.title')}
          </h1>
          <p className="max-w-prose text-lg sm:text-xl">{t('home.intro')}</p>
          {user ? (
            <Button asChild size="lg" variant="secondary">
              <Link to="/partite/nuova">{t('home.create')}</Link>
            </Button>
          ) : (
            // Unknown while the session is being read: no button that would change under the finger.
            user === null && (
              <Button asChild size="lg" variant="secondary">
                <Link to="/accesso">{t('home.createGuest')}</Link>
              </Button>
            )
          )}
        </section>
      </div>
      <MatchList />
      <HowItWorks />
    </div>
  )
}
