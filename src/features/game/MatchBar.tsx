import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { MatchState } from '@/features/matches/api'

import { Countdown } from './Countdown'

/**
 * The figures of the match shown in the sidebar (a floating pill on a narrow
 * screen) while a match is open:
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
    <div className="bg-background text-foreground rounded-pill max-lg:border-key flex min-h-11 items-center gap-2 border px-3 shadow-md sm:gap-4 lg:min-h-0 lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
      {props.alert}
      <dl className="flex items-center gap-x-3 text-sm whitespace-nowrap sm:gap-x-5 sm:text-base lg:flex-col lg:items-stretch lg:gap-y-1.5 [&_dd]:font-mono [&_dd]:font-bold [&_div]:flex [&_div]:items-baseline [&_div]:gap-1.5 lg:[&_div]:justify-between">
        <div>
          <dt className="sr-only lg:not-sr-only">{t('game.bar.online')}</dt>
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
              <div>
                <dt className="sr-only lg:not-sr-only">{t('game.bar.timeLeftShort')}</dt>
                <dd>
                  <Countdown until={match.turnEndsAt} label={t('game.bar.timeLeft')} />
                </dd>
              </div>
            )}
          </>
        )}
        {resources !== null && (
          <div>
            <dt className="sr-only lg:not-sr-only">{t('game.bar.resources')}</dt>
            <dd>{resources}</dd>
          </div>
        )}
      </dl>
    </div>,
    slot,
  )
}
