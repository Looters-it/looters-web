import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router'

import { AccountPopover } from '@/features/auth/AccountPopover'
import { cn } from '@/lib/utils'

import { Crest } from './Crest'
import { OnlineCounter } from './OnlineCounter'

export function Navbar() {
  const { t } = useTranslation()
  // Inside a match the navbar shows the figures of that match (filled in by MatchBar).
  const inMatch = useMatch('/partite/:id') !== null

  return (
    <header className="bg-primary text-primary-foreground flex h-14 flex-none items-center gap-2 px-3 sm:gap-4 sm:px-4">
      <Link to="/" className="flex items-center gap-2.5">
        <Crest className="size-7" />
        {/* On a phone, inside a match, the figures of the match need the room: the crest stays. */}
        <b
          className={cn(
            'font-display text-lg font-normal whitespace-nowrap',
            inMatch && 'sr-only sm:not-sr-only',
          )}
        >
          {t('app.name')}
        </b>
        <span className="rounded-pill border-primary-foreground/50 hidden border px-2 text-sm md:inline">
          {t('app.provisionalName')}
        </span>
      </Link>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
        <div id="navbar-match" />
        {!inMatch && <OnlineCounter />}
        <AccountPopover />
      </div>
    </header>
  )
}
