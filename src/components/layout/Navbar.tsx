import { CircleUserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { Crest } from './Crest'

export function Navbar() {
  const { t } = useTranslation()

  return (
    <header className="bg-primary text-primary-foreground flex h-14 flex-none items-center justify-between gap-4 px-4">
      <Link to="/" className="flex items-center gap-2.5">
        <Crest className="size-7" />
        <b className="font-display text-lg font-normal whitespace-nowrap">{t('app.name')}</b>
        <span className="rounded-pill border-primary-foreground/50 hidden border px-2 text-sm sm:inline">
          {t('app.provisionalName')}
        </span>
      </Link>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nav.account')}
            className="text-primary-foreground hover:bg-primary-hover"
          >
            <CircleUserRound className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p>{t('nav.accountUnavailable')}</p>
        </PopoverContent>
      </Popover>
    </header>
  )
}
