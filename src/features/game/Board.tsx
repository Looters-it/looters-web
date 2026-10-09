import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/features/auth/session-context'
import { matchApi, type BoardEntry, type BoardKind, type MatchState } from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { useMatchErrorText } from '@/features/matches/errors'
import { cn } from '@/lib/utils'

import { useEntryText } from './entry-text'

const KINDS: BoardKind[] = [
  'messages',
  'battles',
  'annexations',
  'empires',
  'capitals',
  'areas',
  'alliances',
  'match',
]

/** Where the reader got to, kept in this browser: a convenience, nothing depends on it. */
function useSeen(matchId: string) {
  const key = `board-seen:${matchId}`
  const read = () => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  }
  const [seen, setSeen] = useState(read)
  return {
    seen,
    markSeen: (createdAt: string) => {
      if (createdAt <= seen) return
      setSeen(createdAt)
      try {
        localStorage.setItem(key, createdAt)
      } catch {
        // Storage may be unavailable (private window): the badge simply restarts.
      }
    },
  }
}

/**
 * The public board of the match (PROMPT §2.11): the messages of the empires
 * and the automatic announcements, in order. Closed, it shows the latest
 * Closed, it is a button that says how many entries are new; open, the list, the
 * filters and the field to write.
 */
export function Board(props: {
  state: MatchState
  /** Centres the map on a municipality named by an announcement. */
  onGoTo: (geoUnitId: number, name: string) => void
  /** Always open and filling its container: the board tab on a phone. */
  full?: boolean
  /** Shown in the same row as the button that opens the board, before it. */
  leading?: ReactNode
  /** Shown above the button while the board is closed: open, the board says it all itself. */
  above?: ReactNode
  /** On a phone the board is a tab of its own: over the map only the row stays, without the button. */
  onPhoneTab?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { user } = useSession()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const entryText = useEntryText()
  const kindId = useId()
  const empireId = useId()
  const { state } = props
  const matchId = state.match.id
  const [expanded, setExpanded] = useState(false)
  const open = props.full === true || expanded
  const [kind, setKind] = useState<BoardKind | ''>('')
  const [empire, setEmpire] = useState('')
  const [text, setText] = useState('')
  const { seen, markSeen } = useSeen(matchId)

  const filters = { kind: kind || undefined, empireId: empire || undefined }
  const board = useQuery({
    queryKey: ['matches', 'board', matchId, kind, empire],
    queryFn: () => matchApi.board(matchId, filters),
  })
  // The closed panel always shows the latest entry of all, whatever the filters.
  const latestQuery = useQuery({
    queryKey: ['matches', 'board', matchId, '', ''],
    queryFn: () => matchApi.board(matchId, {}),
  })
  const all = latestQuery.data ?? []
  const latest = all[0]
  const unread = all.filter((entry) => entry.createdAt > seen).length
  if (open && latest && latest.createdAt > seen) markSeen(latest.createdAt)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['matches', 'board', matchId] })
  const send = useMutation({
    mutationFn: () => matchApi.postMessage(matchId, text.trim()),
    onSuccess: () => {
      setText('')
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (eventId: string) => matchApi.removeMessage(matchId, eventId),
    onSuccess: refresh,
  })

  const empires = new Map(state.empires.map((candidate) => [candidate.id, candidate]))
  const canWrite = state.me?.status === 'ACTIVE' && state.match.status !== 'FINISHED'
  const canModerate = state.match.isOwner || user?.role === 'ADMIN'
  const maxChars = Number(state.match.config.boardMaxChars ?? 500)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) send.mutate()
  }

  const entryView = (entry: BoardEntry) => {
    const author = entry.empireId ? empires.get(entry.empireId) : undefined
    const isMessage = entry.type === 'MESSAGE'
    const place = entry.data.territoryName
    return (
      <li key={entry.id} className="flex items-start gap-2 py-2">
        {isMessage && author && (
          <EmpireShield
            color={author.color}
            emblem={author.emblem}
            logo={author.logoUrl}
            className="mt-0.5 size-6"
          />
        )}
        <div className="min-w-0 flex-1">
          {isMessage && <p className="font-bold">{entry.data.empireName}</p>}
          <p className={cn('break-words', !isMessage && 'text-muted-foreground')}>
            {entryText(entry)}
          </p>
          {/* An announcement that names a municipality leads to it on the map. */}
          {entry.geoUnitId !== null && place && (
            <button
              type="button"
              className="hover:text-primary cursor-pointer text-base underline underline-offset-2"
              onClick={() => props.onGoTo(entry.geoUnitId ?? 0, place)}
            >
              {t('game.board.goTo', { name: place })}
            </button>
          )}
        </div>
        <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
          {t('game.board.turn', { turn: entry.turn })}
        </span>
        {isMessage && canModerate && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6"
            aria-label={t('game.board.remove', { name: entry.data.empireName ?? '' })}
            disabled={remove.isPending}
            onClick={() => remove.mutate(entry.id)}
          >
            <Trash2 />
          </Button>
        )}
      </li>
    )
  }

  const panel = open && (
    <section
      aria-label={t('game.board.title')}
      className={cn(
        'bg-background flex min-h-0 flex-col',
        props.full
          ? 'h-full'
          : 'max-h-[60dvh] w-[min(26rem,calc(100vw-1.5rem))] rounded-lg shadow-md',
      )}
    >
      <>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={kindId} className="text-base">
              {t('game.board.kind')}
            </label>
            <Select
              value={kind || 'all'}
              onValueChange={(value) => setKind(value === 'all' ? '' : (value as BoardKind))}
            >
              <SelectTrigger id={kindId} size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('game.board.allKinds')}</SelectItem>
                {KINDS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`game.board.kinds.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={empireId} className="text-base">
              {t('game.board.empire')}
            </label>
            <Select
              value={empire || 'all'}
              onValueChange={(value) => setEmpire(value === 'all' ? '' : value)}
            >
              <SelectTrigger id={empireId} size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('game.board.allEmpires')}</SelectItem>
                {state.empires.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Newest at the bottom, next to the field to write, as in a conversation. */}
        <ul
          className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3"
          aria-live="polite"
        >
          {board.data?.map(entryView)}
          {board.data?.length === 0 && (
            <li className="text-muted-foreground py-3">{t('game.board.empty')}</li>
          )}
        </ul>

        {canWrite ? (
          <form onSubmit={submit} className="flex flex-col gap-1 p-3">
            <div className="flex gap-2">
              <Input
                aria-label={t('game.board.write')}
                placeholder={t('game.board.write')}
                maxLength={maxChars}
                value={text}
                onChange={(event) => {
                  send.reset()
                  setText(event.target.value)
                }}
              />
              <Button type="submit" size="sm" disabled={send.isPending || text.trim() === ''}>
                {t('game.board.send')}
              </Button>
            </div>
            {text.length > maxChars * 0.8 && (
              <p className="text-muted-foreground text-base">
                {t('game.board.left', { count: maxChars - text.length })}
              </p>
            )}
            {send.error && (
              <p role="alert" className="text-danger">
                {errorText(send.error)}
              </p>
            )}
          </form>
        ) : (
          <p className="text-muted-foreground p-3 text-base">{t('game.board.readOnly')}</p>
        )}
      </>
    </section>
  )
  if (props.full) return panel

  return (
    <div className={cn('flex flex-col items-end gap-2', props.className)}>
      {panel || props.above}
      {/* One row at the bottom: what the caller keeps there, then the way into the board. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {props.leading}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? t('game.board.close') : t('game.board.open')}
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'bg-background hover:bg-accent rounded-pill flex h-11 cursor-pointer items-center gap-2 px-5 shadow-md',
            props.onPhoneTab && 'max-md:hidden',
          )}
        >
          <span className="font-display text-base">{t('game.board.title')}</span>
          {!expanded && unread > 0 && (
            <span className="rounded-pill bg-danger text-on-danger px-2 text-sm font-bold">
              {t('game.board.new', { count: unread })}
            </span>
          )}
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>
    </div>
  )
}
