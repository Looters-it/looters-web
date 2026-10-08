import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'

import { HomeMap } from './HomeMap'
import { MatchList } from './MatchList'

export function HomePage() {
  const { t } = useTranslation()
  const { user } = useSession()

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-start gap-4">
          <h1 className="text-4xl leading-tight text-balance">{t('home.title')}</h1>
          <p className="text-muted-foreground max-w-prose">{t('home.intro')}</p>
          {user ? (
            <Button asChild>
              <Link to="/partite/nuova">{t('home.create')}</Link>
            </Button>
          ) : (
            user === null && <p className="text-muted-foreground">{t('home.createGuest')}</p>
          )}
        </section>
        <MatchList />
      </div>
      <HomeMap />
    </div>
  )
}
