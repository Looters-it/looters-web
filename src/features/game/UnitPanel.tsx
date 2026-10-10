import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Flag, Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import type { MapUnit } from '@/features/map/GameMap'
import {
  matchApi,
  type MatchState,
  type Territory,
  type UnitCardData,
} from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { Countdown } from './Countdown'
import { usePhase } from './phase'
import { StatusBadge, unitStatus } from './StatusBadge'
import { useMatchErrorText } from '@/features/matches/errors'

/** The action on a free municipality: annex it, paying from an adjacent own territory. */
function AnnexAction({ state, card }: { state: MatchState; card: UnitCardData }) {
  const phase = usePhase(state.match)
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

  // The reason is always spelled out when the municipality cannot be annexed at all.
  const blocked =
    annex.payFrom.length === 0
      ? t('game.unit.annexNotAdjacent')
      : usable.length === 0
        ? t('game.unit.annexNoFunds', { count: annex.cost })
        : null
  // It could be, but not now: the button stays, off, and says when or why.
  const waiting = phase === 'PRELIMINARY' ? state.match.preliminaryEndsAt : null
  const spent = annex.left === 0

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
          {payFrom && payFrom.fromCapital > 0 && (
            <p className="text-muted-foreground">
              {t('game.unit.payWithCapital', { count: payFrom.fromCapital })}
            </p>
          )}
          {act.error && (
            <p role="alert" className="text-danger">
              {errorText(act.error)}
            </p>
          )}
          <Button
            disabled={act.isPending || phase === 'PRELIMINARY' || spent}
            onClick={() => act.mutate()}
          >
            <Flag aria-hidden="true" />
            {t('game.unit.annex')}
            {waiting && <Countdown until={waiting} label={t('game.phase.timeLeft')} />}
          </Button>
          {spent && <p className="text-muted-foreground">{t('game.unit.annexNoneLeft')}</p>}
        </>
      )}
    </section>
  )
}

/** Moving the capital here: once every few turns, and never during a battle on it. */
function CapitalAction(props: { state: MatchState; card: UnitCardData; isCapital: boolean }) {
  const phase = usePhase(props.state.match)
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const { state, card } = props
  const matchId = state.match.id
  const wait = state.me?.capitalMoveInTurns ?? 0
  const capital = state.territories.find(
    (territory) =>
      territory.id ===
      state.empires.find((empire) => empire.id === state.me?.empireId)?.capitalTerritoryId,
  )

  const move = useMutation({
    mutationFn: () =>
      matchApi.moveCapital(matchId, {
        territoryId: card.territory.id,
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })

  return (
    <section className="flex flex-col gap-2 rounded-md border p-3" aria-labelledby="capital-box">
      <h3 id="capital-box" className="text-base">
        {t('game.unit.capitalTitle')}
      </h3>
      {props.isCapital ? (
        <p className="text-muted-foreground">{t('game.unit.capitalHint')}</p>
      ) : wait > 0 ? (
        <p className="text-muted-foreground">{t('game.unit.capitalWait', { count: wait })}</p>
      ) : card.territory.inBattle || capital?.battleId ? (
        <p className="text-muted-foreground">{t('game.unit.capitalInBattle')}</p>
      ) : (
        <>
          {move.error && (
            <p role="alert" className="text-danger">
              {errorText(move.error)}
            </p>
          )}
          <Button
            variant="outline"
            className="self-start"
            disabled={move.isPending || phase !== 'PRELIMINARY'}
            title={phase !== 'PRELIMINARY' ? t('game.phase.onlyPreliminary') : undefined}
            onClick={() => move.mutate()}
          >
            {t('game.unit.moveCapital')}
          </Button>
        </>
      )}
    </section>
  )
}

/** An area is renamed from its own card. */
function RenameArea({ state, territory }: { state: MatchState; territory: Territory }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const id = useId()
  const [name, setName] = useState(territory.name)
  const matchId = state.match.id
  const rename = useMutation({
    mutationFn: () => matchApi.renameArea(matchId, territory.id, name.trim()),
    onSuccess: (next) => queryClient.setQueryData(['matches', 'state', matchId], next),
  })

  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        rename.mutate()
      }}
    >
      <Label htmlFor={id}>{t('game.unit.renameArea')}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          required
          minLength={2}
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={rename.isPending || name.trim() === territory.name}
        >
          {t('game.unit.rename')}
        </Button>
      </div>
      {rename.error && (
        <p role="alert" className="text-danger">
          {errorText(rename.error)}
        </p>
      )}
    </form>
  )
}

/**
 * The card of the selected municipality: who holds it, its state, the
 * action available.
 * Resources are never managed here (PROMPT §11).
 */
