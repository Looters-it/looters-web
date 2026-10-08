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

import { MatchPreview } from './MatchPreview'

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

/** One match as a card of the row: what it is, how full, and the way in. */
function MatchCard({ match, mine }: { match: MatchSummary; mine: boolean }) {
  const { t } = useTranslation()
  const format = useMatchFormat()
  const full = match.players >= match.maxPlayers
  // How full the match is, as a bar: seen before it is read.
  const filled = Math.min(100, Math.round((match.players / match.maxPlayers) * 100))

  return (
    <li className="bg-card text-card-foreground flex w-[17.5rem] flex-none snap-start flex-col gap-3 overflow-hidden rounded-lg border p-4 sm:w-80">
      <MatchPreview
        matchId={match.id}
        className="bg-primary/15 -mx-4 -mt-4 h-36 rounded-t-lg border-b p-2"
      />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          {/* In a card the title is the text font, bold: the display font is for headings. */}
          <b className="truncate text-lg">{match.name}</b>
          {mine && (
            <span className="rounded-pill bg-secondary flex-none px-2 text-sm font-bold text-white">
              {t('home.matches.yours')}
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate text-base">
          {match.areas.map((area) => area.name).join(', ')}
          {match.hasInviteCode && ` · ${t('home.matches.invite')}`}
          {match.status === 'DRAFT' && ` · ${t('home.matches.draft')}`}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <div aria-hidden="true" className="bg-background/70 rounded-pill h-1.5 overflow-hidden">
          <div className="bg-primary h-full" style={{ width: `${String(filled)}%` }} />
        </div>
        <p className="flex flex-wrap justify-between gap-x-4 font-mono text-sm">
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
      <div className="mt-auto">
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
      </div>
    </li>
  )
}

/** A row of cards that scrolls sideways, each stopping at the edge. */
const ROW =
  'flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin] -mx-4 px-4 sm:-mx-8 sm:px-8'

/**
 * The band under the hero: the player's own matches, then the matches being
 * played or about to start, as cards side by side, with the filters by name
 * and by participants and the pages.
 */
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

  const pager = pages > 1 && (
    <nav className="flex items-center gap-2" aria-label={t('home.matches.pages')}>
      <Button variant="quiet" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        {t('home.matches.previous')}
      </Button>
      <span className="font-mono text-sm whitespace-nowrap">
        {t('home.matches.page', { page, pages })}
      </span>
      <Button variant="quiet" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        {t('home.matches.next')}
      </Button>
    </nav>
  )

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-10 sm:px-8">
      {mine.data && mine.data.length > 0 && (
        <section
          id="mie-partite"
          className="flex scroll-mt-16 flex-col gap-3"
          aria-labelledby="my-matches"
        >
          <h2 id="my-matches" className="text-2xl">
            {t('home.matches.mine')}
          </h2>
          <ul className={ROW}>
            {mine.data.map((match) => (
              <MatchCard key={match.id} match={match} mine />
            ))}
          </ul>
        </section>
      )}

      <section
        id="partite"
        className="flex scroll-mt-16 flex-col gap-3"
        aria-labelledby="active-matches"
      >
        <div className="flex flex-col items-start gap-4">
          <h2 id="active-matches" className="text-2xl">
            {t('home.matches.title')}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={nameId}>{t('home.matches.name')}</Label>
              <Input
                id={nameId}
                className="w-48"
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
                <SelectTrigger id={sizeId} className="w-44">
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
        </div>

        {list.error && (
          <p role="alert" className="text-danger">
            {t('home.matches.error')}
          </p>
        )}
        {list.data?.matches.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-6">
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
        {list.data && list.data.matches.length > 0 && (
          <ul className={ROW}>
            {list.data.matches.map((match) => (
              <MatchCard key={match.id} match={match} mine={mineIds.has(match.id)} />
            ))}
          </ul>
        )}
        {pager}
      </section>
    </div>
  )
}
