import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSession } from '@/features/auth/session-context'

import { adminApi } from './api'
import { useErrorText, useFormat } from './hooks'
import { Card, ErrorNote } from './shared'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono text-3xl font-bold">{value}</p>
    </Card>
  )
}

export function OverviewTab() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { online } = useSession()
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 15_000,
  })

  if (stats.error) return <ErrorNote>{errorText(stats.error)}</ErrorNote>
  const show = (value: number | undefined | null) => (value == null ? '–' : format.number(value))

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label={t('admin.overview.users')} value={show(stats.data?.users)} />
      <Stat label={t('admin.overview.matchesRunning')} value={show(stats.data?.matchesRunning)} />
      {/* Live from the socket; the fetched value covers the first moments. */}
      <Stat label={t('admin.overview.online')} value={show(online ?? stats.data?.online)} />
    </div>
  )
}
