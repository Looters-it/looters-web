import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getSystemStatus, type SystemStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

type Load =
  { state: 'loading' } | { state: 'unreachable' } | { state: 'loaded'; status: SystemStatus }

type Level = 'ok' | 'down' | 'waiting' | 'loading'

const LEVEL_DOT: Record<Level, string> = {
  ok: 'bg-ok',
  down: 'bg-danger',
  waiting: 'border border-border bg-transparent',
  loading: 'border border-border bg-transparent',
}

function levels(load: Load): Record<'api' | 'database' | 'jobs' | 'battleQueue', Level> {
  if (load.state === 'loading') {
    return { api: 'loading', database: 'loading', jobs: 'loading', battleQueue: 'loading' }
  }
  if (load.state === 'unreachable') {
    return { api: 'down', database: 'waiting', jobs: 'waiting', battleQueue: 'waiting' }
  }
  return {
    api: 'ok',
    database: load.status.database ? 'ok' : 'down',
    jobs: load.status.jobs.lastPongAt ? 'ok' : 'waiting',
    battleQueue: load.status.battleQueue ? 'ok' : 'down',
  }
}

/** Shows whether the backend pieces answer: api, database, jobs, battle queue. */
export function SystemStatusCard() {
  const { t } = useTranslation()
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  const refresh = useCallback((signal?: AbortSignal) => {
    getSystemStatus(signal)
      .then((status) => setLoad({ state: 'loaded', status }))
      .catch(() => {
        if (!signal?.aborted) setLoad({ state: 'unreachable' })
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const level = levels(load)
  const rows = [
    { key: 'api', label: t('home.status.api'), level: level.api },
    { key: 'database', label: t('home.status.database'), level: level.database },
    { key: 'jobs', label: t('home.status.jobs'), level: level.jobs },
    { key: 'battleQueue', label: t('home.status.battleQueue'), level: level.battleQueue },
  ]

  return (
    <section className="rounded-lg border p-4" aria-labelledby="system-status-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="system-status-title" className="text-lg">
          {t('home.status.title')}
        </h2>
        <Button
          variant="quiet"
          size="sm"
          disabled={load.state === 'loading'}
          onClick={() => {
            setLoad({ state: 'loading' })
            refresh()
          }}
        >
          {t('home.status.retry')}
        </Button>
      </div>
      <ul className="mt-3 divide-y" aria-live="polite">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-4 py-2">
            <span>{row.label}</span>
            <span className="text-muted-foreground flex items-center gap-2">
              {/* The state is always written out: never colour alone. */}
              <span
                className={cn('size-2.5 rounded-full', LEVEL_DOT[row.level])}
                aria-hidden="true"
              />
              {t(`home.status.${row.level}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
