import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'

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
import { cn } from '@/lib/utils'

import { leaderboardApi, type LeaderboardSort } from './api'

const COLUMNS: { sort: LeaderboardSort; numeric: boolean }[] = [
  { sort: 'rank', numeric: true },
  { sort: 'username', numeric: false },
  { sort: 'matches', numeric: true },
  { sort: 'elo', numeric: true },
  { sort: 'turns', numeric: true },
]
/** The order a column is first sorted in: the best on top, names from the A. */
const firstOrder = (sort: LeaderboardSort) =>
  sort === 'rank' || sort === 'username' ? 'asc' : 'desc'
const MIN_MATCHES = [1, 5, 10, 25, 50]
const PAGE_SIZES = [10, 20, 50]

/**
 * `/leaderboard`: the global ranking, for who is signed in. A table of the players who
 * have finished at least a match, with what the matches left them: searched by name,
 * filtered by matches played, sorted by any column and read a page at a time.
 */
export function LeaderboardPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const searchId = useId()
  const minId = useId()
  const sizeId = useId()
  const [search, setSearch] = useState('')
  const [minMatches, setMinMatches] = useState(1)
  const [sort, setSort] = useState<LeaderboardSort>('rank')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // A guest is sent to sign in, and brought back.
  useEffect(() => {
    if (user === null) {
      void navigate(`/auth/login?next=${encodeURIComponent(pathname)}`, { replace: true })
    }
  }, [user, pathname, navigate])

  const list = useQuery({
    queryKey: ['leaderboard', search.trim(), minMatches, sort, order, page, pageSize],
    queryFn: () => leaderboardApi.list({ search, minMatches, sort, order, page, pageSize }),
    placeholderData: keepPreviousData,
    enabled: Boolean(user),
  })
  if (!user) return null

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1
  const filtered = search.trim() !== '' || minMatches > 1
  const sortBy = (next: LeaderboardSort) => {
    if (next === sort) setOrder(order === 'asc' ? 'desc' : 'asc')
    else {
      setSort(next)
      setOrder(firstOrder(next))
    }
    setPage(1)
  }

  return (
    <section
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-8"
      aria-labelledby="leaderboard-page-title"
    >
      <div className="flex flex-col gap-2">
        <h1 id="leaderboard-page-title" className="text-3xl sm:text-4xl">
          {t('leaderboard.title')}
        </h1>
        <p className="text-muted-foreground">{t('leaderboard.intro')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={searchId}>{t('leaderboard.search')}</Label>
          <Input
            id={searchId}
            type="search"
            className="w-56"
            value={search}
            placeholder={t('leaderboard.searchPlaceholder')}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={minId}>{t('leaderboard.minMatches')}</Label>
          <Select
            value={String(minMatches)}
            onValueChange={(value) => {
              setMinMatches(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger id={minId} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MIN_MATCHES.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count === 1 ? t('leaderboard.minAll') : t('leaderboard.minAtLeast', { count })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={sizeId}>{t('leaderboard.pageSize')}</Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger id={sizeId} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setSearch('')
              setMinMatches(1)
              setPage(1)
            }}
          >
            {t('leaderboard.reset')}
          </Button>
        )}
      </div>

      {list.error && (
        <p role="alert" className="text-danger">
          {t('leaderboard.error')}
        </p>
      )}

      <div className="bg-card text-card-foreground overflow-x-auto rounded-lg">
        <table className="w-full text-base">
          <caption className="sr-only">{t('leaderboard.title')}</caption>
          <thead>
            <tr className="border-b">
              {COLUMNS.map((column) => {
                const active = sort === column.sort
                const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={column.sort}
                    scope="col"
                    aria-sort={!active ? 'none' : order === 'asc' ? 'ascending' : 'descending'}
                    className={cn('p-0', column.numeric ? 'text-right' : 'text-left')}
                  >
                    <button
                      type="button"
                      className={cn(
                        'focus-visible:outline-ring flex w-full cursor-pointer items-center gap-1.5 px-4 py-3 font-bold whitespace-nowrap focus-visible:outline-2',
                        column.numeric && 'justify-end',
                      )}
                      onClick={() => sortBy(column.sort)}
                    >
                      {t(`leaderboard.columns.${column.sort}`)}
                      <Icon aria-hidden className={cn('size-4', !active && 'opacity-40')} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {list.data?.players.map((player) => (
              <tr
                key={player.username}
                className={cn(
                  'border-b last:border-b-0',
                  player.username === user.username && 'bg-background/50 font-bold',
                )}
              >
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{player.rank}</td>
                <td className="max-w-0 px-4 py-2.5">
                  <Link
                    to={`/user/${encodeURIComponent(player.username)}`}
                    className="block truncate underline-offset-4 hover:underline"
                  >
                    {player.username}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{player.matches}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums">
                  {player.elo}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{player.turns}</td>
              </tr>
            ))}
            {list.data?.players.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-muted-foreground px-4 py-6">
                  {filtered ? t('leaderboard.none') : t('leaderboard.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav
        className="flex flex-wrap items-center justify-between gap-3"
        aria-label={t('leaderboard.pages')}
      >
        <p className="text-muted-foreground text-base">
          {t('leaderboard.total', { count: list.data?.total ?? 0 })}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="quiet" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('home.matches.previous')}
          </Button>
          <span className="font-mono text-sm whitespace-nowrap">
            {t('home.matches.page', { page, pages })}
          </span>
          <Button
            variant="quiet"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('home.matches.next')}
          </Button>
        </div>
      </nav>
    </section>
  )
}
