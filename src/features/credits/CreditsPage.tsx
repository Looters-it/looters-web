import { useTranslation } from 'react-i18next'

import { SOURCES } from './sources'

/**
 * `/credits`: where the borders the game is played on come from. Every source asks
 * to be named: its author, who republishes it, and the licence it is reused under.
 * The names of countries, authors and licences are left as their sources write them.
 */
export function CreditsPage() {
  const { t } = useTranslation()
  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-8"
      aria-labelledby="credits-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="credits-title" className="text-3xl sm:text-4xl">
          {t('credits.title')}
        </h1>
        <p className="text-muted-foreground max-w-prose">{t('credits.intro')}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {SOURCES.map((source) => (
          <li key={source.countries} className="flex flex-col gap-1 rounded-md border p-4">
            <h2 className="font-sans text-lg font-bold">{source.countries}</h2>
            <p>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="focus-visible:outline-ring rounded-sm underline focus-visible:outline-2"
              >
                {source.author}
              </a>
              {source.via && ` · ${t('credits.via', { name: source.via })}`}
            </p>
            <p className="text-muted-foreground">
              {t('credits.licence', { name: source.licence })}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground max-w-prose">{t('credits.changes')}</p>
    </section>
  )
}
