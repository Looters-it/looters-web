import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router'

import { AccountPopover } from '@/features/auth/AccountPopover'

import { Crest } from './Crest'
import { OnlineCounter } from './OnlineCounter'

export function Navbar() {
  const { t } = useTranslation()
  // Inside a match the navbar shows the figures of that match (filled in by MatchBar).
  const inMatch = useMatch('/partite/:id') !== null

  return (
    <header className="bg-primary text-primary-foreground flex h-14 flex-none items-center gap-4 px-4">
      <Link to="/" className="flex items-center gap-2.5">
        <Crest className="size-7" />
        <b className="font-display text-lg font-normal whitespace-nowrap">{t('app.name')}</b>
        <span className="rounded-pill border-primary-foreground/50 hidden border px-2 text-sm md:inline">
          {t('app.provisionalName')}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-4">
        <div id="navbar-match" />
        {!inMatch && <OnlineCounter />}
        <AccountPopover />
      </div>
    </header>
  )
}
