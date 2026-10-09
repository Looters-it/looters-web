import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

import { Countdown } from './Countdown'

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
  return (
    <>
      {/* An attack waiting for an answer comes before everything else. */}
      {alert}
      {running && (
        <p className="bg-background rounded-pill flex h-11 items-center gap-3 px-5 whitespace-nowrap shadow-md">
          <span>
            {t('game.bar.turn')} <b className="font-mono">{match.currentTurn}</b>
          </span>
          {match.turnEndsAt && (
            <span className="text-xl">
              <Countdown until={match.turnEndsAt} label={t('game.bar.timeLeft')} />
            </span>
          )}
        </p>
      )}
      <p className="bg-background rounded-pill flex h-11 items-center px-5 whitespace-nowrap shadow-md">
        {t('game.hud.players', { players: match.players, max: match.maxPlayers })}
      </p>
      {resources !== null && (
        <p className="bg-card text-card-foreground rounded-pill flex h-11 items-center gap-2 px-5 whitespace-nowrap shadow-md">
          <span>{t('game.bar.resources')}</span>
          <b className="font-mono text-xl tabular-nums">{resources}</b>
        </p>
      )}
    </>
  )
}
