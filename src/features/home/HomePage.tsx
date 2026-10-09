import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'

import { HeroMap } from './HeroMap'

/**
 * The homepage: a hero as wide as the page, all map, playing a demonstration
 * by itself; on its right the map fades into the page and carries what the
 * game is and the way in. The matches and how the game works have pages of
 * their own, reached from the sidebar.
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
      right: wide ? Math.round((window.innerWidth - 264) * 0.42) : 32,
    }
  })

  return (
    <div className="flex flex-col max-lg:-mt-14">
      <div className="bg-surface relative">
        <HeroMap fitPadding={fitPadding} className="h-[58vh] min-h-80 lg:h-dvh lg:min-h-[30rem]" />
        {/* The map fades into the page: to the right on a wide screen, downwards on a phone. */}
        <div
          aria-hidden="true"
          className="from-surface pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t to-transparent lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[58%] lg:bg-gradient-to-l lg:from-45%"
        />
        {/* And on the left too, beside the menu, so that the map has no hard edge. */}
        <div
          aria-hidden="true"
          className="from-surface pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-56 bg-gradient-to-r to-transparent lg:block"
        />
        <section className="relative z-20 flex flex-col items-start space-y-6 px-4 py-8 sm:px-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[42%] lg:max-w-2xl lg:justify-center lg:py-10 lg:pr-12 lg:pl-0">
          {/* The heading font leaves air under its letters: taken back here, in proportion to
              its size, so that what the eye sees between the three is the same. */}
          <h1 className="mb-[calc(1.5rem-0.37em)] text-4xl leading-[1.05] text-balance sm:text-5xl xl:text-6xl">
            {t('home.title')}
          </h1>
          <p className="max-w-prose text-lg sm:text-xl">{t('home.intro')}</p>
          {user ? (
            <Button asChild size="lg" variant="secondary">
              <Link to="/match/new">{t('home.create')}</Link>
            </Button>
          ) : (
            // Unknown while the session is being read: no button that would change under the finger.
            user === null && (
              <Button asChild size="lg" variant="secondary">
                <Link to="/auth/login">{t('home.createGuest')}</Link>
              </Button>
            )
          )}
        </section>
      </div>
    </div>
  )
}
