import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/report'

/**
 * Shown in place of a page that broke while rendering: the error is reported
 * to the server and the player is offered a way out instead of a blank screen.
 */
export function ErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const { pathname } = useLocation()
  useEffect(() => reportError(error, 'render', pathname), [error, pathname])

  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-12">
      <h1 className="text-3xl">{t('crash.title')}</h1>
      <p className="text-muted-foreground">{t('crash.text')}</p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>{t('crash.reload')}</Button>
        <Button variant="quiet" asChild>
          <a href="/">{t('notFound.back')}</a>
        </Button>
      </div>
    </section>
  )
}
