import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { StepArt } from './StepArt'

const STEPS = ['start', 'grow', 'fight', 'win'] as const
export type HowStep = (typeof STEPS)[number]

/**
 * The page "Come funziona": the game in four steps, for who arrives without knowing
 * it. Each step is a section as tall as most of the screen, its picture on one side
 * and its words on the other, the sides swapping from one step to the next.
 */
export function HowItWorks() {
  const { t } = useTranslation()
  return (
    <article aria-labelledby="how-title" className="flex flex-col px-4 py-10 sm:px-8">
      <h1 id="how-title" className="text-3xl sm:text-4xl">
        {t('home.how.title')}
      </h1>
      {STEPS.map((step, index) => (
        <section
          key={step}
          aria-labelledby={`how-${step}`}
          className="grid items-center gap-8 py-12 lg:min-h-[70dvh] lg:grid-cols-2 lg:gap-16 lg:py-16"
        >
          <StepArt
            step={step}
            className={cn('mx-auto w-full max-w-xl', index % 2 === 1 && 'lg:order-2')}
          />
          <div className="flex flex-col gap-4">
            <span
              aria-hidden="true"
              className="font-display text-secondary text-6xl leading-none xl:text-7xl"
            >
              {index + 1}
            </span>
            <h2 id={`how-${step}`} className="text-3xl sm:text-4xl xl:text-5xl">
              {t(`home.how.${step}.title`)}
            </h2>
            <p className="text-muted-foreground max-w-prose text-xl">
              {t(`home.how.${step}.text`)}
            </p>
          </div>
        </section>
      ))}
    </article>
  )
}
