import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSession } from '@/features/auth/session-context'
import { matchApi, type MatchState } from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { cn } from '@/lib/utils'

import { empireTags } from './tags'

/**
 * The ranking by municipalities controlled (resources stay hidden until the
 * end, PROMPT §9 #10). Each empire shows one square per municipality;
 * pointing at a card lights its territories on the map.
 */
export function Leaderboard(props: {
  state: MatchState
  onHover: (empireId: string | null) => void
}) {
  const { t } = useTranslation()
  const { state } = props
  const tags = empireTags(state.empires)
  const { user } = useSession()
  const queryClient = useQueryClient()
  const canModerate = state.match.isOwner || user?.role === 'ADMIN'
  const removeLogo = useMutation({
    mutationFn: (empireId: string) => matchApi.removeLogo(state.match.id, empireId),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', state.match.id], next),
  })
  const empires = [...state.empires].sort(
    (a, b) => b.units - a.units || a.name.localeCompare(b.name),
  )
  const total = empires.reduce((sum, empire) => sum + empire.units, 0)

  return (
    <section className="flex flex-col gap-3" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className="text-lg">
        {t('game.leaderboard.title')}
      </h2>

      {total > 0 && (
        <div
          className="rounded-pill flex h-3 overflow-hidden border"
          role="img"
          aria-label={t('game.leaderboard.share')}
        >
          {empires.map((empire) => (
            <div
              key={empire.id}
              style={{ width: `${(empire.units / total) * 100}%`, backgroundColor: empire.color }}
            />
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {empires.map((empire, index) => {
          const territories = state.territories.filter((t) => t.ownerEmpireId === empire.id)
          return (
            <li
              key={empire.id}
              className={cn(
                'rounded-md border p-3',
                empire.id === state.me?.empireId && 'border-foreground',
                empire.status === 'FALLEN' && 'opacity-60',
              )}
              onMouseEnter={() => props.onHover(empire.id)}
              onMouseLeave={() => props.onHover(null)}
              onFocus={() => props.onHover(empire.id)}
              onBlur={() => props.onHover(null)}
              tabIndex={0}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 font-mono text-lg font-bold">{index + 1}</span>
                <EmpireShield color={empire.color} emblem={empire.emblem} logo={empire.logoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {empire.name}
                    {/* The tag written on the empire's municipalities on the map. */}
                    <span
                      className="text-muted-foreground ml-2 font-mono text-sm font-normal"
                      aria-label={t('game.tag', { tag: tags.get(empire.id) ?? '' })}
                    >
                      {tags.get(empire.id)}
                    </span>
                    {state.match.winnerEmpireIds.includes(empire.id) && (
                      <span className="rounded-pill border-foreground ml-2 border px-2 text-sm font-normal">
                        {t('game.end.winnerTag')}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-base">
                    {empire.username}
                    {empire.status === 'FALLEN' &&
                      empire.fallenTurn !== null &&
                      ` · ${t('game.end.fallen', { turn: empire.fallenTurn })}`}
                  </p>
                  {/* Who runs the match can take down a picture that should not be there. */}
                  {canModerate && empire.logoUrl && empire.id !== state.me?.empireId && (
                    <button
                      type="button"
                      className="hover:text-danger cursor-pointer text-base underline underline-offset-2"
                      disabled={removeLogo.isPending}
                      onClick={() => removeLogo.mutate(empire.id)}
                    >
                      {t('match.empire.logoModerate', { name: empire.name })}
                    </button>
                  )}
                </div>
                <span className="font-mono text-sm whitespace-nowrap">
                  {t('match.players.units', { count: empire.units })}
                  {/* Totals are revealed only when the match is over. */}
                  {empire.resources !== undefined && (
                    <>
                      <br />
                      {t('game.end.resources', { count: empire.resources })}
                    </>
                  )}
                </span>
              </div>
              {/* One square per municipality: capital outlined, protected hollow. */}
              <ul className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
                {territories.flatMap((territory) =>
                  territory.geoUnitIds.map((unitId) => (
                    <li
                      key={unitId}
                      className={cn(
                        'size-3 rounded-[2px] border',
                        territory.id === empire.capitalTerritoryId &&
                          'ring-foreground ring-offset-background ring-2 ring-offset-1',
                      )}
                      style={{
                        borderColor: empire.color,
                        backgroundColor: territory.protected ? 'transparent' : empire.color,
                      }}
                    />
                  )),
                )}
              </ul>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
