import { useTranslation } from 'react-i18next'

import { SystemStatusCard } from './SystemStatusCard'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[3fr_2fr] md:items-start">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl leading-tight text-balance">{t('home.title')}</h1>
        <p className="text-muted-foreground max-w-prose">{t('home.intro')}</p>
      </section>
      <SystemStatusCard />
    </div>
  )
}
