import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'
import { cn } from '@/lib/utils'

import { Countdown } from './Countdown'
import { usePhase } from './phase'

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
        <p className={cn(pill, 'bg-card text-card-foreground')}>
          <span>{t('game.bar.resources')}</span>
          <b className={figure}>{resources}</b>
        </p>
      )}
    </>
  )
}
