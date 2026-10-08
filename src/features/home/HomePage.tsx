import { useTranslation } from 'react-i18next'

import { HomeMap } from './HomeMap'
import { SystemStatusCard } from './SystemStatusCard'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h1 className="text-4xl leading-tight text-balance">{t('home.title')}</h1>
          <p className="text-muted-foreground max-w-prose">{t('home.intro')}</p>
        </section>
        <SystemStatusCard />
      </div>
      <HomeMap />
    </div>
  )
}
