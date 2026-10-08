import { useTranslation } from 'react-i18next'

const STEPS = ['start', 'grow', 'fight', 'win'] as const

/** The game in four steps, for who arrives without knowing it ("Come funziona"). */
export function HowItWorks() {
  const { t } = useTranslation()
  return (
    <section
      id="come-funziona"
      aria-labelledby="how-title"
      className="bg-surface scroll-mt-16 border-t px-4 py-10 sm:px-8"
    >
      <div className="flex flex-col gap-6">
        <h2 id="how-title" className="text-2xl">
          {t('home.how.title')}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="bg-card text-card-foreground flex flex-col gap-2 rounded-lg border p-4"
            >
              <span aria-hidden="true" className="text-3xl font-bold">
                {index + 1}
              </span>
              <b className="text-lg">{t(`home.how.${step}.title`)}</b>
              <p>{t(`home.how.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
