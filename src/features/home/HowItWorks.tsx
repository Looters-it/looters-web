import { useTranslation } from 'react-i18next'

const STEPS = ['start', 'grow', 'fight', 'win'] as const

/** The page "Come funziona": the game in four steps, for who arrives without knowing it. */
export function HowItWorks() {
  const { t } = useTranslation()
  return (
    <article
      aria-labelledby="how-title"
      className="flex max-w-3xl flex-col gap-12 px-4 py-10 sm:px-8"
    >
      <h1 id="how-title" className="text-3xl sm:text-4xl">
        {t('home.how.title')}
      </h1>
      {STEPS.map((step, index) => (
        <section key={step} aria-labelledby={`how-${step}`} className="flex gap-5">
          <span
            aria-hidden="true"
            className="font-display text-secondary w-10 shrink-0 text-5xl leading-none"
          >
            {index + 1}
          </span>
          <div className="flex flex-col gap-2">
            <h2 id={`how-${step}`} className="text-2xl">
              {t(`home.how.${step}.title`)}
            </h2>
            <p className="text-muted-foreground text-lg">{t(`home.how.${step}.text`)}</p>
          </div>
        </section>
      ))}
    </article>
  )
}
