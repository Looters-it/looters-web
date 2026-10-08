import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/features/auth/session-context'
import { matchApi, type MatchSummary, type SizeFilter } from '@/features/matches/api'
import { useMatchFormat } from '@/features/matches/format'

const SIZES: {
  value: SizeFilter | 'all'
  key: 'sizeAll' | 'sizeFree' | 'sizeS' | 'sizeM' | 'sizeL'
}[] = [
  { value: 'all', key: 'sizeAll' },
  { value: 'free', key: 'sizeFree' },
  { value: 's', key: 'sizeS' },
  { value: 'm', key: 'sizeM' },
  { value: 'l', key: 'sizeL' },
]

function MatchRow({ match, mine }: { match: MatchSummary; mine: boolean }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  const full = match.players >= match.maxPlayers

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t py-3">
      <div className="min-w-0">
        <b className="block truncate">{match.name}</b>
        <p className="text-muted-foreground text-base">
          {match.areas.map((area) => area.name).join(', ')}
          {match.hasInviteCode && ` · ${t('home.matches.invite')}`}
          {match.status === 'DRAFT' && ` · ${t('home.matches.draft')}`}
        </p>
        <p className="flex flex-wrap gap-x-4 font-mono text-sm">
          <span>
            {t('home.matches.players', { players: match.players, max: match.maxPlayers })}
          </span>
          <span>
            {match.status === 'RUNNING'
              ? t('home.matches.turn', { turn: match.currentTurn })
              : t('home.matches.starts', { when: format.fromNow(match.startAt) })}
          </span>
        </p>
      </div>
      {mine ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/partite/${match.id}`}>{t('home.matches.enter')}</Link>
        </Button>
      ) : full ? (
        <Button size="sm" disabled>
          {t('home.matches.full')}
        </Button>
      ) : (
        <Button asChild size="sm">
          <Link to={`/partite/${match.id}`}>{t('home.matches.join')}</Link>
        </Button>
      )}
    </li>
  )
}

/** The card "Partite attive": filter by name and by participants, pages, and the way in. */
export function MatchList() {
  const { t } = useTranslation()
  const { user } = useSession()
  const nameId = useId()
  const sizeId = useId()
  const [name, setName] = useState('')
  const [size, setSize] = useState<SizeFilter>('')
  const [page, setPage] = useState(1)

  const list = useQuery({
    queryKey: ['matches', 'list', name.trim(), size, page],
    queryFn: () => matchApi.list({ name, size, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const mine = useQuery({
    queryKey: ['matches', 'mine', user?.id],
    queryFn: matchApi.mine,
    enabled: Boolean(user),
  })
  const mineIds = new Set(mine.data?.map((match) => match.id))
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1
  const filtered = name.trim() !== '' || size !== ''

  return (
    <div className="flex flex-col gap-6">
      {mine.data && mine.data.length > 0 && (
        <section className="rounded-lg border p-4" aria-labelledby="my-matches">
          <h2 id="my-matches" className="text-lg">
            {t('home.matches.mine')}
          </h2>
          <ul className="mt-2 [&>li:first-child]:border-t-0">
            {mine.data.map((match) => (
              <MatchRow key={match.id} match={match} mine />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border p-4" aria-labelledby="active-matches">
        <h2 id="active-matches" className="text-lg">
          {t('home.matches.title')}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>{t('home.matches.name')}</Label>
            <Input
              id={nameId}
              value={name}
              placeholder={t('home.matches.namePlaceholder')}
              onChange={(event) => {
                setName(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={sizeId}>{t('home.matches.size')}</Label>
            <Select
              value={size || 'all'}
              onValueChange={(value) => {
                setSize(value === 'all' ? '' : (value as SizeFilter))
                setPage(1)
              }}
            >
              <SelectTrigger id={sizeId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(`home.matches.${option.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {list.error && (
          <p role="alert" className="text-danger mt-3">
            {t('home.matches.error')}
          </p>
        )}
        {list.data?.matches.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground">
              {filtered ? t('home.matches.none') : t('home.matches.empty')}
            </p>
            {filtered && (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  setName('')
                  setSize('')
                  setPage(1)
                }}
              >
                {t('home.matches.reset')}
              </Button>
            )}
          </div>
        )}
        <ul className="mt-3">
          {list.data?.matches.map((match) => (
            <MatchRow key={match.id} match={match} mine={mineIds.has(match.id)} />
          ))}
        </ul>

        {pages > 1 && (
          <nav className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
            <Button
              variant="quiet"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('home.matches.previous')}
            </Button>
            <span className="font-mono text-sm">{t('home.matches.page', { page, pages })}</span>
            <Button
              variant="quiet"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              {t('home.matches.next')}
            </Button>
          </nav>
        )}
      </section>
    </div>
  )
}
