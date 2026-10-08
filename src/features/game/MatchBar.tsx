import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

import { Countdown } from './Countdown'

/**
 * The figures of the match shown in the navbar while a match is open:
 * players connected, turn, time left, and the player's total resources.
 */
export function MatchBar(props: {
  state: MatchState
  connected: number
  /** The alert of an attack waiting for an answer, shown first. */
  alert?: ReactNode
}) {
  const { state, connected } = props
  const { t } = useTranslation()
  // The navbar is already on the page when a match has loaded.
  const [slot] = useState(() => document.getElementById('navbar-match'))
  if (!slot) return null

  const { match, me } = state
  const resources = me
    ? state.territories
        .filter((territory) => territory.ownerEmpireId === me.empireId)
        .reduce((sum, territory) => sum + (territory.resources ?? 0), 0)
    : null

  return createPortal(
    <div className="flex items-center gap-4">
      {props.alert}
      <dl className="flex items-center gap-x-5 text-base whitespace-nowrap [&_dd]:font-mono [&_dd]:font-bold [&_div]:flex [&_div]:items-baseline [&_div]:gap-1.5">
        <div>
          <dt className="sr-only sm:not-sr-only">{t('game.bar.online')}</dt>
          <dd>
            {connected}/{state.online.total}
          </dd>
        </div>
        {match.status === 'RUNNING' && (
          <>
            <div>
              <dt>{t('game.bar.turn')}</dt>
              <dd>{match.currentTurn}</dd>
            </div>
            {match.turnEndsAt && (
              <div className="hidden sm:flex">
                <dt className="sr-only">{t('game.bar.timeLeft')}</dt>
                <dd>
                  <Countdown until={match.turnEndsAt} label={t('game.bar.timeLeft')} />
                </dd>
              </div>
            )}
          </>
        )}
        {resources !== null && (
          <div>
            <dt className="sr-only sm:not-sr-only">{t('game.bar.resources')}</dt>
            <dd>{resources}</dd>
          </div>
        )}
      </dl>
    </div>,
    slot,
  )
}
