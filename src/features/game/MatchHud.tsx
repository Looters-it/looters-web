import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { RollingNumber } from '@/components/RollingNumber'
import type { MatchState } from '@/features/matches/api'
import { cn } from '@/lib/utils'

import { Countdown } from './Countdown'
import { usePhase } from './phase'

/** A bag of coins, tied at the neck, with the sign of money on it. */
function MoneyBag() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 7 7.5 3.5c1.5-.8 3-.8 4.500 0 1.500.8 3 .8 4.500 0L15 7" />
      <path d="M9 7h6c3 2.500 5 5.500 5 8.500C20 19 17.500 21 12 21s-8-2-8-5.500C4 12.500 6 9.500 9 7Z" />
      <path d="M14 11.800c-.500-.600-1.200-.800-2-.800-1.200 0-2 .600-2 1.500s.800 1.300 2 1.500 2 .600 2 1.500-.800 1.500-2 1.500c-.800 0-1.500-.200-2-.800M12 10v1m0 6v1" />
    </svg>
  )
}

/**
 * What a player keeps an eye on while playing, always on the map: the alert of an
 * attack to answer, the turn and the time left to it and, on a light badge, the
 * resources they have.
 */
export function MatchHud({ state, alert }: { state: MatchState; alert?: ReactNode }) {
  const { t } = useTranslation()
  const { match, me } = state
  const resources = me
    ? state.territories
        .filter((territory) => territory.ownerEmpireId === me.empireId)
        .reduce((sum, territory) => sum + (territory.resources ?? 0), 0)
    : null
  const running = match.status === 'ONGOING'
  const number = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  // When the resources change the digits roll and the number swells for a moment,
  // like the count of the players online. Not on the first figure.
  useEffect(() => {
    const before = shown.current
    shown.current = resources
    if (before === null || resources === null || before === resources) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    number.current?.animate?.([{ scale: 1 }, { scale: 1.5 }, { scale: 1 }], {
      duration: 600,
      easing: 'ease-in-out',
    })
  }, [resources])
  const phase = usePhase(match)
  // One size of type and one baseline for the words and the figures of every pill:
  // side by side, they read as one line.
  const pill =
    'rounded-pill flex h-11 items-baseline gap-2 px-5 text-base leading-[2.75rem] whitespace-nowrap shadow-md'
  const figure = 'font-mono font-bold tabular-nums'

  return (
    <>
      {/* An attack waiting for an answer comes before everything else. */}
      {alert}
      {running && (
        <p className={cn(pill, 'bg-background')}>
          <span>{t('game.bar.turn')}</span>
          <b className={figure}>{match.currentTurn}</b>
          {/* The part of the turn, and the time left to it: the whole turn counts down
              only in its second part. */}
          {phase && (
            <span
              className={cn(
                'rounded-pill self-center px-2.5 text-sm leading-6 font-bold',
                phase === 'PRELIMINARY'
                  ? 'bg-card text-card-foreground'
                  : 'bg-secondary text-white',
              )}
            >
              {t(`game.phase.${phase}`)}
            </span>
          )}
          {match.pausedAt ? (
            <b>{t('game.pause.paused')}</b>
          ) : phase === 'PRELIMINARY' && match.preliminaryEndsAt ? (
            <Countdown until={match.preliminaryEndsAt} label={t('game.phase.timeLeft')} />
          ) : (
            match.turnEndsAt && (
              <Countdown until={match.turnEndsAt} label={t('game.bar.timeLeft')} />
            )
          )}
        </p>
      )}
      <p className={cn(pill, 'bg-background')}>
        <b className={figure}>
          {match.players}/{match.maxPlayers}
        </b>
        <span>{t('game.hud.players')}</span>
      </p>
      {resources !== null && (
        // The green of money, with its bag: what the empire has, rolling when it changes.
        <p className={cn(pill, 'items-center bg-[#85bb65] text-[#0b3d1e]')}>
          <MoneyBag />
          <span className="sr-only">{t('game.bar.resources')}</span>
          <span ref={number} className="inline-flex">
            <RollingNumber value={resources} className="font-bold" />
          </span>
        </p>
      )}
    </>
  )
}
