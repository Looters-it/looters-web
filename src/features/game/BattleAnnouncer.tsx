import { Castle, Flag, Shield, Skull, Swords, Trophy, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import type { Battle, MatchState } from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { cn } from '@/lib/utils'

import { scoreOf } from './battles'
import { defeatSound, drawSound, victorySound } from './tick'
import './battle-announcer.css'

/** How long an outcome stays before it goes by itself. */
const STAYS_MS = 12_000
const CONFETTI = 18

/** What is announced: a battle as it stood when its outcome, or a round nobody won, came. */
interface News {
  key: string
  battle: Battle
  mood: 'won' | 'lost' | 'draw' | 'off'
}

/** How a battle ended for who is watching, or 'draw' while it goes on as a siege. */
function moodOf(battle: Battle): News['mood'] {
  if (battle.status === 'OPEN') return 'draw'
  if (battle.outcome === 'CANCELLED' || battle.outcome === null) return 'off'
  const attackerWon = battle.outcome === 'ATTACKER_WON' || battle.outcome === 'SURRENDER'
  return (battle.role === 'attacker') === attackerWon ? 'won' : 'lost'
}

/** The news a state carries about the battles of the player: outcomes, and rounds drawn. */
const newsOf = (state: MatchState): News[] =>
  state.battles
    .filter((battle) => battle.role !== null)
    .flatMap((battle): News[] => {
      if (battle.status === 'RESOLVED') {
        return [{ key: `${battle.id}:end`, battle, mood: moodOf(battle) }]
      }
      // A siege: each round nobody won is news once.
      const drawn = battle.rounds.filter((round) => round.result === 'DRAW').length
      return drawn > 0 ? [{ key: `${battle.id}:round:${String(drawn)}`, battle, mood: 'draw' }] : []
    })

/**
 * How a battle of the player went, said in the middle of the map like the turn that
 * begins, and made a moment of the game: the two shields face to face, a rope pulled to
 * the side that won by as much as it won, what it paid, confetti for a victory. It goes
 * by itself after a while, or at once with its X; several outcomes come one after another.
 */
export function BattleAnnouncer({
  state,
  sound,
  onPending,
}: {
  state: MatchState
  sound: boolean
  /** Told whether outcomes are still to be shown: what comes after them waits. */
  onPending?: (pending: boolean) => void
}) {
  const { t } = useTranslation()
  // What was already so when the page opened is not news.
  const seen = useRef<Set<string> | null>(null)
  seen.current ??= new Set(newsOf(state).map((news) => news.key))
  const [queue, setQueue] = useState<News[]>([])
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  useEffect(() => {
    const fresh = newsOf(state).filter((news) => !seen.current?.has(news.key))
    if (fresh.length === 0) return
    for (const news of fresh) seen.current?.add(news.key)
    setQueue((current) => [...current, ...fresh])
  }, [state])

  const pending = queue.length > 0
  useEffect(() => {
    onPending?.(pending)
    return () => onPending?.(false)
    // The one who listens is the same for as long as this is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const shown = queue[0]
  const shownKey = shown?.key
  const shownMood = shown?.mood
  useEffect(() => {
    if (!shownKey) return
    if (soundRef.current) {
      if (shownMood === 'won') victorySound()
      else if (shownMood === 'lost') defeatSound()
      else drawSound()
    }
    const timer = setTimeout(() => setQueue((current) => current.slice(1)), STAYS_MS)
    return () => clearTimeout(timer)
  }, [shownKey, shownMood])

  if (!shown) return null
  const { battle, mood } = shown
  const role = battle.role ?? 'attacker'
  const attacker = state.empires.find((empire) => empire.id === battle.attackerEmpireId)
  const defender = state.empires.find((empire) => empire.id === battle.defenderEmpireId)
  const score = battle.rounds.length > 0 ? scoreOf(battle.share) : null
  const Icon =
    mood === 'won'
      ? Trophy
      : mood === 'draw'
        ? Castle
        : mood === 'off'
          ? Flag
          : role === 'attacker'
            ? Shield
            : Skull
  const title =
    mood === 'draw'
      ? t('game.outcome.title.draw')
      : mood === 'off'
        ? t('game.outcome.title.off')
        : t(`game.outcome.title.${role}.${battle.outcome ?? 'CANCELLED'}`)
  const text =
    mood === 'draw'
      ? t('game.outcome.siegeGoesOn', { name: battle.targetName, round: battle.round })
      : t(`game.battles.outcome.${role}.${battle.outcome ?? 'CANCELLED'}`, {
          name: battle.targetName,
        })

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <section
        key={shown.key}
        role="alert"
        aria-labelledby="outcome-title"
        className={cn(
          'outcome bg-background pointer-events-auto relative flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-4 px-6 pt-7 pb-5 text-center shadow-2xl',
          `outcome-${mood}`,
        )}
      >
        <button
          type="button"
          aria-label={t('game.outcome.close')}
          onClick={() => setQueue((current) => current.slice(1))}
          className="hover:bg-foreground/10 absolute top-2 right-2 flex size-10 cursor-pointer items-center justify-center rounded-full"
        >
          <X aria-hidden="true" className="size-6" />
        </button>

        {/* Confetti for a victory: thrown once, from behind the title. */}
        {mood === 'won' && (
          <span aria-hidden="true" className="outcome-confetti">
            {Array.from({ length: CONFETTI }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    '--angle': `${String((360 / CONFETTI) * index)}deg`,
                    '--far': `${String(6 + (index % 4) * 2)}rem`,
                    '--hue': String((index * 47) % 360),
                    animationDelay: `${String((index % 5) * 40)}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}

        <span className="outcome-icon flex size-16 items-center justify-center rounded-full text-white">
          <Icon aria-hidden="true" className="size-9" />
        </span>
        <h2 id="outcome-title" className="outcome-title font-display text-4xl sm:text-5xl">
          {title}
        </h2>
        <p className="text-lg">{text}</p>

        {/* The two sides face to face, and the rope between them. */}
        {attacker && defender && (
          <div className="flex w-full flex-col gap-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="outcome-side outcome-left flex min-w-0 items-center gap-2">
                <EmpireShield
                  color={attacker.color}
                  emblem={attacker.emblem}
                  logo={attacker.logoUrl}
                  className="size-10"
                />
                <span className="truncate text-left font-bold">{attacker.name}</span>
              </span>
              <Swords aria-hidden="true" className="outcome-swords size-6 flex-none" />
              <span className="outcome-side outcome-right flex min-w-0 items-center justify-end gap-2">
                <span className="truncate text-right font-bold">{defender.name}</span>
                <EmpireShield
                  color={defender.color}
                  emblem={defender.emblem}
                  logo={defender.logoUrl}
                  className="size-10"
                />
              </span>
            </div>
            {score && (
              <>
                <div
                  className="outcome-rope flex h-5 w-full overflow-hidden rounded-full border-2"
                  role="img"
                  aria-label={t('game.battles.score', score)}
                >
                  <span
                    className="outcome-pull h-full"
                    style={
                      {
                        background: attacker.color,
                        '--share': `${String(score.attack)}%`,
                      } as CSSProperties
                    }
                  />
                  <span className="h-full flex-1" style={{ background: defender.color }} />
                </div>
                <div className="font-display flex justify-between text-2xl">
                  <span>{score.attack}%</span>
                  {battle.rounds.length > 1 && (
                    <span className="text-muted-foreground self-center font-sans text-base">
                      {t('game.battles.rounds', { count: battle.rounds.length })}
                    </span>
                  )}
                  <span>{score.defense}%</span>
                </div>
              </>
            )}
          </div>
        )}

        {battle.spoils !== undefined && battle.status === 'RESOLVED' && (
          <p className="outcome-spoils font-display text-2xl text-[#1f9d55]">
            {t('game.outcome.spoils', { count: battle.spoils })}
          </p>
        )}
        {queue.length > 1 && (
          <p className="text-muted-foreground text-base">
            {t('game.outcome.more', { count: queue.length - 1 })}
          </p>
        )}
        {/* What is left before it goes by itself. */}
        <span
          aria-hidden="true"
          className="outcome-timer absolute inset-x-0 bottom-0 h-1.5 rounded-b-xl"
          style={{ animationDuration: `${String(STAYS_MS)}ms` }}
        />
      </section>
    </div>
  )
}
