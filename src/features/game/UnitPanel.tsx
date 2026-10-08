import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MapUnit } from '@/features/map/GameMap'
import { matchApi, type MatchState, type UnitCardData } from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { useMatchErrorText } from '@/features/matches/errors'

/** The action on a free municipality: annex it, paying from an adjacent own territory. */
function AnnexAction({ state, card }: { state: MatchState; card: UnitCardData }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const payId = useId()
  const matchId = state.match.id
  const annex = card.annex
  const usable = annex?.payFrom.filter((payer) => payer.usable) ?? []
  const [chosen, setChosen] = useState<string | null>(null)
  const payFrom = usable.find((payer) => payer.territoryId === chosen) ?? usable[0]

  const act = useMutation({
    mutationFn: () =>
      matchApi.annex(matchId, {
        geoUnitId: card.geoUnitId,
        payFromTerritoryId: payFrom?.territoryId ?? '',
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      return queryClient.invalidateQueries({ queryKey: ['matches', 'unit', matchId] })
    },
  })
  if (!annex) return null

  // The reason is always spelled out when the action is not possible.
  const blocked =
    annex.left === 0
      ? t('game.unit.annexNoneLeft')
      : annex.payFrom.length === 0
        ? t('game.unit.annexNotAdjacent')
        : usable.length === 0
          ? t('game.unit.annexNoFunds', { count: annex.cost })
          : null

  return (
    <section className="flex flex-col gap-2 rounded-md border p-3" aria-labelledby="annex-title">
      <h3 id="annex-title" className="text-base">
        {t('game.unit.annexTitle')}
      </h3>
      {blocked ? (
        <p className="text-muted-foreground">{blocked}</p>
      ) : (
        <>
          <p>{t('game.unit.annexCost', { count: annex.cost })}</p>
          {usable.length > 1 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={payId}>{t('game.unit.payFrom')}</Label>
              <Select value={payFrom?.territoryId} onValueChange={setChosen}>
                <SelectTrigger id={payId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {usable.map((payer) => (
                    <SelectItem key={payer.territoryId} value={payer.territoryId}>
                      {t('game.unit.payOption', { name: payer.name, count: payer.resources })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {usable.length === 1 && payFrom && (
            <p className="text-muted-foreground">
              {t('game.unit.payFrom')}:{' '}
              {t('game.unit.payOption', { name: payFrom.name, count: payFrom.resources })}
            </p>
          )}
          {act.error && (
            <p role="alert" className="text-danger">
              {errorText(act.error)}
            </p>
          )}
          <Button disabled={act.isPending} onClick={() => act.mutate()}>
            {t('game.unit.annex')}
          </Button>
        </>
      )}
    </section>
  )
}

/**
 * The card of the selected municipality: who holds it, its state, the
 * action available, and its neighbours, each of which can be opened in turn.
 * Resources are never managed here (PROMPT §11).
 */
export function UnitPanel(props: {
  state: MatchState
  unit: MapUnit
  onSelect: (unit: MapUnit) => void
  /** Reports the neighbours that could be annexed from here, to light them on the map. */
  onCard?: (card: UnitCardData) => void
  /** Opens the preparation of an attack on this municipality. */
  onPrepareAttack?: (card: UnitCardData) => void
}) {
  const { t } = useTranslation()
  const { state, unit } = props
  const card = useQuery({
    queryKey: ['matches', 'unit', state.match.id, unit.id],
    queryFn: async () => {
      const data = await matchApi.unit(state.match.id, unit.id)
      props.onCard?.(data)
      return data
    },
  })
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))
  const owner = card.data?.territory.ownerEmpireId
    ? empires.get(card.data.territory.ownerEmpireId)
    : undefined
  const mine = state.me?.empireId

  return (
    <section className="flex flex-col gap-4" aria-labelledby="unit-title">
      <h2 id="unit-title" className="text-xl">
        {unit.name}
      </h2>
      {card.data && (
        <>
          <div className="flex flex-col gap-1">
            {owner ? (
              <p className="flex items-center gap-2">
                <EmpireShield color={owner.color} emblem={owner.emblem} className="size-6" />
                {t('match.unit.owned', { name: owner.name })}
              </p>
            ) : (
              <p>{t('match.unit.free')}</p>
            )}
            {owner && (
              <p className="text-muted-foreground">
                {card.data.territory.resources === null
                  ? t('match.unit.hidden')
                  : t('match.unit.resources', { count: card.data.territory.resources })}
              </p>
            )}
            <p className="text-muted-foreground">
              {t('game.unit.state')}:{' '}
              {card.data.territory.inBattle ? t('game.unit.war') : t('game.unit.peace')}
              {owner?.capitalTerritoryId === card.data.territory.id &&
                ` · ${t('match.unit.capital')}`}
              {card.data.territory.protected && ` · ${t('match.unit.protected')}`}
            </p>
          </div>

          <AnnexAction
            key={`${unit.id}:${state.match.currentTurn}`}
            state={state}
            card={card.data}
          />

          {card.data.attack && (
            <section
              className="flex flex-col gap-2 rounded-md border p-3"
              aria-labelledby="attack-box"
            >
              <h3 id="attack-box" className="text-base">
                {t('game.unit.attackTitle')}
              </h3>
              {/* The reason is always spelled out when the action is not possible. */}
              {card.data.attack.blocked === 'PROTECTED' ? (
                <p className="text-muted-foreground">{t('game.unit.attackProtected')}</p>
              ) : card.data.attack.blocked === 'IN_BATTLE' ? (
                <p className="text-muted-foreground">{t('game.unit.attackInBattle')}</p>
              ) : card.data.attack.blocked === 'NOT_ADJACENT' ? (
                <p className="text-muted-foreground">{t('game.unit.attackNotAdjacent')}</p>
              ) : !card.data.attack.from.some((source) => source.usable) ? (
                <p className="text-muted-foreground">{t('game.unit.attackNoForce')}</p>
              ) : (
                <Button
                  variant="destructive"
                  className="self-start"
                  onClick={() => card.data && props.onPrepareAttack?.(card.data)}
                >
                  {t('game.unit.prepareAttack')}
                </Button>
              )}
            </section>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="text-base">{t('game.unit.neighbours')}</h3>
            {card.data.neighbours.length === 0 && (
              <p className="text-muted-foreground">{t('game.unit.noNeighbours')}</p>
            )}
            <ul className="flex flex-wrap gap-2">
              {card.data.neighbours.map((neighbour) => {
                const empire = neighbour.ownerEmpireId
                  ? empires.get(neighbour.ownerEmpireId)
                  : undefined
                return (
                  <li key={neighbour.geoUnitId}>
                    <Button
                      variant="quiet"
                      size="sm"
                      className="tracking-normal normal-case"
                      onClick={() =>
                        props.onSelect({ id: neighbour.geoUnitId, name: neighbour.name })
                      }
                    >
                      {empire && (
                        <span
                          className="border-foreground size-3 rounded-full border"
                          style={{ backgroundColor: empire.color }}
                          aria-hidden="true"
                        />
                      )}
                      {neighbour.name}
                      <span className="text-muted-foreground font-normal">
                        {!empire
                          ? t('game.unit.freeTag')
                          : empire.id === mine
                            ? t('game.unit.yoursTag')
                            : empire.name}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