export function UnitPanel(props: {
  state: MatchState
  unit: MapUnit
  /** Reports the neighbours that could be annexed from here, to light them on the map. */
  onCard?: (card: UnitCardData) => void
  /** Opens the preparation of an attack on this municipality. */
  onPrepareAttack?: (card: UnitCardData) => void
}) {
  const { t, i18n } = useTranslation()
  const { state, unit } = props
  const phase = usePhase(state.match)
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
  const isMine = mine !== undefined && card.data?.territory.ownerEmpireId === mine
  const isAlly =
    !isMine &&
    owner !== undefined &&
    state.alliances.some(
      (pact) => pact.empireIds.includes(mine ?? '') && pact.empireIds.includes(owner.id),
    )
  const territoryState = state.territories.find((t) => t.id === card.data?.territory.id)
  const structuresHere = state.structures.filter(
    (structure) => structure.territoryId === card.data?.territory.id,
  )

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
                <EmpireShield
                  color={owner.color}
                  emblem={owner.emblem}
                  logo={owner.logoUrl}
                  className="size-6"
                />
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
            {isAlly && <p>{t('game.unit.ally')}</p>}
            <p className="text-muted-foreground flex flex-wrap items-center gap-2">
              <span className="sr-only">{t('game.unit.state')}:</span>
              <StatusBadge status={unitStatus(owner !== undefined, card.data.territory.inBattle)} />
              {owner?.capitalTerritoryId === card.data.territory.id && (
                <span>{t('match.unit.capital')}</span>
              )}
              {card.data.territory.protected && <span>{t('match.unit.protected')}</span>}
            </p>
            {territoryState?.alert && <p className="text-danger">{t('game.unit.alert')}</p>}
            {territoryState?.isArea && (
              <p className="text-muted-foreground">
                {t('game.unit.partOf', { name: territoryState.name })}{' '}
                {t('game.unit.area', { count: territoryState.geoUnitIds.length })}
              </p>
            )}
            {structuresHere.length > 0 && (
              <p>
                {t('game.unit.structures')}:{' '}
                {structuresHere
                  .map((structure) =>
                    i18n.exists(`game.structures.types.${structure.type}`)
                      ? t(
                          `game.structures.types.${structure.type}` as 'game.structures.types.BLOCK',
                        )
                      : structure.type,
                  )
                  .join(', ')}
              </p>
            )}
          </div>

          {isMine && territoryState?.isArea && state.me?.status === 'ACTIVE' && (
            <RenameArea key={territoryState.id} state={state} territory={territoryState} />
          )}
          {isMine && state.match.status === 'ONGOING' && state.me?.status === 'ACTIVE' && (
            <CapitalAction
              key={`capital:${unit.id}:${state.match.currentTurn}`}
              state={state}
              card={card.data}
              isCapital={owner?.capitalTerritoryId === card.data.territory.id}
            />
          )}

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
              {card.data.attack.blocked === 'BLOCKED' ? (
                <p className="text-muted-foreground">{t('game.unit.attackBlocked')}</p>
              ) : card.data.attack.blocked === 'PROTECTED' ? (
                <p className="text-muted-foreground">{t('game.unit.attackProtected')}</p>
              ) : card.data.attack.blocked === 'IN_BATTLE' ? (
                <p className="text-muted-foreground">{t('game.unit.attackInBattle')}</p>
              ) : card.data.attack.blocked === 'NOT_ADJACENT' ? (
                <p className="text-muted-foreground">{t('game.unit.attackNotAdjacent')}</p>
              ) : !card.data.attack.from.some((source) => source.usable) ? (
                <p className="text-muted-foreground">{t('game.unit.attackNoForce')}</p>
              ) : card.data.attack.left === 0 ? (
                <>
                  <Button variant="destructive" className="self-start" disabled>
                    <Swords aria-hidden="true" />
                    {t('game.unit.prepareAttack')}
                  </Button>
                  <p className="text-muted-foreground">{t('game.unit.attackNoneLeft')}</p>
                </>
              ) : (
                <Button
                  variant="destructive"
                  className="self-start"
                  disabled={phase === 'PRELIMINARY'}
                  title={phase === 'PRELIMINARY' ? t('game.phase.waitAction') : undefined}
                  onClick={() => card.data && props.onPrepareAttack?.(card.data)}
                >
                  <Swords aria-hidden="true" />
                  {t('game.unit.prepareAttack')}
                  {phase === 'PRELIMINARY' && state.match.preliminaryEndsAt && (
                    <Countdown
                      until={state.match.preliminaryEndsAt}
                      label={t('game.phase.timeLeft')}
                    />
                  )}
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </section>
  )
}
