import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { adminApi, type AdminSession } from './api'
import { useErrorText, useFormat } from './hooks'
import { Card, ConfirmDialog, ErrorNote } from './shared'

export function SessionsTab() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<AdminSession | null>(null)

  const sessions = useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: adminApi.sessions,
    refetchInterval: 10_000,
  })
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeSession(id),
    onSuccess: () => {
      setTarget(null)
      return queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
    },
  })

  if (sessions.error) return <ErrorNote>{errorText(sessions.error)}</ErrorNote>
  if (!sessions.data) return <p className="text-muted-foreground">{t('admin.loading')}</p>

  return (
    <>
      <p className="text-muted-foreground mb-3">
        {t('admin.sessions.count', { count: sessions.data.length })}
      </p>
      <ul className="flex flex-col gap-3">
        {sessions.data.map((session) => (
          <li key={session.id}>
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-40 flex-1">
                <p className="font-bold">
                  {session.user.username}
                  {session.user.role === 'ADMIN' && (
                    <span className="rounded-pill ml-2 border px-2 text-sm font-normal">
                      {t('admin.sessions.admin')}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {session.connected ? t('admin.sessions.connected') : t('admin.sessions.idle')}
                  {session.current && ` · ${t('admin.sessions.current')}`}
                </p>
              </div>
              <dl className="grid flex-[2] grid-cols-[auto_1fr] gap-x-3 text-base">
                <dt className="text-muted-foreground">{t('admin.sessions.started')}</dt>
                <dd>{format.dateTime(session.createdAt)}</dd>
                <dt className="text-muted-foreground">{t('admin.sessions.lastSeen')}</dt>
                <dd>{format.dateTime(session.lastSeenAt)}</dd>
                <dt className="text-muted-foreground">{t('admin.sessions.address')}</dt>
                <dd className="font-mono text-sm">{session.ip ?? '–'}</dd>
              </dl>
              {/* The admin leaves with "Esci": revoking one's own session here would be a trap. */}
              <Button
                variant="destructive"
                size="sm"
                disabled={session.current}
                onClick={() => {
                  revoke.reset()
                  setTarget(session)
                }}
              >
                {t('admin.sessions.revoke')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title={t('admin.sessions.revokeTitle', { username: target?.user.username ?? '' })}
        description={t('admin.sessions.revokeText')}
        confirmLabel={t('admin.sessions.revoke')}
        pending={revoke.isPending}
        error={revoke.error ? errorText(revoke.error) : null}
        onConfirm={() => target && revoke.mutate(target.id)}
        onClose={() => setTarget(null)}
      />
    </>
  )
}
